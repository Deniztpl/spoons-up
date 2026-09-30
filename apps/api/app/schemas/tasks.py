from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
)

from app.schemas.goals import Weekdays


def _strip_title(value: str) -> str:
    return value.strip()


def _reject_timezone(value: time) -> time:
    if value.tzinfo is not None:
        raise ValueError("Time must not include a timezone")
    return value


TaskTitle = Annotated[
    str,
    AfterValidator(_strip_title),
    Field(min_length=1),
]
ResourceId = Annotated[str, Field(pattern=r"^[0-9]+$")]
DurationMinutes = Annotated[int, Field(ge=1)]
LocalTime = Annotated[time, AfterValidator(_reject_timezone)]
BlockCount = Annotated[float, Field(gt=0, le=99.5, multiple_of=0.5)]
TaskPriorityValue = Literal["HIGH", "MEDIUM", "LOW"]


class CreateTaskRequest(BaseModel):
    goal_id: ResourceId | None = None
    parent_id: ResourceId | None = None
    title: TaskTitle | None = None
    scheduled_date: date | None = None
    due_date: date | None = None
    priority: TaskPriorityValue | None = None
    start_time: LocalTime | None = None
    duration_minutes: DurationMinutes | None = None
    block_count: BlockCount | None = None


class UpdateTaskRequest(BaseModel):
    title: TaskTitle | None = None
    scheduled_date: date | None = None
    due_date: date | None = None
    priority: TaskPriorityValue | None = None
    start_time: LocalTime | None = None
    duration_minutes: DurationMinutes | None = None
    block_count: BlockCount | None = None

    @field_validator("title", "scheduled_date")
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class RepeatTaskRequest(BaseModel):
    byweekday: Weekdays


class TaskResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    id: str
    goal_id: str | None
    rule_id: str | None
    parent_id: str | None
    title: str
    occurrence_date: date | None
    scheduled_date: date | None
    due_date: date | None
    priority: TaskPriorityValue | None
    start_time: time | None
    duration_minutes: int | None
    end_time: time | None
    block_count: float | None
    period_start: date | None
    status: Literal["PENDING", "DONE", "DELETED"]
    completed_at: datetime | None

    @field_serializer("start_time", "end_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.strftime("%H:%M") if value is not None else None
