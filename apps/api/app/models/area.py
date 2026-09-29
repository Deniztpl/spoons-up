from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AreaColor(StrEnum):
    SLATE = "SLATE"
    GREEN = "GREEN"
    BROWN = "BROWN"
    STEEL = "STEEL"
    CLAY = "CLAY"
    PLUM = "PLUM"
    TEAL = "TEAL"
    ROSE = "ROSE"


class Area(Base):
    __tablename__ = "areas"
    __table_args__ = (
        UniqueConstraint("user_id", "name"),
        CheckConstraint(
            "color IN ('SLATE', 'GREEN', 'BROWN', 'STEEL', 'CLAY', 'PLUM', 'TEAL', 'ROSE')",
            name="color_values",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(Text)
    # Given at creation; the area's goals, habits and tasks are drawn in it.
    color: Mapped[str] = mapped_column(Text)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unarchived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
