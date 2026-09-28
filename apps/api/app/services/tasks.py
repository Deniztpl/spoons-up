from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.core.periods import get_week_start
from app.models import Goal, GoalRule, Task, TaskStatus
from app.repositories.goals import GoalRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.tasks import CreateTaskRequest, TaskResponse, UpdateTaskRequest

TASK_GENERATION_DAYS = 14


class TaskService:
    def __init__(
        self,
        session: Session,
        task_repository: TaskRepository,
        goal_repository: GoalRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.task_repository = task_repository
        self.goal_repository = goal_repository
        self.user_repository = user_repository

    def create(self, payload: CreateTaskRequest, *, user_id: int) -> TaskResponse:
        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise NotFoundError

            goal_id = int(payload.goal_id) if payload.goal_id is not None else None
            if goal_id is None:
                if payload.title is None:
                    raise ValidationAppError({"title": "Title is required without a goal"})
                title = payload.title
            else:
                if "title" in payload.model_fields_set:
                    raise ValidationAppError({"title": "Title comes from the selected goal"})
                goal = self.goal_repository.get_for_user(goal_id=goal_id, user_id=user_id)
                if goal is None:
                    raise NotFoundError
                title = goal.title

            task = self.task_repository.create(
                user_id=user_id,
                goal_id=goal_id,
                title=title,
                scheduled_date=payload.scheduled_date,
                start_time=payload.start_time,
                duration_minutes=payload.duration_minutes,
                end_time=_add_minutes(payload.start_time, payload.duration_minutes),
                block_count=payload.block_count,
                period_start=get_week_start(
                    payload.scheduled_date,
                    week_start_day=user.week_start_day,
                ),
            )
            response = TaskResponse.model_validate(task)
        return response

    def update(
        self,
        payload: UpdateTaskRequest,
        *,
        task_id: int,
        user_id: int,
    ) -> TaskResponse:
        with self.session.begin():
            task = self._get_owned_task(task_id=task_id, user_id=user_id)
            fields = payload.model_fields_set
            if task.goal_id is not None and "title" in fields:
                raise ValidationAppError({"title": "A goal-linked task uses its goal title"})

            start_time = payload.start_time if "start_time" in fields else task.start_time
            duration_minutes = (
                payload.duration_minutes if "duration_minutes" in fields else task.duration_minutes
            )
            update_end_time = bool({"start_time", "duration_minutes"} & fields)
            self.task_repository.update(
                task=task,
                title=payload.title if payload.title is not None else task.title,
                scheduled_date=(
                    payload.scheduled_date
                    if payload.scheduled_date is not None
                    else task.scheduled_date
                ),
                start_time=payload.start_time,
                duration_minutes=payload.duration_minutes,
                end_time=_add_minutes(start_time, duration_minutes),
                block_count=payload.block_count,
                update_title="title" in fields,
                update_scheduled_date="scheduled_date" in fields,
                update_start_time="start_time" in fields,
                update_duration_minutes="duration_minutes" in fields,
                update_end_time=update_end_time,
                update_block_count="block_count" in fields,
            )
            response = TaskResponse.model_validate(task)
        return response

    def delete(self, *, task_id: int, user_id: int) -> None:
        with self.session.begin():
            task = self._get_owned_task(task_id=task_id, user_id=user_id)
            self.task_repository.delete(task=task)

    def complete(self, *, task_id: int, user_id: int) -> TaskResponse:
        with self.session.begin():
            task = self._get_owned_task(task_id=task_id, user_id=user_id)
            self.task_repository.complete(task=task, completed_at=datetime.now(UTC))
            response = TaskResponse.model_validate(task)
        return response

    def uncomplete(self, *, task_id: int, user_id: int) -> TaskResponse:
        with self.session.begin():
            task = self._get_owned_task(task_id=task_id, user_id=user_id)
            self.task_repository.uncomplete(task=task)
            response = TaskResponse.model_validate(task)
        return response

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
        rule: GoalRule,
        user_id: int,
        from_date: date,
    ) -> None:
        self.task_repository.delete_untouched_pending_tasks_for_rule(
            rule_id=rule.id,
            user_id=user_id,
            from_date=from_date,
            start_time=rule.start_time,
            duration_minutes=rule.duration_minutes,
            block_count=rule.block_count,
        )

    def delete_pending_tasks_for_area(
        self,
        *,
        area_id: int,
        user_id: int,
        from_date: date,
    ) -> None:
        self.task_repository.delete_pending_tasks_for_area(
            area_id=area_id,
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
                        "duration_minutes": rule.duration_minutes,
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

    def _get_owned_task(self, *, task_id: int, user_id: int) -> Task:
        task = self.task_repository.get_task_and_lock(task_id=task_id, user_id=user_id)
        if task is None:
            raise NotFoundError
        return task


def _add_minutes(value: time | None, minutes: int | None) -> time | None:
    if value is None or minutes is None:
        return None
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()
