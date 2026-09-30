from fastapi import APIRouter

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import JournalServiceDependency
from app.schemas.errors import ErrorResponse
from app.schemas.journal import JournalResponse

router = APIRouter(prefix="/journal", tags=["journal"])


@router.get(
    "",
    response_model=JournalResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def get_journal(
    current_user: CurrentUserDependency,
    journal_service: JournalServiceDependency,
) -> JournalResponse:
    return journal_service.get(user_id=current_user.id)
