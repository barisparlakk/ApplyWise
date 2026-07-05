from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.auth import create_backend_jwt, decode_backend_jwt, get_current_user
from applywise.models import Base, User


def test_decode_backend_jwt_validates_claims() -> None:
    token = create_backend_jwt(
        subject="email:ada@example.com",
        email="ada@example.com",
        name="Ada Lovelace",
    )

    claims = decode_backend_jwt(token)

    assert claims.subject == "email:ada@example.com"
    assert claims.email == "ada@example.com"
    assert claims.name == "Ada Lovelace"


def test_decode_backend_jwt_rejects_expired_token() -> None:
    expired_at = int((datetime.now(UTC) - timedelta(minutes=1)).timestamp())
    token = create_backend_jwt(
        subject="email:ada@example.com",
        email="ada@example.com",
        expires_at=expired_at,
    )

    with pytest.raises(HTTPException):
        decode_backend_jwt(token)


def test_current_user_auto_provisions_user() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    token = create_backend_jwt(
        subject="email:ada@example.com",
        email="ada@example.com",
        name="Ada Lovelace",
    )

    with Session(engine) as session:
        user = get_current_user(
            credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
            session=session,
        )
        saved_user = session.get(User, user.id)

    assert saved_user is not None
    assert saved_user.email == "ada@example.com"
    assert saved_user.auth_subject == "email:ada@example.com"
