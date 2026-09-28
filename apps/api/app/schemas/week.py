from datetime import date

from pydantic import BaseModel

from app.schemas.today import TodayTaskResponse


class WeekDayResponse(BaseModel):
    date: date
    tasks: list[TodayTaskResponse]


class LaterTasksResponse(BaseModel):
    count: int
    items: list[TodayTaskResponse]


class WeekResponse(BaseModel):
    period_start: date
    days: list[WeekDayResponse]
    later_tasks: LaterTasksResponse
