from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from applywise.settings import validate_runtime_environment


def main() -> None:
    validate_runtime_environment()
    config = Config(str(Path.cwd() / "alembic.ini"))
    command.upgrade(config, "head")


if __name__ == "__main__":
    main()
