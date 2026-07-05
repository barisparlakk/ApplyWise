FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src
COPY tests ./tests

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e ".[dev]"

EXPOSE 8000

CMD ["uvicorn", "applywise.main:app", "--host", "0.0.0.0", "--port", "8000"]
