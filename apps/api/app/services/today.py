from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.periods import get_week_end, get_week_start
from app.models import HabitMode, Task
from app.repositories.habits import HabitRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.journal import JournalProgressResponse
from app.schemas.today import (
    TaskParentResponse,
    TodayHabitResponse,
    TodayResponse,
    TodayTaskResponse,
)


class TodayService:
    def __init__(
        self,
        session: Session,
        habit_repository: HabitRepository,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.habit_repository = habit_repository
        self.task_repository = task_repository
        self.user_repository = user_repository

    def get(self, *, user_id: int, target_date: date | None) -> TodayResponse:
        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise NotFoundError

            resolved_date = target_date or datetime.now(ZoneInfo(user.timezone)).date()
            week_start = get_week_start(
                resolved_date,
                week_start_day=user.week_start_day,
            )
            week_end = get_week_end(
                resolved_date,
                week_start_day=user.week_start_day,
            )
            habits = self.habit_repository.list_for_today(
                user_id=user_id,
                target_date=resolved_date,
                week_start=week_start,
            )
            tasks = self.task_repository.list_for_today(
                user_id=user_id,
                target_date=resolved_date,
            )

            daily_habits: list[TodayHabitResponse] = []
            weekly_habits: list[TodayHabitResponse] = []
            for habit, done in habits:
                response = TodayHabitResponse(
                    id=str(habit.id),
                    area_id=str(habit.area_id),
                    title=habit.title,
                    done=done,
                )
                if habit.mode == HabitMode.DAILY.value:
                    daily_habits.append(response)
                else:
                    weekly_habits.append(response)

            return TodayResponse(
                date=resolved_date,
                week_start=week_start,
                week_end=week_end,
                daily_habits=daily_habits,
                weekly_habits=weekly_habits,
                tasks=scheduled_task_responses(
                    tasks,
                    task_repository=self.task_repository,
                    user_id=user_id,
                ),
            )


def scheduled_task_responses(
    tasks: list[Task],
    *,
    task_repository: TaskRepository,
    user_id: int,
) -> list[TodayTaskResponse]:
    """Scheduled tasks as Today and Week draw them: a Journal item with its own step progress,
    and a step with its item's title and progress. One query covers every item involved."""
    item_ids = {task.id for task in tasks if task.goal_id is None and task.parent_id is None}
    parent_ids = {task.parent_id for task in tasks if task.parent_id is not None}
    summaries = task_repository.list_step_summaries(
        user_id=user_id,
        task_ids=sorted(item_ids | parent_ids),
    )

    responses: list[TodayTaskResponse] = []
    for task in tasks:
        response = TodayTaskResponse.model_validate(task)
        if task.parent_id is not None:
            parent = summaries.get(task.parent_id)
            if parent is not None:
                response.parent = TaskParentResponse(
                    id=str(task.parent_id),
                    title=parent.title,
                    step_progress=JournalProgressResponse(done=parent.done, total=parent.total),
                )
        elif task.goal_id is None:
            summary = summaries.get(task.id)
            if summary is not None and summary.total > 0:
                response.step_progress = JournalProgressResponse(
                    done=summary.done,
                    total=summary.total,
                )
        responses.append(response)
    return responses
