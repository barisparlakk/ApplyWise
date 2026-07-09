FROM python:3.11-slim AS runtime-base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY pyproject.toml ./
COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

FROM runtime-base AS development

COPY tests ./tests

RUN pip install --no-cache-dir -e ".[dev]"

EXPOSE 8000

CMD ["uvicorn", "applywise.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM runtime-base AS production

RUN groupadd --system --gid 1001 applywise \
    && useradd --system --uid 1001 --gid applywise applywise

USER applywise

EXPOSE 8000

CMD ["sh", "-c", "uvicorn applywise.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2}"]
