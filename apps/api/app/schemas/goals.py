from datetime import datetime, time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_serializer, field_validator


def _strip_title(value: str) -> str:
    return value.strip()


def _normalize_weekdays(value: list[int]) -> list[int]:
    if len(set(value)) != len(value):
        raise ValueError("Weekdays must be unique")
    return sorted(value)


def _reject_timezone(value: time) -> time:
    if value.tzinfo is not None:
        raise ValueError("Time must not include a timezone")
    return value


GoalTitle = Annotated[
    str,
    AfterValidator(_strip_title),
    Field(min_length=1),
]
ResourceId = Annotated[str, Field(pattern=r"^[0-9]+$")]
WeeklyTarget = Annotated[int, Field(ge=1)]
Weekday = Annotated[int, Field(ge=1, le=7)]
Weekdays = Annotated[
    list[Weekday],
    Field(min_length=1, max_length=7),
    AfterValidator(_normalize_weekdays),
]
DurationMinutes = Annotated[int, Field(ge=1)]
LocalTime = Annotated[time, AfterValidator(_reject_timezone)]
BlockCount = Annotated[float, Field(gt=0, le=99.5, multiple_of=0.5)]


class CreateGoalRequest(BaseModel):
    area_id: ResourceId
    title: GoalTitle
    weekly_target: WeeklyTarget | None = None


class UpdateGoalRequest(BaseModel):
    area_id: ResourceId | None = None
    title: GoalTitle | None = None
    weekly_target: WeeklyTarget | None = None

    @field_validator("area_id", "title")
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class CreateGoalRuleRequest(BaseModel):
    byweekday: Weekdays
    start_time: LocalTime
    duration_minutes: DurationMinutes
    block_count: BlockCount = 1


class UpdateGoalRuleRequest(BaseModel):
    byweekday: Weekdays | None = None
    start_time: LocalTime | None = None
    duration_minutes: DurationMinutes | None = None
    block_count: BlockCount | None = None

    @field_validator("byweekday", "start_time", "duration_minutes", "block_count")
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class GoalRuleResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    id: str
    goal_id: str
    byweekday: list[int]
    start_time: time
    duration_minutes: int
    block_count: float

    @field_serializer("start_time")
    def serialize_start_time(self, value: time) -> str:
        return value.strftime("%H:%M")


class GoalResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    id: str
    area_id: str
    title: str
    weekly_target: int | None
    created_at: datetime
    rules: list[GoalRuleResponse]


class GoalListResponse(BaseModel):
    goals: list[GoalResponse]
