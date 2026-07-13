from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.auth import create_backend_jwt, decode_backend_jwt, get_current_user
from applywise.models import Base, JobPost, Profile, User
from applywise.routes.auth import delete_current_user, export_current_user_data


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
    assert claims.email_verified is True
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


def test_unverified_email_token_is_rejected() -> None:
    token = create_backend_jwt(
        subject="github:123",
        email="unverified@example.com",
        email_verified=False,
    )

    with pytest.raises(HTTPException, match="verified email"):
        decode_backend_jwt(token)


def test_different_subject_cannot_take_over_existing_email() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    token = create_backend_jwt(
        subject="github:attacker",
        email="owner@example.com",
    )

    with Session(engine) as session:
        owner = User(
            email="owner@example.com",
            full_name="Owner",
            auth_subject="google:owner",
        )
        session.add(owner)
        session.commit()

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(
                credentials=HTTPAuthorizationCredentials(
                    scheme="Bearer",
                    credentials=token,
                ),
                session=session,
            )

        session.refresh(owner)

    assert exc_info.value.status_code == 409
    assert owner.auth_subject == "google:owner"


def test_verified_subject_can_claim_legacy_user_without_subject() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    token = create_backend_jwt(
        subject="google:legacy",
        email="legacy@example.com",
        name="Legacy User",
    )

    with Session(engine) as session:
        legacy_user = User(email="legacy@example.com", auth_subject=None)
        session.add(legacy_user)
        session.commit()

        resolved = get_current_user(
            credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
            session=session,
        )

    assert resolved.id == legacy_user.id
    assert resolved.auth_subject == "google:legacy"


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


def test_export_current_user_data_excludes_credentials_and_vectors() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(
            email="export@example.com",
            full_name="Export User",
            auth_subject="google:export",
        )
        session.add(user)
        session.flush()
        session.add(
            Profile(
                user_id=user.id,
                skills=["Python"],
                target_roles=["Backend Intern"],
                languages=[],
            )
        )
        session.add(
            JobPost(
                user_id=user.id,
                company_name="Example",
                title="Backend Intern",
                description="Build APIs",
                embedding=[0.1, 0.2],
                embedding_model="test-model",
            )
        )
        session.commit()

        response = export_current_user_data(current_user=user)
        payload = json.loads(response.body)

    assert response.headers["cache-control"] == "no-store"
    assert payload["account"]["email"] == "export@example.com"
    assert "auth_subject" not in payload["account"]
    assert payload["profile"]["skills"] == ["Python"]
    assert payload["job_posts"][0]["description"] == "Build APIs"
    assert "embedding" not in payload["job_posts"][0]
    assert "embedding_model" not in payload["job_posts"][0]
