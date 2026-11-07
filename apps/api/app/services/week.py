from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.core.periods import get_week_start
from app.repositories.areas import AreaRepository
from app.repositories.goals import GoalRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.today import TodayTaskResponse
from app.schemas.week import (
    LaterTasksResponse,
    WeekDayResponse,
    WeekGoalHoursResponse,
    WeekResponse,
)
from app.services.today import scheduled_task_responses

# Week shows the current week and the two after it, all inside the generated window.
WEEKS_AHEAD = 2


class WeekService:
    def __init__(
        self,
        session: Session,
        task_repository: TaskRepository,
        user_repository: UserRepository,
        goal_repository: GoalRepository,
        area_repository: AreaRepository,
    ) -> None:
        self.session = session
        self.task_repository = task_repository
        self.user_repository = user_repository
        self.goal_repository = goal_repository
        self.area_repository = area_repository

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
            last_week_start = current_week_start + timedelta(weeks=WEEKS_AHEAD)
            period_start = (
                current_week_start
                if target_date is None
                else get_week_start(target_date, week_start_day=user.week_start_day)
            )
            if not current_week_start <= period_start <= last_week_start:
                raise ValidationAppError(
                    {"start": "Week must be the current week or one of the next two"}
                )

            period_end = period_start + timedelta(days=6)
            tasks = self.task_repository.list_for_week(
                user_id=user_id,
                week_start=period_start,
                week_end=period_end,
            )
            later_tasks = self.task_repository.list_later_tasks(
                user_id=user_id,
                cutoff_date=last_week_start + timedelta(days=6),
            )
            # The week and the later list share one read of their Journal items' steps.
            responses = scheduled_task_responses(
                [*tasks, *later_tasks],
                task_repository=self.task_repository,
                user_id=user_id,
            )
            later_items = responses[len(tasks) :]

            tasks_by_date: dict[date, list[TodayTaskResponse]] = {
                period_start + timedelta(days=offset): [] for offset in range(7)
            }
            for response in responses[: len(tasks)]:
                tasks_by_date[response.scheduled_date].append(response)

            goal_hours = self._goal_hours(user_id=user_id, period_start=period_start, today=today)

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
                goals=goal_hours,
            )

    def _goal_hours(
        self,
        *,
        user_id: int,
        period_start: date,
        today: date,
    ) -> list[WeekGoalHoursResponse]:
        """Each goal with a target, ordered as on the Areas screen: by area, then by creation."""
        area_order = {
            area.id: index
            for index, area in enumerate(
                self.area_repository.list_for_user(user_id=user_id, include_archived=False)
            )
        }
        hours = self.task_repository.sum_week_hours_by_goal(
            user_id=user_id,
            period_start=period_start,
            today=today,
        )
        responses: list[WeekGoalHoursResponse] = []
        for goal in self.goal_repository.list_for_user(user_id=user_id, area_id=None):
            if goal.weekly_target is None:
                continue
            done, planned = hours.get(goal.id, (Decimal(0), Decimal(0)))
            responses.append(
                WeekGoalHoursResponse(
                    goal_id=str(goal.id),
                    area_id=str(goal.area_id),
                    title=goal.title,
                    target=goal.weekly_target,
                    done=float(done),
                    planned=float(planned),
                )
            )
        # The goals arrive in creation order; a stable sort keeps it inside each area.
        responses.sort(key=lambda response: area_order[int(response.area_id)])
        return responses
