from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.models import HabitMode, HabitPeriodType


def _strip_title(value: str) -> str:
    return value.strip()


HabitTitle = Annotated[
    str,
    AfterValidator(_strip_title),
    Field(min_length=1),
]
ResourceId = Annotated[str, Field(pattern=r"^[0-9]+$")]


class CreateHabitRequest(BaseModel):
    area_id: ResourceId
    title: HabitTitle
    mode: HabitMode


class UpdateHabitRequest(BaseModel):
    area_id: ResourceId | None = None
    title: HabitTitle | None = None
    mode: HabitMode | None = None

    @field_validator("area_id", "title", "mode")
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class CheckHabitRequest(BaseModel):
    date: date


class HabitResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    id: str
    area_id: str
    title: str
    mode: HabitMode
    created_at: datetime


class HabitListResponse(BaseModel):
    habits: list[HabitResponse]


class HabitEntryResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    habit_id: str
    period_type: HabitPeriodType
    period_start: date
    completed_at: datetime
