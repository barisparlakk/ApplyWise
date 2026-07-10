from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import User

router = APIRouter(prefix="/auth", tags=["auth"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


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


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> Response:
    session.delete(current_user)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
