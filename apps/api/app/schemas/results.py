from datetime import date
from typing import Literal

from pydantic import BaseModel


class RequirementResponse(BaseModel):
    ref_type: Literal["GOAL", "HABIT"]
    ref_id: str
    title: str
    target: int
    done: float


class ResultDayResponse(BaseModel):
    date: date
    done: bool


class AreaResultResponse(BaseModel):
    area_id: str
    name: str
    percent: int
    days: list[ResultDayResponse]
    requirements: list[RequirementResponse]


class ProgressResponse(BaseModel):
    period_start: date
    period_end: date
    percent: int | None
    areas: list[AreaResultResponse]


class GrowthWeekResponse(BaseModel):
    period_start: date
    period_end: date
    percent: int | None
    areas: list[AreaResultResponse]


class GrowthResponse(BaseModel):
    weeks: list[GrowthWeekResponse]
