from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.auth import create_backend_jwt, decode_backend_jwt, get_current_user
from applywise.models import Base, JobPost, Profile, User
from applywise.routes.auth import delete_current_user


def test_decode_backend_jwt_validates_claims() -> None:
    token = create_backend_jwt(
        subject="email:ada@example.com",
        email="ada@example.com",
        name="Ada Lovelace",
        github_access_token="github-token",
    )

    claims = decode_backend_jwt(token)

    assert claims.subject == "email:ada@example.com"
    assert claims.email == "ada@example.com"
    assert claims.name == "Ada Lovelace"
    assert claims.github_access_token == "github-token"


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


def test_delete_current_user_removes_owned_workspace_data() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="delete@example.com", full_name="Delete User")
        session.add(user)
        session.flush()
        session.add(Profile(user_id=user.id, skills=[], target_roles=[], languages=[]))
        session.add(
            JobPost(
                user_id=user.id,
                company_name="Example",
                title="Backend Intern",
                description="A job description",
            )
        )
        session.commit()
        user_id = user.id

        response = delete_current_user(current_user=user, session=session)

        assert response.status_code == 204
        assert session.get(User, user_id) is None
        assert session.query(Profile).count() == 0
        assert session.query(JobPost).count() == 0
