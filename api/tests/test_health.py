from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from starlette.middleware.cors import CORSMiddleware

from applywise import main
from applywise.main import app, health, readiness


class HealthyRedis:
    def ping(self) -> bool:
        return True


def test_health_returns_ok() -> None:
    assert health().status == "ok"


def test_api_allows_the_local_web_origin_for_authenticated_browser_requests() -> None:
    cors = next(
        middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware
    )

    assert "http://localhost:3000" in cors.kwargs["allow_origins"]
    assert cors.kwargs["allow_credentials"] is True
    assert "PUT" in cors.kwargs["allow_methods"]
    assert "Authorization" in cors.kwargs["allow_headers"]


def test_readiness_checks_database_and_redis(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(main, "get_redis_client", lambda: HealthyRedis())

    with Session(engine) as session:
        response = readiness(session=session)

    assert response.status == "ok"
