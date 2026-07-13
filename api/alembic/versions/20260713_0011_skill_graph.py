from __future__ import annotations

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "20260713_0011"
down_revision = "20260713_0010"
branch_labels = None
depends_on = None

SKILLS = {
    "Business Analysis": "business",
    "CI/CD": "delivery",
    "Computer Vision": "ai",
    "Data Analysis": "data",
    "Data Science": "data",
    "Deep Learning": "ai",
    "Docker": "delivery",
    "FastAPI": "backend",
    "Git": "engineering",
    "HTTP": "backend",
    "Image Processing": "ai",
    "Kubernetes": "delivery",
    "Linear Algebra": "foundations",
    "Linux": "engineering",
    "Machine Learning": "ai",
    "Pandas": "data",
    "PostgreSQL": "backend",
    "Python": "programming",
    "SQL": "data",
    "Statistics": "foundations",
    "Testing": "engineering",
}

EDGES = (
    ("Python", "FastAPI"),
    ("HTTP", "FastAPI"),
    ("SQL", "PostgreSQL"),
    ("Python", "Pandas"),
    ("Pandas", "Data Analysis"),
    ("Statistics", "Data Analysis"),
    ("Data Analysis", "Data Science"),
    ("Python", "Machine Learning"),
    ("Statistics", "Machine Learning"),
    ("Linear Algebra", "Machine Learning"),
    ("Machine Learning", "Deep Learning"),
    ("Deep Learning", "Computer Vision"),
    ("Linear Algebra", "Computer Vision"),
    ("Computer Vision", "Image Processing"),
    ("Git", "CI/CD"),
    ("Testing", "CI/CD"),
    ("Linux", "Docker"),
    ("Docker", "Kubernetes"),
    ("SQL", "Business Analysis"),
    ("Data Analysis", "Business Analysis"),
)


def upgrade() -> None:
    op.create_table(
        "skill_prerequisites",
        sa.Column("skill_id", sa.Uuid(), nullable=False),
        sa.Column("prerequisite_skill_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "skill_id <> prerequisite_skill_id",
            name="ck_skill_prerequisites_not_self",
        ),
        sa.ForeignKeyConstraint(["prerequisite_skill_id"], ["skills.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "skill_id",
            "prerequisite_skill_id",
            name="uq_skill_prerequisites_edge",
        ),
    )
    op.create_index(
        op.f("ix_skill_prerequisites_prerequisite_skill_id"),
        "skill_prerequisites",
        ["prerequisite_skill_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_skill_prerequisites_skill_id"),
        "skill_prerequisites",
        ["skill_id"],
        unique=False,
    )

    op.create_table(
        "job_skill_mappings",
        sa.Column("job_post_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.Uuid(), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.Column("target_level", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "job_post_id",
            "skill_id",
            name="uq_job_skill_mappings_job_skill",
        ),
    )
    op.create_index(
        op.f("ix_job_skill_mappings_job_post_id"),
        "job_skill_mappings",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_skill_mappings_skill_id"),
        "job_skill_mappings",
        ["skill_id"],
        unique=False,
    )

    seed_skill_graph()


def seed_skill_graph() -> None:
    connection = op.get_bind()
    now = datetime.now(UTC)
    for name, category in SKILLS.items():
        connection.execute(
            sa.text(
                "INSERT INTO skills (id, name, category, created_at, updated_at) "
                "VALUES (:id, :name, :category, :created_at, :updated_at) "
                "ON CONFLICT (name) DO NOTHING"
            ),
            {
                "id": skill_uuid(name),
                "name": name,
                "category": category,
                "created_at": now,
                "updated_at": now,
            },
        )
    for prerequisite, skill in EDGES:
        connection.execute(
            sa.text(
                "INSERT INTO skill_prerequisites "
                "(id, skill_id, prerequisite_skill_id, created_at, updated_at) "
                "SELECT :id, target.id, prerequisite.id, :created_at, :updated_at "
                "FROM skills AS target CROSS JOIN skills AS prerequisite "
                "WHERE target.name = :skill AND prerequisite.name = :prerequisite "
                "ON CONFLICT (skill_id, prerequisite_skill_id) DO NOTHING"
            ),
            {
                "id": edge_uuid(prerequisite, skill),
                "skill": skill,
                "prerequisite": prerequisite,
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_job_skill_mappings_skill_id"), table_name="job_skill_mappings")
    op.drop_index(op.f("ix_job_skill_mappings_job_post_id"), table_name="job_skill_mappings")
    op.drop_table("job_skill_mappings")
    op.drop_index(
        op.f("ix_skill_prerequisites_skill_id"),
        table_name="skill_prerequisites",
    )
    op.drop_index(
        op.f("ix_skill_prerequisites_prerequisite_skill_id"),
        table_name="skill_prerequisites",
    )
    op.drop_table("skill_prerequisites")


def skill_uuid(name: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"https://applywise.dev/skills/{name.casefold()}")


def edge_uuid(prerequisite: str, skill: str) -> uuid.UUID:
    return uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"https://applywise.dev/skill-edges/{prerequisite.casefold()}->{skill.casefold()}",
    )
