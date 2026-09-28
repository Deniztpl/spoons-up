from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.core.periods import get_week_start
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.today import TodayTaskResponse
from app.schemas.week import (
    LaterTaskResponse,
    LaterTasksResponse,
    WeekDayResponse,
    WeekResponse,
)


class WeekService:
    def __init__(
        self,
        session: Session,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.task_repository = task_repository
        self.user_repository = user_repository

    def get(self, *, user_id: int, target_date: date | None) -> WeekResponse:
        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise NotFoundError

            today = datetime.now(ZoneInfo(user.timezone)).date()
            current_week_start = get_week_start(
                today,
                week_start_day=user.week_start_day,
            )
            following_week_start = current_week_start + timedelta(days=7)
            period_start = (
                current_week_start
                if target_date is None
                else get_week_start(target_date, week_start_day=user.week_start_day)
            )
            if period_start not in {current_week_start, following_week_start}:
                raise ValidationAppError({"start": "Week must be the current or following week"})

            period_end = period_start + timedelta(days=6)
            tasks = self.task_repository.list_for_week(
                user_id=user_id,
                week_start=period_start,
                week_end=period_end,
            )
            tasks_by_date = {period_start + timedelta(days=offset): [] for offset in range(7)}
            for task in tasks:
                tasks_by_date[task.scheduled_date].append(TodayTaskResponse.model_validate(task))

            following_week_end = following_week_start + timedelta(days=6)
            later_tasks = self.task_repository.list_later_tasks(
                user_id=user_id,
                cutoff_date=following_week_end,
            )
            later_items = [
                LaterTaskResponse(
                    scheduled_date=task.scheduled_date,
                    start_time=task.start_time,
                    title=task.title,
                )
                for task in later_tasks
            ]

            return WeekResponse(
                period_start=period_start,
                days=[
                    WeekDayResponse(date=day, tasks=day_tasks)
                    for day, day_tasks in tasks_by_date.items()
                ],
                later_tasks=LaterTasksResponse(
                    count=len(later_items),
                    items=later_items,
                ),
            )
