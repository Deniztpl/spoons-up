"""Add a priority to top-level Journal items.

Revision ID: 20260930_0011
Revises: 20260930_0010
Create Date: 2026-09-30

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260930_0011"
down_revision: str | Sequence[str] | None = "20260930_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("priority", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("ck_tasks_priority_values"),
        "tasks",
        "priority IS NULL OR priority IN ('HIGH', 'MEDIUM', 'LOW')",
    )
    op.create_check_constraint(
        op.f("ck_tasks_priority_top_level_journal"),
        "tasks",
        "priority IS NULL OR (goal_id IS NULL AND parent_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_tasks_priority_top_level_journal"), "tasks", type_="check")
    op.drop_constraint(op.f("ck_tasks_priority_values"), "tasks", type_="check")
    op.drop_column("tasks", "priority")
