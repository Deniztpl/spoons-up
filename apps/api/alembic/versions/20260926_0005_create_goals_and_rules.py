"""Create goals and goal rules.

Revision ID: 20260926_0005
Revises: 20260924_0004
Create Date: 2026-09-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260926_0005"
down_revision: str | Sequence[str] | None = "20260924_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("area_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("weekly_target", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "weekly_target IS NULL OR weekly_target >= 1",
            name=op.f("ck_goals_weekly_target_positive"),
        ),
        sa.ForeignKeyConstraint(
            ["area_id"],
            ["areas.id"],
            name=op.f("fk_goals_area_id_areas"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_goals_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goals")),
    )
    op.create_index(
        "ix_goals_user_id_area_id",
        "goals",
        ["user_id", "area_id"],
        unique=False,
    )
    op.create_table(
        "goal_rules",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("goal_id", sa.BigInteger(), nullable=False),
        sa.Column("byweekday", postgresql.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "block_count",
            sa.Numeric(precision=3, scale=1),
            server_default=sa.text("1"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "cardinality(byweekday) BETWEEN 1 AND 7",
            name=op.f("ck_goal_rules_byweekday_size"),
        ),
        sa.CheckConstraint(
            "byweekday <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]",
            name=op.f("ck_goal_rules_byweekday_values"),
        ),
        sa.CheckConstraint(
            "duration_minutes >= 1",
            name=op.f("ck_goal_rules_duration_minutes_positive"),
        ),
        sa.CheckConstraint(
            "block_count > 0 AND block_count * 2 = trunc(block_count * 2)",
            name=op.f("ck_goal_rules_block_count_increment"),
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["goals.id"],
            name=op.f("fk_goal_rules_goal_id_goals"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_rules")),
    )


def downgrade() -> None:
    op.drop_table("goal_rules")
    op.drop_index("ix_goals_user_id_area_id", table_name="goals")
    op.drop_table("goals")
