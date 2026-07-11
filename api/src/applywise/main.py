import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from applywise.database import get_session
from applywise.middleware import RequestBoundaryMiddleware
from applywise.redis_client import get_redis_client
from applywise.routes.applications import router as applications_router
from applywise.routes.auth import router as auth_router
from applywise.routes.github import router as github_router
from applywise.routes.interview_prep import router as interview_prep_router
from applywise.routes.jobs import router as jobs_router
from applywise.routes.onboarding import router as onboarding_router
from applywise.routes.profile import router as profile_router
from applywise.routes.resume import router as resume_router
from applywise.routes.roadmap import router as roadmap_router
from applywise.settings import (
    allowed_hosts,
    is_production,
    max_request_body_bytes,
    validate_runtime_environment,
)


class HealthResponse(BaseModel):
    status: str


session_dependency = Depends(get_session)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    validate_runtime_environment()
    yield


app = FastAPI(
    title="ApplyWise API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if is_production() else "/docs",
    redoc_url=None if is_production() else "/redoc",
    openapi_url=None if is_production() else "/openapi.json",
)
app.add_middleware(RequestBoundaryMiddleware, max_body_bytes=max_request_body_bytes())
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts())
app.include_router(applications_router)
app.include_router(auth_router)
app.include_router(github_router)
app.include_router(interview_prep_router)
app.include_router(jobs_router)
app.include_router(onboarding_router)
app.include_router(profile_router)
app.include_router(roadmap_router)
app.include_router(resume_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/ready", response_model=HealthResponse)
def readiness(session: Session = session_dependency) -> HealthResponse:
    try:
        session.execute(text("SELECT 1"))
        get_redis_client().ping()
    except (SQLAlchemyError, RedisError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ApplyWise dependencies are unavailable.",
        ) from exc
    return HealthResponse(status="ok")
