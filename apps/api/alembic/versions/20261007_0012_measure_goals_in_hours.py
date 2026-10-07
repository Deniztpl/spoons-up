"""Measure goal work in hours instead of blocks.

Revision ID: 20261007_0012
Revises: 20260930_0011
Create Date: 2026-10-07

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261007_0012"
down_revision: str | Sequence[str] | None = "20260930_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DURATION_STEPS = "duration_minutes BETWEEN 15 AND 1440 AND duration_minutes % 15 = 0"
BLOCK_INCREMENT = "block_count > 0 AND block_count * 2 = trunc(block_count * 2)"


def upgrade() -> None:
    # One block reads as one hour. A rule or goal task without a duration takes its
    # blocks, or one hour when it has none; Journal blocks are dropped.
    op.execute(
        """
        UPDATE goal_rules
        SET duration_minutes = COALESCE((block_count * 60)::integer, 60)
        WHERE duration_minutes IS NULL
        """
    )
    op.execute(
        """
        UPDATE tasks
        SET duration_minutes = COALESCE((block_count * 60)::integer, 60)
        WHERE duration_minutes IS NULL AND goal_id IS NOT NULL
        """
    )
    # Durations move in 15-minute steps up to a day.
    for table in ("goal_rules", "tasks"):
        op.execute(
            f"""
            UPDATE {table}
            SET duration_minutes = LEAST(1440, GREATEST(15, ((duration_minutes + 14) / 15) * 15))
            WHERE duration_minutes IS NOT NULL
              AND NOT ({DURATION_STEPS})
            """
        )
    op.execute(
        """
        UPDATE tasks
        SET end_time = start_time + duration_minutes * INTERVAL '1 minute'
        WHERE start_time IS NOT NULL AND duration_minutes IS NOT NULL
        """
    )

    for table in ("goal_rules", "tasks"):
        op.drop_constraint(op.f(f"ck_{table}_block_count_increment"), table, type_="check")
        op.drop_constraint(op.f(f"ck_{table}_duration_minutes_positive"), table, type_="check")
        op.drop_column(table, "block_count")
        op.create_check_constraint(
            op.f(f"ck_{table}_duration_minutes_steps"), table, DURATION_STEPS
        )

    op.alter_column("goal_rules", "duration_minutes", existing_type=sa.Integer(), nullable=False)
    op.create_check_constraint(
        op.f("ck_tasks_goal_requires_duration"),
        "tasks",
        "goal_id IS NULL OR duration_minutes IS NOT NULL",
    )
    op.alter_column(
        "period_results",
        "done",
        existing_type=sa.Numeric(precision=5, scale=1),
        type_=sa.Numeric(precision=6, scale=2),
    )


def downgrade() -> None:
    op.alter_column(
        "period_results",
        "done",
        existing_type=sa.Numeric(precision=6, scale=2),
        type_=sa.Numeric(precision=5, scale=1),
    )
    op.drop_constraint(op.f("ck_tasks_goal_requires_duration"), "tasks", type_="check")
    op.alter_column("goal_rules", "duration_minutes", existing_type=sa.Integer(), nullable=True)

    for table in ("goal_rules", "tasks"):
        op.drop_constraint(op.f(f"ck_{table}_duration_minutes_steps"), table, type_="check")
        op.add_column(
            table,
            sa.Column("block_count", sa.Numeric(precision=3, scale=1), nullable=True),
        )
        op.create_check_constraint(
            op.f(f"ck_{table}_block_count_increment"),
            table,
            BLOCK_INCREMENT,
        )
        op.create_check_constraint(
            op.f(f"ck_{table}_duration_minutes_positive"),
            table,
            "duration_minutes >= 1",
        )

    # Hours become blocks again, to the nearest half block.
    op.execute(
        """
        UPDATE goal_rules
        SET block_count = GREATEST(0.5, LEAST(99.5, round(duration_minutes / 30.0) / 2))
        """
    )
    op.execute(
        """
        UPDATE tasks
        SET block_count = GREATEST(0.5, LEAST(99.5, round(duration_minutes / 30.0) / 2))
        WHERE goal_id IS NOT NULL
        """
    )
