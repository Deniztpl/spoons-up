"""Create period_results and add users.last_frozen_week.

Revision ID: 20260929_0008
Revises: 20260927_0007
Create Date: 2026-09-29

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260929_0008"
down_revision: str | Sequence[str] | None = "20260927_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_frozen_week", sa.Date(), nullable=True))
    op.create_table(
        "period_results",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("area_id", sa.BigInteger(), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("ref_type", sa.Text(), nullable=False),
        sa.Column("ref_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("target", sa.Integer(), nullable=False),
        sa.Column("done", sa.Numeric(precision=5, scale=1), nullable=False),
        sa.CheckConstraint(
            "ref_type IN ('GOAL', 'HABIT')",
            name=op.f("ck_period_results_ref_type_values"),
        ),
        sa.ForeignKeyConstraint(
            ["area_id"],
            ["areas.id"],
            name=op.f("fk_period_results_area_id_areas"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_period_results_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_period_results")),
        sa.UniqueConstraint(
            "ref_type",
            "ref_id",
            "period_start",
            name=op.f("uq_period_results_ref_type"),
        ),
    )
    op.create_index(
        "ix_period_results_user_id_period_start",
        "period_results",
        ["user_id", "period_start"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_period_results_user_id_period_start", table_name="period_results")
    op.drop_table("period_results")
    op.drop_column("users", "last_frozen_week")
