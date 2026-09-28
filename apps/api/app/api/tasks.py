from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import GoalServiceDependency, TaskServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.tasks import (
    CreateTaskRequest,
    RepeatTaskRequest,
    TaskResponse,
    UpdateTaskRequest,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

READ_RESPONSES = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    422: {"model": ValidationErrorResponse},
}
TaskIdPath = Annotated[str, Path(pattern=r"^[0-9]+$")]


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    responses=READ_RESPONSES,
)
def create_task(
    payload: CreateTaskRequest,
    current_user: CurrentUserDependency,
    task_service: TaskServiceDependency,
) -> TaskResponse:
    return task_service.create(payload, user_id=current_user.id)


@router.patch("/{task_id}", response_model=TaskResponse, responses=READ_RESPONSES)
def update_task(
    task_id: TaskIdPath,
    payload: UpdateTaskRequest,
    current_user: CurrentUserDependency,
    task_service: TaskServiceDependency,
) -> TaskResponse:
    return task_service.update(payload, task_id=int(task_id), user_id=current_user.id)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=READ_RESPONSES,
)
def delete_task(
    task_id: TaskIdPath,
    current_user: CurrentUserDependency,
    task_service: TaskServiceDependency,
) -> None:
    task_service.delete(task_id=int(task_id), user_id=current_user.id)


@router.post("/{task_id}/check", response_model=TaskResponse, responses=READ_RESPONSES)
def check_task(
    task_id: TaskIdPath,
    current_user: CurrentUserDependency,
    task_service: TaskServiceDependency,
) -> TaskResponse:
    return task_service.complete(task_id=int(task_id), user_id=current_user.id)


@router.delete("/{task_id}/check", response_model=TaskResponse, responses=READ_RESPONSES)
def uncheck_task(
    task_id: TaskIdPath,
    current_user: CurrentUserDependency,
    task_service: TaskServiceDependency,
) -> TaskResponse:
    return task_service.uncomplete(task_id=int(task_id), user_id=current_user.id)


@router.post("/{task_id}/repeat", response_model=TaskResponse, responses=READ_RESPONSES)
def repeat_task(
    task_id: TaskIdPath,
    payload: RepeatTaskRequest,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> TaskResponse:
    return goal_service.repeat_task(payload, task_id=int(task_id), user_id=current_user.id)


@router.delete("/{task_id}/repeat", response_model=TaskResponse, responses=READ_RESPONSES)
def stop_repeating_task(
    task_id: TaskIdPath,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> TaskResponse:
    return goal_service.stop_repeating_task(task_id=int(task_id), user_id=current_user.id)
