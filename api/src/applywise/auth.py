from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from applywise.database import get_session
from applywise.models import User

DEFAULT_AUTH_JWT_AUDIENCE = "applywise-api"
DEFAULT_AUTH_JWT_ISSUER = "applywise-web"
DEFAULT_AUTH_JWT_SECRET = "dev-applywise-auth-secret-change-me"

bearer_scheme = HTTPBearer(auto_error=False)
bearer_dependency = Depends(bearer_scheme)
session_dependency = Depends(get_session)


@dataclass(frozen=True)
class AuthClaims:
    subject: str
    email: str
    name: str | None


def get_auth_jwt_secret() -> str:
    return os.environ.get("AUTH_JWT_SECRET", DEFAULT_AUTH_JWT_SECRET)


def get_auth_jwt_issuer() -> str:
    return os.environ.get("AUTH_JWT_ISSUER", DEFAULT_AUTH_JWT_ISSUER)


def get_auth_jwt_audience() -> str:
    return os.environ.get("AUTH_JWT_AUDIENCE", DEFAULT_AUTH_JWT_AUDIENCE)


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _json_part(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(_base64url_decode(value))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc

    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )
    return parsed


def _sign(message: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message.encode("ascii"), hashlib.sha256).digest()
    return _base64url_encode(digest)


def decode_backend_jwt(token: str) -> AuthClaims:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    header = _json_part(parts[0])
    if header.get("alg") != "HS256":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported authentication token.",
        )

    message = f"{parts[0]}.{parts[1]}"
    expected_signature = _sign(message, get_auth_jwt_secret())
    if not hmac.compare_digest(expected_signature, parts[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    payload = _json_part(parts[1])
    now = int(datetime.now(UTC).timestamp())

    expires_at = payload.get("exp")
    if not isinstance(expires_at, int) or expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token expired.",
        )

    if payload.get("iss") != get_auth_jwt_issuer():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication issuer.",
        )

    audience = payload.get("aud")
    expected_audience = get_auth_jwt_audience()
    if audience != expected_audience and (
        not isinstance(audience, list) or expected_audience not in audience
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication audience.",
        )

    subject = payload.get("sub")
    email = payload.get("email")
    name = payload.get("name")
    if not isinstance(subject, str) or not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication claims.",
        )

    return AuthClaims(
        subject=subject,
        email=email.lower(),
        name=name if isinstance(name, str) else None,
    )


def create_backend_jwt(
    *,
    subject: str,
    email: str,
    name: str | None = None,
    expires_at: int | None = None,
) -> str:
    now = int(datetime.now(UTC).timestamp())
    payload: dict[str, Any] = {
        "sub": subject,
        "email": email,
        "name": name,
        "iat": now,
        "exp": expires_at or now + 60 * 60,
        "iss": get_auth_jwt_issuer(),
        "aud": get_auth_jwt_audience(),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _sign(f"{encoded_header}.{encoded_payload}", get_auth_jwt_secret())
    return f"{encoded_header}.{encoded_payload}.{signature}"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = bearer_dependency,
    session: Session = session_dependency,
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    claims = decode_backend_jwt(credentials.credentials)
    user = session.scalars(
        select(User).where(or_(User.auth_subject == claims.subject, User.email == claims.email))
    ).first()

    if user is None:
        user = User(
            email=claims.email,
            full_name=claims.name,
            auth_subject=claims.subject,
        )
        session.add(user)
    else:
        user.email = claims.email
        user.auth_subject = claims.subject
        if claims.name:
            user.full_name = claims.name

    session.commit()
    session.refresh(user)
    return user
