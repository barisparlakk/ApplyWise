from __future__ import annotations

from sqlalchemy.orm import Session

from applywise.repositories import Repositories


class ApplyWiseService:
    def __init__(self, session: Session) -> None:
        self.repositories = Repositories(session)
