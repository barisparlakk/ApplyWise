from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from applywise.auth import get_current_user
from applywise.models import User

router = APIRouter(prefix="/auth", tags=["auth"])
current_user_dependency = Depends(get_current_user)


class CurrentUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: User = current_user_dependency) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
    )
