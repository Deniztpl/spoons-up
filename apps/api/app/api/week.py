from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import WeekServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.week import WeekResponse

router = APIRouter(prefix="/week", tags=["week"])

StartQuery = Annotated[date | None, Query(alias="start")]


@router.get(
    "",
    response_model=WeekResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        422: {"model": ValidationErrorResponse},
    },
)
def get_week(
    current_user: CurrentUserDependency,
    week_service: WeekServiceDependency,
    target_date: StartQuery = None,
) -> WeekResponse:
    return week_service.get(user_id=current_user.id, target_date=target_date)
