from typing import Annotated

from fastapi import APIRouter, Path

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import TaskServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.tasks import TaskResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])

READ_RESPONSES = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    422: {"model": ValidationErrorResponse},
}
TaskIdPath = Annotated[str, Path(pattern=r"^[0-9]+$")]


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
