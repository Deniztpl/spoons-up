from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config.app import settings
from app.core.errors import InvalidTokenError
from app.repositories.users import UserRepository
from app.services.tasks import TASK_GENERATION_DAYS, TaskService


class UserActivityService:
    def __init__(
        self,
        session: Session,
        user_repository: UserRepository,
        task_service: TaskService,
    ) -> None:
        self.session = session
        self.user_repository = user_repository
        self.task_service = task_service

    def record_authenticated_request(
        self,
        *,
        user_id: int,
        now: datetime | None = None,
    ) -> None:
        seen_at = now or datetime.now(UTC)

        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise InvalidTokenError

            was_dormant = user.last_seen_at < seen_at - timedelta(days=settings.active_user_days)
            self.user_repository.set_last_seen_at(user=user, last_seen_at=seen_at)

            if was_dormant:
                today = seen_at.astimezone(ZoneInfo(user.timezone)).date()
                self.task_service.add_tasks(
                    user_id=user.id,
                    from_date=today,
                    to_date=today + timedelta(days=TASK_GENERATION_DAYS - 1),
                )
