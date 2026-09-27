from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_serializer


class TaskResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        coerce_numbers_to_str=True,
    )

    id: str
    goal_id: str | None
    rule_id: str | None
    title: str
    occurrence_date: date | None
    scheduled_date: date
    start_time: time
    end_time: time
    block_count: float
    period_start: date
    status: Literal["PENDING", "DONE", "DELETED"]
    completed_at: datetime | None

    @field_serializer("start_time", "end_time")
    def serialize_time(self, value: time) -> str:
        return value.strftime("%H:%M")
