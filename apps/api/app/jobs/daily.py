from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config.app import settings
from app.core.database import SessionLocal
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.services.tasks import TASK_GENERATION_DAYS, TaskService


def run_daily_task_generation(
    session: Session,
    *,
    now: datetime | None = None,
) -> int:
    observed_at = now or datetime.now(UTC)
    user_repository = UserRepository(session)
    task_service = TaskService(
        TaskRepository(session),
        user_repository,
    )

    with session.begin():
        users = user_repository.list_seen_since(
            seen_since=observed_at - timedelta(days=settings.active_user_days),
        )
        for user in users:
            today = observed_at.astimezone(ZoneInfo(user.timezone)).date()
            task_service.add_tasks(
                user_id=user.id,
                from_date=today,
                to_date=today + timedelta(days=TASK_GENERATION_DAYS - 1),
            )

    return len(users)


def main() -> None:
    with SessionLocal() as session:
        processed_users = run_daily_task_generation(session)
    print(f"Daily task generation processed {processed_users} users")


if __name__ == "__main__":
    main()
