from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import TodayServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.today import TodayResponse

router = APIRouter(prefix="/today", tags=["today"])

DateQuery = Annotated[date | None, Query(alias="date")]


@router.get(
    "",
    response_model=TodayResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        422: {"model": ValidationErrorResponse},
    },
)
def get_today(
    current_user: CurrentUserDependency,
    today_service: TodayServiceDependency,
    target_date: DateQuery = None,
) -> TodayResponse:
    return today_service.get(user_id=current_user.id, target_date=target_date)
