import os

from fastapi import FastAPI
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from applywise.routes.applications import router as applications_router
from applywise.routes.auth import router as auth_router
from applywise.routes.github import router as github_router
from applywise.routes.interview_prep import router as interview_prep_router
from applywise.routes.jobs import router as jobs_router
from applywise.routes.profile import router as profile_router
from applywise.routes.resume import router as resume_router
from applywise.routes.roadmap import router as roadmap_router


class HealthResponse(BaseModel):
    status: str


app = FastAPI(title="ApplyWise API", version="0.1.0")
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
app.include_router(applications_router)
app.include_router(auth_router)
app.include_router(github_router)
app.include_router(interview_prep_router)
app.include_router(jobs_router)
app.include_router(profile_router)
app.include_router(roadmap_router)
app.include_router(resume_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")
