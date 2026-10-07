from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint(
            "weekly_target IS NULL OR weekly_target >= 1",
            name="weekly_target_positive",
        ),
        Index("ix_goals_user_id_area_id", "user_id", "area_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    area_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("areas.id", ondelete="CASCADE"),
    )
    title: Mapped[str] = mapped_column(Text)
    weekly_target: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    rules: Mapped[list[GoalRule]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="GoalRule.id",
    )


class GoalRule(Base):
    __tablename__ = "goal_rules"
    __table_args__ = (
        CheckConstraint(
            "cardinality(byweekday) BETWEEN 1 AND 7",
            name="byweekday_size",
        ),
        CheckConstraint(
            "byweekday <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]",
            name="byweekday_values",
        ),
        CheckConstraint(
            "duration_minutes BETWEEN 15 AND 1440 AND duration_minutes % 15 = 0",
            name="duration_minutes_steps",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    goal_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("goals.id", ondelete="CASCADE"),
    )
    byweekday: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))
    start_time: Mapped[time | None] = mapped_column(Time)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    goal: Mapped[Goal] = relationship(back_populates="rules")
