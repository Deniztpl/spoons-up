"""Add Journal task fields and schedule rules.

Revision ID: 20260930_0010
Revises: 20260929_0009
Create Date: 2026-09-30

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260930_0010"
down_revision: str | Sequence[str] | None = "20260929_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("parent_id", sa.BigInteger(), nullable=True))
    op.add_column("tasks", sa.Column("due_date", sa.Date(), nullable=True))
    op.alter_column("tasks", "scheduled_date", existing_type=sa.Date(), nullable=True)
    op.alter_column("tasks", "period_start", existing_type=sa.Date(), nullable=True)

    op.create_foreign_key(
        op.f("fk_tasks_parent_id_tasks"),
        "tasks",
        "tasks",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        op.f("ck_tasks_goal_requires_schedule"),
        "tasks",
        "goal_id IS NULL OR scheduled_date IS NOT NULL",
    )
    op.create_check_constraint(
        op.f("ck_tasks_schedule_period_nullity"),
        "tasks",
        "(scheduled_date IS NULL) = (period_start IS NULL)",
    )
    op.create_check_constraint(
        op.f("ck_tasks_time_requires_schedule"),
        "tasks",
        "start_time IS NULL OR scheduled_date IS NOT NULL",
    )
    op.create_check_constraint(
        op.f("ck_tasks_due_top_level_journal"),
        "tasks",
        "due_date IS NULL OR (goal_id IS NULL AND parent_id IS NULL)",
    )
    op.create_check_constraint(
        op.f("ck_tasks_parent_goal_less"),
        "tasks",
        "parent_id IS NULL OR goal_id IS NULL",
    )
    op.create_index(
        op.f("ix_tasks_parent_id"),
        "tasks",
        ["parent_id"],
        unique=False,
        postgresql_where=sa.text("parent_id IS NOT NULL"),
    )


def downgrade() -> None:
    # The previous schema cannot represent undated Journal work. Deleting a
    # top-level row here also removes its steps through the still-active FK.
    op.execute("DELETE FROM tasks WHERE scheduled_date IS NULL")

    op.drop_index(op.f("ix_tasks_parent_id"), table_name="tasks")
    op.drop_constraint(op.f("ck_tasks_parent_goal_less"), "tasks", type_="check")
    op.drop_constraint(op.f("ck_tasks_due_top_level_journal"), "tasks", type_="check")
    op.drop_constraint(op.f("ck_tasks_time_requires_schedule"), "tasks", type_="check")
    op.drop_constraint(op.f("ck_tasks_schedule_period_nullity"), "tasks", type_="check")
    op.drop_constraint(op.f("ck_tasks_goal_requires_schedule"), "tasks", type_="check")
    op.drop_constraint(op.f("fk_tasks_parent_id_tasks"), "tasks", type_="foreignkey")

    op.alter_column("tasks", "period_start", existing_type=sa.Date(), nullable=False)
    op.alter_column("tasks", "scheduled_date", existing_type=sa.Date(), nullable=False)
    op.drop_column("tasks", "due_date")
    op.drop_column("tasks", "parent_id")
