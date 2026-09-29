from fastapi import APIRouter

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import ResultsServiceDependency
from app.schemas.errors import ErrorResponse
from app.schemas.results import ProgressResponse

progress_router = APIRouter(prefix="/progress", tags=["progress"])


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
