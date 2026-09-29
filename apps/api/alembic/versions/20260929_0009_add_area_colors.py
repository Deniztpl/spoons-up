"""Add areas.color.

Revision ID: 20260929_0009
Revises: 20260929_0008
Create Date: 2026-09-29

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260929_0009"
down_revision: str | Sequence[str] | None = "20260929_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLORS = ("SLATE", "GREEN", "BROWN", "STEEL", "CLAY", "PLUM", "TEAL", "ROSE")


def upgrade() -> None:
    op.add_column("areas", sa.Column("color", sa.Text(), nullable=True))
    # Existing areas take the palette in the order each user created them.
    palette = ", ".join(f"'{color}'" for color in COLORS)
    op.execute(
        f"""
        UPDATE areas
        SET color = (ARRAY[{palette}])[((ranked.position - 1) % {len(COLORS)} + 1)::int]
        FROM (
            SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS position
            FROM areas
        ) AS ranked
        WHERE areas.id = ranked.id
        """
    )
    op.alter_column("areas", "color", nullable=False)
    op.create_check_constraint(
        op.f("ck_areas_color_values"),
        "areas",
        f"color IN ({palette})",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_areas_color_values"), "areas", type_="check")
    op.drop_column("areas", "color")
