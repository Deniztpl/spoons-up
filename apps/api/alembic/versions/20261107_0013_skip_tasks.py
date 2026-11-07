"""Tell a session This and following skipped from one the user deleted.

Revision ID: 20261107_0013
Revises: 20261007_0012
Create Date: 2026-11-07

"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261107_0013"
down_revision: str | Sequence[str] | None = "20261007_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_tasks_status_values"), "tasks", type_="check")
    op.create_check_constraint(
        op.f("ck_tasks_status_values"),
        "tasks",
        "status IN ('PENDING', 'DONE', 'DELETED', 'SKIPPED')",
    )


def downgrade() -> None:
    # Generation leaves a deleted session out the same way, so skipped ones become deleted.
    op.execute("UPDATE tasks SET status = 'DELETED' WHERE status = 'SKIPPED'")
    op.drop_constraint(op.f("ck_tasks_status_values"), "tasks", type_="check")
    op.create_check_constraint(
        op.f("ck_tasks_status_values"),
        "tasks",
        "status IN ('PENDING', 'DONE', 'DELETED')",
    )
