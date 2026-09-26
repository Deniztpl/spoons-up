from datetime import date, datetime, time
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    Text,
    Time,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TaskStatus(StrEnum):
    PENDING = "PENDING"
    DONE = "DONE"
    DELETED = "DELETED"


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'DONE', 'DELETED')",
            name="status_values",
        ),
        CheckConstraint(
            "block_count > 0 AND block_count * 2 = trunc(block_count * 2)",
            name="block_count_increment",
        ),
        Index("ix_tasks_user_id_scheduled_date", "user_id", "scheduled_date"),
        Index(
            "uq_tasks_goal_rule_occurrence",
            "goal_id",
            "rule_id",
            "occurrence_date",
            unique=True,
            postgresql_where=text("occurrence_date IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    goal_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("goals.id", ondelete="CASCADE"),
    )
    rule_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("goal_rules.id", ondelete="SET NULL"),
    )
    title: Mapped[str] = mapped_column(Text)
    occurrence_date: Mapped[date | None] = mapped_column(Date)
    scheduled_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    block_count: Mapped[Decimal] = mapped_column(
        Numeric(precision=3, scale=1),
        default=Decimal("1.0"),
        server_default="1",
    )
    period_start: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        Text,
        default=TaskStatus.PENDING.value,
        server_default=TaskStatus.PENDING.value,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
