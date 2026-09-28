from datetime import date, time

from pydantic import BaseModel, field_serializer

from app.schemas.today import TodayTaskResponse


class WeekDayResponse(BaseModel):
    date: date
    tasks: list[TodayTaskResponse]


class LaterTaskResponse(BaseModel):
    scheduled_date: date
    start_time: time | None
    title: str

    @field_serializer("start_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.strftime("%H:%M") if value is not None else None


class LaterTasksResponse(BaseModel):
    count: int
    items: list[LaterTaskResponse]


class WeekResponse(BaseModel):
    period_start: date
    days: list[WeekDayResponse]
    later_tasks: LaterTasksResponse
