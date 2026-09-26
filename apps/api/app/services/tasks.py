from datetime import date, datetime, time, timedelta

from app.core.errors import NotFoundError
from app.core.periods import get_week_start
from app.models import Goal, GoalRule, TaskStatus
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository

TASK_GENERATION_DAYS = 14


class TaskService:
    def __init__(
        self,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ) -> None:
        self.task_repository = task_repository
        self.user_repository = user_repository

    def add_tasks(
        self,
        *,
        user_id: int,
        from_date: date,
        to_date: date,
    ) -> None:
        if from_date > to_date:
            raise ValueError("from_date must not be after to_date")

        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError

        rules = self.task_repository.list_active_rules_for_user(user_id=user_id)
        task_values: list[dict[str, object]] = []
        for goal, rule in rules:
            task_values.extend(
                self._build_task_values_for_rule(
                    goal=goal,
                    rule=rule,
                    user_id=user_id,
                    week_start_day=user.week_start_day,
                    from_date=from_date,
                    to_date=to_date,
                )
            )

        self.task_repository.add_generated_tasks(task_values=task_values)

    def delete_untouched_pending_tasks_for_rule(
        self,
        *,
        rule_id: int,
        user_id: int,
        from_date: date,
    ) -> None:
        self.task_repository.delete_untouched_pending_tasks_for_rule(
            rule_id=rule_id,
            user_id=user_id,
            from_date=from_date,
        )

    def _build_task_values_for_rule(
        self,
        *,
        goal: Goal,
        rule: GoalRule,
        user_id: int,
        week_start_day: int,
        from_date: date,
        to_date: date,
    ) -> list[dict[str, object]]:
        values: list[dict[str, object]] = []
        occurrence_date = from_date
        end_time = _add_minutes(rule.start_time, rule.duration_minutes)

        while occurrence_date <= to_date:
            if occurrence_date.isoweekday() in rule.byweekday:
                values.append(
                    {
                        "user_id": user_id,
                        "goal_id": goal.id,
                        "rule_id": rule.id,
                        "title": goal.title,
                        "occurrence_date": occurrence_date,
                        "scheduled_date": occurrence_date,
                        "start_time": rule.start_time,
                        "end_time": end_time,
                        "block_count": rule.block_count,
                        "period_start": get_week_start(
                            occurrence_date,
                            week_start_day=week_start_day,
                        ),
                        "status": TaskStatus.PENDING.value,
                    }
                )
            occurrence_date += timedelta(days=1)

        return values


def _add_minutes(value: time, minutes: int) -> time:
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()
