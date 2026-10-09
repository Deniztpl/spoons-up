from datetime import date

from pydantic import BaseModel

from app.schemas.today import TodayTaskResponse


class WeekDayResponse(BaseModel):
    date: date
    tasks: list[TodayTaskResponse]


class LaterTasksResponse(BaseModel):
    count: int
    items: list[TodayTaskResponse]


class WeekGoalHoursResponse(BaseModel):
    goal_id: str
    area_id: str
    title: str
    # Hours: the weekly target, what is done, and what is still planned from today on.
    target: int
    done: float
    planned: float


class WeekResponse(BaseModel):
    period_start: date
    days: list[WeekDayResponse]
    later_tasks: LaterTasksResponse
    goals: list[WeekGoalHoursResponse]
