from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RequirementType(StrEnum):
    GOAL = "GOAL"
    HABIT = "HABIT"


class PeriodResult(Base):
    __tablename__ = "period_results"
    __table_args__ = (
        CheckConstraint("ref_type IN ('GOAL', 'HABIT')", name="ref_type_values"),
        UniqueConstraint("ref_type", "ref_id", "period_start"),
        Index("ix_period_results_user_id_period_start", "user_id", "period_start"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    # Rows outlive their area; deleting it only clears the link.
    area_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("areas.id", ondelete="SET NULL"),
    )
    period_start: Mapped[date] = mapped_column(Date)
    ref_type: Mapped[str] = mapped_column(Text)
    # Not a foreign key: the habit or goal may be deleted while its weeks stay.
    ref_id: Mapped[int] = mapped_column(BigInteger)
    title: Mapped[str] = mapped_column(Text)
    target: Mapped[int] = mapped_column(Integer)
    done: Mapped[Decimal] = mapped_column(Numeric(precision=5, scale=1))
