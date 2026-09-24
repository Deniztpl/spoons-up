"""Create habits and habit entries.

Revision ID: 20260924_0004
Revises: 20260923_0003
Create Date: 2026-09-24

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0004"
down_revision: str | Sequence[str] | None = "20260923_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "habits",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("area_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("mode", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "mode IN ('DAILY', 'WEEKLY')",
            name=op.f("ck_habits_mode_values"),
        ),
        sa.ForeignKeyConstraint(
            ["area_id"],
            ["areas.id"],
            name=op.f("fk_habits_area_id_areas"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_habits_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habits")),
    )
    op.create_index(
        "ix_habits_user_id_area_id",
        "habits",
        ["user_id", "area_id"],
        unique=False,
    )
    op.create_table(
        "habit_entries",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("habit_id", sa.BigInteger(), nullable=False),
        sa.Column("period_type", sa.Text(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "period_type IN ('DAY', 'WEEK')",
            name=op.f("ck_habit_entries_period_type_values"),
        ),
        sa.ForeignKeyConstraint(
            ["habit_id"],
            ["habits.id"],
            name=op.f("fk_habit_entries_habit_id_habits"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habit_entries")),
        sa.UniqueConstraint(
            "habit_id",
            "period_type",
            "period_start",
            name=op.f("uq_habit_entries_habit_id"),
        ),
    )


def downgrade() -> None:
    op.drop_table("habit_entries")
    op.drop_index("ix_habits_user_id_area_id", table_name="habits")
    op.drop_table("habits")
