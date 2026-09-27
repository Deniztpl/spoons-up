"""Make task schedule values optional.

Revision ID: 20260927_0007
Revises: 20260926_0006
Create Date: 2026-09-27

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260927_0007"
down_revision: str | Sequence[str] | None = "20260926_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("goal_rules", "start_time", existing_type=sa.Time(), nullable=True)
    op.alter_column(
        "goal_rules",
        "duration_minutes",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "goal_rules",
        "block_count",
        existing_type=sa.Numeric(precision=3, scale=1),
        server_default=None,
        nullable=True,
    )

    op.add_column("tasks", sa.Column("duration_minutes", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE tasks
        SET duration_minutes =
            (EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::integer
            + CASE WHEN end_time <= start_time THEN 1440 ELSE 0 END
        """
    )
    op.create_check_constraint(
        op.f("ck_tasks_duration_minutes_positive"),
        "tasks",
        "duration_minutes >= 1",
    )
    op.alter_column("tasks", "start_time", existing_type=sa.Time(), nullable=True)
    op.alter_column("tasks", "end_time", existing_type=sa.Time(), nullable=True)
    op.alter_column(
        "tasks",
        "block_count",
        existing_type=sa.Numeric(precision=3, scale=1),
        server_default=None,
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE tasks
        SET start_time = COALESCE(start_time, TIME '00:00'),
            end_time = COALESCE(end_time, start_time, TIME '00:00'),
            block_count = COALESCE(block_count, 1)
        """
    )
    op.alter_column("tasks", "start_time", existing_type=sa.Time(), nullable=False)
    op.alter_column("tasks", "end_time", existing_type=sa.Time(), nullable=False)
    op.alter_column(
        "tasks",
        "block_count",
        existing_type=sa.Numeric(precision=3, scale=1),
        server_default=sa.text("1"),
        nullable=False,
    )
    op.drop_constraint(
        op.f("ck_tasks_duration_minutes_positive"),
        "tasks",
        type_="check",
    )
    op.drop_column("tasks", "duration_minutes")

    op.execute(
        """
        UPDATE goal_rules
        SET start_time = COALESCE(start_time, TIME '00:00'),
            duration_minutes = COALESCE(duration_minutes, 60),
            block_count = COALESCE(block_count, 1)
        """
    )
    op.alter_column("goal_rules", "start_time", existing_type=sa.Time(), nullable=False)
    op.alter_column(
        "goal_rules",
        "duration_minutes",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "goal_rules",
        "block_count",
        existing_type=sa.Numeric(precision=3, scale=1),
        server_default=sa.text("1"),
        nullable=False,
    )
