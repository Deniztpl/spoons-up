from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import ResultsServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.results import GrowthResponse, ProgressResponse
from app.services.results import GROWTH_DEFAULT_WEEKS, GROWTH_MAX_WEEKS

progress_router = APIRouter(prefix="/progress", tags=["progress"])
growth_router = APIRouter(prefix="/growth", tags=["growth"])

WeeksQuery = Annotated[int, Query(ge=1, le=GROWTH_MAX_WEEKS)]


@progress_router.get(
    "",
    response_model=ProgressResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def get_progress(
    current_user: CurrentUserDependency,
    results_service: ResultsServiceDependency,
) -> ProgressResponse:
    return results_service.get_progress(user_id=current_user.id)


@growth_router.get(
    "",
    response_model=GrowthResponse,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        422: {"model": ValidationErrorResponse},
    },
)
def get_growth(
    current_user: CurrentUserDependency,
    results_service: ResultsServiceDependency,
    weeks: WeeksQuery = GROWTH_DEFAULT_WEEKS,
    before: date | None = None,
) -> GrowthResponse:
    return results_service.get_growth(user_id=current_user.id, weeks=weeks, before=before)
