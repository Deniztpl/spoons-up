from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_serializer


class JournalProgressResponse(BaseModel):
    done: int
    total: int


class JournalStepResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    id: str
    parent_id: str
    title: str
    scheduled_date: date | None
    start_time: time | None
    duration_minutes: int | None
    end_time: time | None
    block_count: float | None
    status: Literal["PENDING", "DONE"]
    completed_at: datetime | None

    @field_serializer("start_time", "end_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.strftime("%H:%M") if value is not None else None


class JournalItemResponse(BaseModel):
    id: str
    title: str
    due_date: date | None
    priority: Literal["HIGH", "MEDIUM", "LOW"] | None
    scheduled_date: date | None
    start_time: time | None
    duration_minutes: int | None
    end_time: time | None
    block_count: float | None
    status: Literal["PENDING", "DONE"]
    completed_at: datetime | None
    created_at: datetime
    progress: JournalProgressResponse
    steps: list[JournalStepResponse]

    @field_serializer("start_time", "end_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.strftime("%H:%M") if value is not None else None


class JournalResponse(BaseModel):
    today: date
    active: list[JournalItemResponse]
    completed: list[JournalItemResponse]
