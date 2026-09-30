from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.core.periods import get_week_start
from app.models import Goal, GoalRule
from app.repositories.areas import AreaRepository
from app.repositories.goals import GoalRepository
from app.repositories.users import UserRepository
from app.schemas.goals import (
    CreateGoalRequest,
    CreateGoalRuleRequest,
    GoalListResponse,
    GoalResponse,
    GoalRuleResponse,
    UpdateGoalRequest,
    UpdateGoalRuleRequest,
)
from app.schemas.tasks import RepeatTaskRequest, TaskResponse
from app.services.tasks import TASK_GENERATION_DAYS, TaskService


class GoalService:
    def __init__(
        self,
        session: Session,
        goal_repository: GoalRepository,
        area_repository: AreaRepository,
        user_repository: UserRepository,
        task_service: TaskService,
    ) -> None:
        self.session = session
        self.goal_repository = goal_repository
        self.area_repository = area_repository
        self.user_repository = user_repository
        self.task_service = task_service

    def list(self, *, user_id: int, area_id: int | None) -> GoalListResponse:
        with self.session.begin():
            goals = self.goal_repository.list_for_user(user_id=user_id, area_id=area_id)
            response = GoalListResponse(
                goals=[GoalResponse.model_validate(goal) for goal in goals],
            )
        return response

    def get(self, *, goal_id: int, user_id: int) -> GoalResponse:
        with self.session.begin():
            goal = self._get_owned_goal(goal_id=goal_id, user_id=user_id)
            response = GoalResponse.model_validate(goal)
        return response

    def create(self, payload: CreateGoalRequest, *, user_id: int) -> GoalResponse:
        with self.session.begin():
            area_id = int(payload.area_id)
            self._ensure_active_area(area_id=area_id, user_id=user_id)
            goal = self.goal_repository.create(
                user_id=user_id,
                area_id=area_id,
                title=payload.title,
                weekly_target=payload.weekly_target,
            )
            response = GoalResponse.model_validate(goal)
        return response

    def update(
        self,
        payload: UpdateGoalRequest,
        *,
        goal_id: int,
        user_id: int,
    ) -> GoalResponse:
        with self.session.begin():
            goal = self._get_owned_goal(goal_id=goal_id, user_id=user_id)
            area_id = int(payload.area_id) if payload.area_id is not None else None
            if area_id is not None:
                self._ensure_active_area(area_id=area_id, user_id=user_id)
            self.goal_repository.update(
                goal=goal,
                area_id=area_id,
                title=payload.title,
                weekly_target=payload.weekly_target,
                update_weekly_target="weekly_target" in payload.model_fields_set,
            )
            if payload.title is not None:
                self.task_service.rename_goal_tasks(goal=goal)
            response = GoalResponse.model_validate(goal)
        return response

    def delete(self, *, goal_id: int, user_id: int) -> None:
        with self.session.begin():
            goal = self._get_owned_goal(goal_id=goal_id, user_id=user_id)
            self.goal_repository.delete(goal=goal)

    def create_rule(
        self,
        payload: CreateGoalRuleRequest,
        *,
        goal_id: int,
        user_id: int,
    ) -> GoalRuleResponse:
        with self.session.begin():
            goal = self._get_owned_goal(goal_id=goal_id, user_id=user_id)
            rule = self.goal_repository.create_rule(
                goal_id=goal.id,
                byweekday=payload.byweekday,
                start_time=payload.start_time,
                duration_minutes=payload.duration_minutes,
                block_count=payload.block_count,
            )
            self._add_tasks_for_current_window(user_id=user_id)
            response = GoalRuleResponse.model_validate(rule)
        return response

    def update_rule(
        self,
        payload: UpdateGoalRuleRequest,
        *,
        rule_id: int,
        user_id: int,
    ) -> GoalRuleResponse:
        with self.session.begin():
            rule = self._get_owned_rule(rule_id=rule_id, user_id=user_id)
            if payload.model_fields_set:
                today, open_week_start, window_end = self._get_task_generation_dates(
                    user_id=user_id
                )
                self.task_service.delete_untouched_pending_tasks_for_rule(
                    rule=rule,
                    user_id=user_id,
                    from_date=open_week_start,
                )
                self.goal_repository.update_rule(
                    rule=rule,
                    byweekday=payload.byweekday,
                    start_time=payload.start_time,
                    duration_minutes=payload.duration_minutes,
                    block_count=payload.block_count,
                    update_start_time="start_time" in payload.model_fields_set,
                    update_duration_minutes="duration_minutes" in payload.model_fields_set,
                    update_block_count="block_count" in payload.model_fields_set,
                )
                self.task_service.add_tasks(
                    user_id=user_id,
                    from_date=today,
                    to_date=window_end,
                )
            response = GoalRuleResponse.model_validate(rule)
        return response

    def delete_rule(self, *, rule_id: int, user_id: int) -> None:
        with self.session.begin():
            rule = self._get_owned_rule(rule_id=rule_id, user_id=user_id)
            _, open_week_start, _ = self._get_task_generation_dates(user_id=user_id)
            self.task_service.delete_untouched_pending_tasks_for_rule(
                rule=rule,
                user_id=user_id,
                from_date=open_week_start,
            )
            self.goal_repository.delete_rule(rule=rule)

    def repeat_task(
        self,
        payload: RepeatTaskRequest,
        *,
        task_id: int,
        user_id: int,
    ) -> TaskResponse:
        with self.session.begin():
            task = self.task_service.get_owned_task(task_id=task_id, user_id=user_id)
            if task.goal_id is None:
                raise ValidationAppError({"goal_id": "Repeat needs a goal"}, "Repeat needs a goal")
            if task.rule_id is not None:
                raise ValidationAppError(
                    {"rule_id": "This task already repeats"},
                    "This task already repeats",
                )
            if task.scheduled_date is None:
                raise ValidationAppError(
                    {"scheduled_date": "Repeat needs a scheduled task"},
                    "Repeat needs a scheduled task",
                )
            if task.scheduled_date.isoweekday() not in payload.byweekday:
                raise ValidationAppError(
                    {"byweekday": "Repeat must include the task's own weekday"},
                    "Repeat must include the task's own weekday",
                )
            goal = self._get_owned_goal(goal_id=task.goal_id, user_id=user_id)
            rule = self.goal_repository.create_rule(
                goal_id=goal.id,
                byweekday=payload.byweekday,
                start_time=task.start_time,
                duration_minutes=task.duration_minutes,
                block_count=float(task.block_count) if task.block_count is not None else None,
            )
            # The task stands in for the rule's occurrence on its date, so generation skips it.
            self.task_service.attach_to_rule(task=task, rule=rule)
            self._add_tasks_for_current_window(user_id=user_id)
            response = TaskResponse.model_validate(task)
        return response

    def stop_repeating_task(self, *, task_id: int, user_id: int) -> TaskResponse:
        with self.session.begin():
            task = self.task_service.get_owned_task(task_id=task_id, user_id=user_id)
            if task.rule_id is None:
                raise ValidationAppError(
                    {"rule_id": "This task does not repeat"},
                    "This task does not repeat",
                )
            rule = self._get_owned_rule(rule_id=task.rule_id, user_id=user_id)
            # Detach first so the rule's cleanup below keeps this task.
            self.task_service.detach_from_rule(task=task)
            _, open_week_start, _ = self._get_task_generation_dates(user_id=user_id)
            self.task_service.delete_untouched_pending_tasks_for_rule(
                rule=rule,
                user_id=user_id,
                from_date=open_week_start,
            )
            self.goal_repository.delete_rule(rule=rule)
            response = TaskResponse.model_validate(task)
        return response

    def _add_tasks_for_current_window(self, *, user_id: int) -> None:
        today, _, window_end = self._get_task_generation_dates(user_id=user_id)
        self.task_service.add_tasks(
            user_id=user_id,
            from_date=today,
            to_date=window_end,
        )

    def _get_task_generation_dates(self, *, user_id: int) -> tuple[date, date, date]:
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError

        today = datetime.now(ZoneInfo(user.timezone)).date()
        open_week_start = get_week_start(
            today,
            week_start_day=user.week_start_day,
        )
        window_end = today + timedelta(days=TASK_GENERATION_DAYS - 1)
        return today, open_week_start, window_end

    def _get_owned_goal(self, *, goal_id: int, user_id: int) -> Goal:
        goal = self.goal_repository.get_for_user(goal_id=goal_id, user_id=user_id)
        if goal is None:
            raise NotFoundError
        return goal

    def _get_owned_rule(self, *, rule_id: int, user_id: int) -> GoalRule:
        rule = self.goal_repository.get_rule_for_user(rule_id=rule_id, user_id=user_id)
        if rule is None:
            raise NotFoundError
        return rule

    def _ensure_active_area(self, *, area_id: int, user_id: int) -> None:
        if self.area_repository.get_active_for_user(area_id=area_id, user_id=user_id) is None:
            raise NotFoundError
