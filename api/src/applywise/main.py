from fastapi import FastAPI
from pydantic import BaseModel

from applywise.routes.auth import router as auth_router
from applywise.routes.profile import router as profile_router


class HealthResponse(BaseModel):
    status: str


app = FastAPI(title="ApplyWise API", version="0.1.0")
app.include_router(auth_router)
app.include_router(profile_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")
