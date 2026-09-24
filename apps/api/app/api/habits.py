from datetime import date
from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import HabitServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.habits import (
    CheckHabitRequest,
    CreateHabitRequest,
    HabitEntryResponse,
    HabitListResponse,
    HabitResponse,
    UpdateHabitRequest,
)

router = APIRouter(prefix="/habits", tags=["habits"])

READ_RESPONSES = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    422: {"model": ValidationErrorResponse},
}
HabitIdPath = Annotated[str, Path(pattern=r"^[0-9]+$")]
AreaIdQuery = Annotated[str | None, Query(pattern=r"^[0-9]+$")]
DateQuery = Annotated[date, Query(alias="date")]


@router.get(
    "",
    response_model=HabitListResponse,
    responses={401: {"model": ErrorResponse}, 422: {"model": ValidationErrorResponse}},
)
def list_habits(
    current_user: CurrentUserDependency,
    habit_service: HabitServiceDependency,
    area_id: AreaIdQuery = None,
) -> HabitListResponse:
    return habit_service.list(
        user_id=current_user.id,
        area_id=int(area_id) if area_id is not None else None,
    )


@router.post(
    "",
    response_model=HabitResponse,
    status_code=status.HTTP_201_CREATED,
    responses=READ_RESPONSES,
)
def create_habit(
    payload: CreateHabitRequest,
    current_user: CurrentUserDependency,
    habit_service: HabitServiceDependency,
) -> HabitResponse:
    return habit_service.create(payload, user_id=current_user.id)


@router.patch("/{habit_id}", response_model=HabitResponse, responses=READ_RESPONSES)
def update_habit(
    habit_id: HabitIdPath,
    payload: UpdateHabitRequest,
    current_user: CurrentUserDependency,
    habit_service: HabitServiceDependency,
) -> HabitResponse:
    return habit_service.update(payload, habit_id=int(habit_id), user_id=current_user.id)


@router.delete(
    "/{habit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=READ_RESPONSES,
)
def delete_habit(
    habit_id: HabitIdPath,
    current_user: CurrentUserDependency,
    habit_service: HabitServiceDependency,
) -> None:
    habit_service.delete(habit_id=int(habit_id), user_id=current_user.id)


@router.post(
    "/{habit_id}/check",
    response_model=HabitEntryResponse,
    status_code=status.HTTP_201_CREATED,
    responses=READ_RESPONSES | {409: {"model": ErrorResponse}},
)
def check_habit(
    habit_id: HabitIdPath,
    payload: CheckHabitRequest,
    current_user: CurrentUserDependency,
    habit_service: HabitServiceDependency,
) -> HabitEntryResponse:
    return habit_service.check(payload, habit_id=int(habit_id), user_id=current_user.id)


@router.delete(
    "/{habit_id}/check",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=READ_RESPONSES,
)
def uncheck_habit(
    habit_id: HabitIdPath,
    current_user: CurrentUserDependency,
    habit_service: HabitServiceDependency,
    target_date: DateQuery,
) -> None:
    habit_service.uncheck(
        habit_id=int(habit_id),
        user_id=current_user.id,
        target_date=target_date,
    )
