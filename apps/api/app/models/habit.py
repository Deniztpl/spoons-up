from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class HabitMode(StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"


class HabitPeriodType(StrEnum):
    DAY = "DAY"
    WEEK = "WEEK"


class Habit(Base):
    __tablename__ = "habits"
    __table_args__ = (
        CheckConstraint("mode IN ('DAILY', 'WEEKLY')", name="mode_values"),
        Index("ix_habits_user_id_area_id", "user_id", "area_id"),
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
    mode: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class HabitEntry(Base):
    __tablename__ = "habit_entries"
    __table_args__ = (
        CheckConstraint("period_type IN ('DAY', 'WEEK')", name="period_type_values"),
        UniqueConstraint("habit_id", "period_type", "period_start"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    habit_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("habits.id", ondelete="CASCADE"),
    )
    period_type: Mapped[str] = mapped_column(Text)
    period_start: Mapped[date] = mapped_column(Date)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
