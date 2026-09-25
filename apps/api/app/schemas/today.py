from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict


class TodayHabitResponse(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    area_id: str
    title: str
    done: bool


class TodayTaskResponse(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    goal_id: str | None
    title: str
    start_time: time
    end_time: time
    status: Literal["PENDING", "DONE"]
    scheduled_date: date
    occurrence_date: date | None
    period_start: date


class TodayResponse(BaseModel):
    date: date
    week_start: date
    week_end: date
    daily_habits: list[TodayHabitResponse]
    weekly_habits: list[TodayHabitResponse]
    tasks: list[TodayTaskResponse]
