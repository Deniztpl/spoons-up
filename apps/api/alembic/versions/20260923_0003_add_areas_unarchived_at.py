"""Add the area unarchive timestamp.

Revision ID: 20260923_0003
Revises: 20260922_0002
Create Date: 2026-09-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0003"
down_revision: str | Sequence[str] | None = "20260922_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "areas",
        sa.Column("unarchived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("areas", "unarchived_at")
