from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Goal, GoalRule
from app.repositories.areas import AreaRepository
from app.repositories.goals import GoalRepository
from app.schemas.goals import (
    CreateGoalRequest,
    CreateGoalRuleRequest,
    GoalListResponse,
    GoalResponse,
    GoalRuleResponse,
    UpdateGoalRequest,
    UpdateGoalRuleRequest,
)


class GoalService:
    def __init__(
        self,
        session: Session,
        goal_repository: GoalRepository,
        area_repository: AreaRepository,
    ) -> None:
        self.session = session
        self.goal_repository = goal_repository
        self.area_repository = area_repository

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
            self.goal_repository.update_rule(
                rule=rule,
                byweekday=payload.byweekday,
                start_time=payload.start_time,
                duration_minutes=payload.duration_minutes,
                block_count=payload.block_count,
            )
            response = GoalRuleResponse.model_validate(rule)
        return response

    def delete_rule(self, *, rule_id: int, user_id: int) -> None:
        with self.session.begin():
            rule = self._get_owned_rule(rule_id=rule_id, user_id=user_id)
            self.goal_repository.delete_rule(rule=rule)

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
