from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

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

            fields = payload.model_fields_set
            goal_id = int(payload.goal_id) if payload.goal_id is not None else None
            parent_id = int(payload.parent_id) if payload.parent_id is not None else None
            if goal_id is not None and parent_id is not None:
                raise ValidationAppError(
                    {"parent_id": "A task cannot have both a goal and a parent"}
                )

            if parent_id is not None:
                invalid_fields = fields - {"parent_id", "title"}
                if invalid_fields:
                    raise ValidationAppError(
                        {
                            field: "A step is created with only parent_id and title"
                            for field in sorted(invalid_fields)
                        }
                    )
                if payload.title is None:
                    raise ValidationAppError({"title": "Title is required for a step"})
                parent = self.task_repository.get_task_and_lock(
                    task_id=parent_id,
                    user_id=user_id,
                )
                if parent is None:
                    raise NotFoundError
                if parent.goal_id is not None or parent.parent_id is not None:
                    raise ValidationAppError(
                        {"parent_id": "Parent must be a top-level Journal item"}
                    )
                title = payload.title
                scheduled_date = None
                due_date = None
                priority = None
                start_time = None
                duration_minutes = None
                block_count = None
            elif goal_id is not None:
                if payload.scheduled_date is None:
                    raise ValidationAppError(
                        {"scheduled_date": "Scheduled date is required for a goal task"}
                    )
                if "title" in fields:
                    raise ValidationAppError({"title": "Title comes from the selected goal"})
                if "due_date" in fields:
                    raise ValidationAppError(
                        {"due_date": "Due date is only available on a top-level Journal item"}
                    )
                if "priority" in fields:
                    raise ValidationAppError(
                        {"priority": "Priority is only available on a top-level Journal item"}
                    )
                if "parent_id" in fields:
                    raise ValidationAppError({"parent_id": "A goal task cannot have a parent"})
                goal = self.goal_repository.get_for_user(goal_id=goal_id, user_id=user_id)
                if goal is None:
                    raise NotFoundError
                title = goal.title
                scheduled_date = payload.scheduled_date
                due_date = None
                priority = None
                start_time = payload.start_time
                duration_minutes = payload.duration_minutes
                block_count = payload.block_count
            else:
                if payload.title is None:
                    raise ValidationAppError({"title": "Title is required without a goal"})
                title = payload.title
                due_date = payload.due_date
                priority = payload.priority
                scheduled_date = due_date or payload.scheduled_date
                start_time = payload.start_time
                duration_minutes = payload.duration_minutes
                block_count = payload.block_count

            self._validate_scheduled_date(
                scheduled_date=scheduled_date,
                timezone=user.timezone,
                field="due_date" if due_date is not None else "scheduled_date",
            )
            if start_time is not None and scheduled_date is None:
                raise ValidationAppError({"start_time": "Start time requires a scheduled date"})

            period_start = (
                get_week_start(scheduled_date, week_start_day=user.week_start_day)
                if scheduled_date is not None
                else None
            )

            task = self.task_repository.create(
                user_id=user_id,
                goal_id=goal_id,
                parent_id=parent_id,
                title=title,
                scheduled_date=scheduled_date,
                due_date=due_date,
                priority=priority,
                start_time=start_time,
                duration_minutes=duration_minutes,
                end_time=_add_minutes(start_time, duration_minutes),
                block_count=block_count,
                period_start=period_start,
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
            task = self.get_owned_task(task_id=task_id, user_id=user_id)
            fields = payload.model_fields_set
            due_date_supplied = "due_date" in fields
            if due_date_supplied and (task.goal_id is not None or task.parent_id is not None):
                raise ValidationAppError(
                    {"due_date": "Due date is only available on a top-level Journal item"}
                )
            if "priority" in fields and (task.goal_id is not None or task.parent_id is not None):
                raise ValidationAppError(
                    {"priority": "Priority is only available on a top-level Journal item"}
                )
            if task.goal_id is not None and "title" in fields:
                raise ValidationAppError({"title": "A goal-linked task uses its goal title"})

            due_date = payload.due_date if due_date_supplied else task.due_date
            if due_date_supplied:
                scheduled_date = payload.due_date
            elif "scheduled_date" in fields:
                scheduled_date = payload.scheduled_date
            else:
                scheduled_date = task.scheduled_date

            date_to_validate = payload.due_date if due_date_supplied else scheduled_date
            if date_to_validate is not None and ("scheduled_date" in fields or due_date_supplied):
                user = self.user_repository.get_by_id(user_id)
                if user is None:
                    raise NotFoundError
                self._validate_scheduled_date(
                    scheduled_date=date_to_validate,
                    timezone=user.timezone,
                    field="due_date" if due_date_supplied else "scheduled_date",
                )

            clearing_due_date = due_date_supplied and payload.due_date is None
            start_time = (
                None
                if clearing_due_date
                else payload.start_time
                if "start_time" in fields
                else task.start_time
            )
            if start_time is not None and scheduled_date is None:
                raise ValidationAppError({"start_time": "Start time requires a scheduled date"})

            duration_minutes = (
                payload.duration_minutes if "duration_minutes" in fields else task.duration_minutes
            )
            if clearing_due_date:
                period_start = None
            elif task.scheduled_date is None and scheduled_date is not None:
                user = self.user_repository.get_by_id(user_id)
                if user is None:
                    raise NotFoundError
                period_start = get_week_start(
                    scheduled_date,
                    week_start_day=user.week_start_day,
                )
            else:
                period_start = task.period_start

            update_scheduled_date = "scheduled_date" in fields or due_date_supplied
            update_start_time = "start_time" in fields or clearing_due_date
            update_period_start = clearing_due_date or (
                update_scheduled_date and task.scheduled_date is None
            )
            update_end_time = bool({"start_time", "duration_minutes"} & fields) or clearing_due_date
            self.task_repository.update(
                task=task,
                title=payload.title if payload.title is not None else task.title,
                scheduled_date=scheduled_date,
                due_date=due_date,
                priority=payload.priority,
                start_time=start_time,
                duration_minutes=payload.duration_minutes,
                end_time=_add_minutes(start_time, duration_minutes),
                block_count=payload.block_count,
                period_start=period_start,
                update_title="title" in fields,
                update_scheduled_date=update_scheduled_date,
                update_due_date=due_date_supplied,
                update_priority="priority" in fields,
                update_start_time=update_start_time,
                update_duration_minutes="duration_minutes" in fields,
                update_end_time=update_end_time,
                update_block_count="block_count" in fields,
                update_period_start=update_period_start,
            )
            response = TaskResponse.model_validate(task)
        return response

    def delete(self, *, task_id: int, user_id: int) -> None:
        with self.session.begin():
            task = self.get_owned_task(task_id=task_id, user_id=user_id)
            self.task_repository.delete(task=task)

    def complete(self, *, task_id: int, user_id: int) -> TaskResponse:
        with self.session.begin():
            task = self.get_owned_task(task_id=task_id, user_id=user_id)
            if (
                task.status != TaskStatus.DONE.value
                and task.goal_id is None
                and task.parent_id is None
            ):
                self.task_repository.clear_pending_step_plans(
                    parent_id=task.id,
                    user_id=user_id,
                )
            self.task_repository.complete(task=task, completed_at=datetime.now(UTC))
            response = TaskResponse.model_validate(task)
        return response

    def uncomplete(self, *, task_id: int, user_id: int) -> TaskResponse:
        with self.session.begin():
            task = self.get_owned_task(task_id=task_id, user_id=user_id)
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

    def get_owned_task(self, *, task_id: int, user_id: int) -> Task:
        task = self.task_repository.get_task_and_lock(task_id=task_id, user_id=user_id)
        if task is None:
            raise NotFoundError
        return task

    def attach_to_rule(self, *, task: Task, rule: GoalRule) -> None:
        """Make the task the rule's occurrence on the date it sits on now."""
        if task.scheduled_date is None:
            raise ValidationAppError(
                {"scheduled_date": "A repeating task requires a scheduled date"}
            )
        self.task_repository.set_rule(
            task=task,
            rule_id=rule.id,
            occurrence_date=task.scheduled_date,
        )

    def detach_from_rule(self, *, task: Task) -> None:
        """Turn a rule occurrence back into an ad-hoc task."""
        self.task_repository.set_rule(task=task, rule_id=None, occurrence_date=None)

    def rename_goal_tasks(self, *, goal: Goal) -> None:
        """A goal-linked task shows its goal's title, so a rename reaches every one of them."""
        self.task_repository.rename_goal_tasks(
            goal_id=goal.id,
            user_id=goal.user_id,
            title=goal.title,
        )

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

    @staticmethod
    def _validate_scheduled_date(
        *,
        scheduled_date: date | None,
        timezone: str,
        field: str = "scheduled_date",
    ) -> None:
        if scheduled_date is None:
            return
        today = datetime.now(ZoneInfo(timezone)).date()
        if scheduled_date < today:
            raise ValidationAppError({field: "Scheduled date cannot be before today"})


def _add_minutes(value: time | None, minutes: int | None) -> time | None:
    if value is None or minutes is None:
        return None
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()
