from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.schemas.journal import JournalProgressResponse


class TodayHabitResponse(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    area_id: str
    title: str
    done: bool


class TaskParentResponse(BaseModel):
    id: str
    title: str
    step_progress: JournalProgressResponse


class TodayTaskResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
        # The step context below is always sent, as null when it does not apply.
        json_schema_serialization_defaults_required=True,
    )

    id: str
    goal_id: str | None
    rule_id: str | None
    parent_id: str | None
    title: str
    start_time: time | None
    duration_minutes: int | None
    end_time: time | None
    block_count: float | None
    status: Literal["PENDING", "DONE"]
    scheduled_date: date
    occurrence_date: date | None
    period_start: date
    # A top-level Journal item's own steps; null on goal tasks, items without steps and steps.
    step_progress: JournalProgressResponse | None = None
    # The item a step belongs to, with that item's progress; null on everything but a step.
    parent: TaskParentResponse | None = None

    @field_serializer("start_time", "end_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.strftime("%H:%M") if value is not None else None


class LeftBehindItemResponse(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    title: str
    goal_id: str | None
    parent_id: str | None
    scheduled_date: date
    start_time: time | None
    source_type: Literal["JOURNAL", "AREA"]
    source_label: str

    @field_serializer("start_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.strftime("%H:%M") if value is not None else None


class LeftBehindResponse(BaseModel):
    count: int
    items: list[LeftBehindItemResponse]


class TodayResponse(BaseModel):
    date: date
    week_start: date
    week_end: date
    daily_habits: list[TodayHabitResponse]
    weekly_habits: list[TodayHabitResponse]
    tasks: list[TodayTaskResponse]
    left_behind: LeftBehindResponse
