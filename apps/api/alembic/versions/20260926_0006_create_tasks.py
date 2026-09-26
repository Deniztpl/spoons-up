"""Create tasks and add users.last_seen_at.

Revision ID: 20260926_0006
Revises: 20260926_0005
Create Date: 2026-09-26

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0006"
down_revision: str | Sequence[str] | None = "20260926_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("goal_id", sa.BigInteger(), nullable=True),
        sa.Column("rule_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column(
            "block_count",
            sa.Numeric(precision=3, scale=1),
            server_default=sa.text("1"),
            nullable=False,
        ),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Text(),
            server_default=sa.text("'PENDING'"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'DONE', 'DELETED')",
            name=op.f("ck_tasks_status_values"),
        ),
        sa.CheckConstraint(
            "block_count > 0 AND block_count * 2 = trunc(block_count * 2)",
            name=op.f("ck_tasks_block_count_increment"),
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["goals.id"],
            name=op.f("fk_tasks_goal_id_goals"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["goal_rules.id"],
            name=op.f("fk_tasks_rule_id_goal_rules"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_tasks_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(
        "ix_tasks_user_id_scheduled_date",
        "tasks",
        ["user_id", "scheduled_date"],
        unique=False,
    )
    op.create_index(
        "uq_tasks_goal_rule_occurrence",
        "tasks",
        ["goal_id", "rule_id", "occurrence_date"],
        unique=True,
        postgresql_where=sa.text("occurrence_date IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_tasks_goal_rule_occurrence", table_name="tasks")
    op.drop_index("ix_tasks_user_id_scheduled_date", table_name="tasks")
    op.drop_table("tasks")
    op.drop_column("users", "last_seen_at")
