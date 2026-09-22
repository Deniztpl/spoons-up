from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field


def _strip_name(value: str) -> str:
    return value.strip()


AreaName = Annotated[
    str,
    AfterValidator(_strip_name),
    Field(min_length=1, max_length=60),
]


class CreateAreaRequest(BaseModel):
    name: AreaName


class UpdateAreaRequest(BaseModel):
    name: AreaName


class ArchiveAreaRequest(BaseModel):
    archived: bool


class AreaResponse(BaseModel):
    id: str
    name: str
    archived_at: datetime | None
    created_at: datetime


class AreaListResponse(BaseModel):
    areas: list[AreaResponse]
