from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260713_0008"
down_revision = "20260706_0007"
branch_labels = None
depends_on = None

EMBEDDING_TABLES = (
    "resumes",
    "resume_chunks",
    "github_repository_chunks",
    "job_posts",
)

EMBEDDING_INDEXES = {
    "resumes": "ix_resumes_embedding_hnsw",
    "resume_chunks": "ix_resume_chunks_embedding_hnsw",
    "github_repository_chunks": "ix_github_repository_chunks_embedding_hnsw",
    "job_posts": "ix_job_posts_embedding_hnsw",
}


def upgrade() -> None:
    for table_name in EMBEDDING_TABLES:
        op.add_column(
            table_name,
            sa.Column("embedding_model", sa.String(length=255), nullable=True),
        )
        # Legacy vectors were produced by a lexical hash and cannot be compared with
        # the multilingual semantic model selected for the free beta.
        op.execute(sa.text(f"UPDATE {table_name} SET embedding = NULL"))

    for table_name, index_name in EMBEDDING_INDEXES.items():
        op.execute(
            sa.text(
                f"CREATE INDEX {index_name} ON {table_name} "
                "USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL"
            )
        )


def downgrade() -> None:
    for _table_name, index_name in EMBEDDING_INDEXES.items():
        op.execute(sa.text(f"DROP INDEX IF EXISTS {index_name}"))

    for table_name in reversed(EMBEDDING_TABLES):
        op.drop_column(table_name, "embedding_model")
