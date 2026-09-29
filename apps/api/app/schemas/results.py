from datetime import date
from typing import Literal

from pydantic import BaseModel


class RequirementResponse(BaseModel):
    ref_type: Literal["GOAL", "HABIT"]
    ref_id: str
    title: str
    target: int
    done: float


class ProgressDayResponse(BaseModel):
    date: date
    done: bool


class AreaProgressResponse(BaseModel):
    area_id: str
    name: str
    percent: int
    days: list[ProgressDayResponse]
    requirements: list[RequirementResponse]


class ProgressResponse(BaseModel):
    period_start: date
    period_end: date
    percent: int | None
    areas: list[AreaProgressResponse]
