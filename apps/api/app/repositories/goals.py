from datetime import time
from decimal import Decimal

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.models import Area, Goal, GoalRule


class GoalRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(self, *, user_id: int, area_id: int | None) -> list[Goal]:
        query = self._select_active_goals_for_user(user_id=user_id)
        if area_id is not None:
            query = query.where(Goal.area_id == area_id)
        return list(self.session.scalars(query.order_by(Goal.created_at, Goal.id)))

    def get_for_user(self, *, goal_id: int, user_id: int) -> Goal | None:
        return self.session.scalar(
            self._select_active_goals_for_user(user_id=user_id).where(Goal.id == goal_id)
        )

    def get_rule_for_user(self, *, rule_id: int, user_id: int) -> GoalRule | None:
        return self.session.scalar(
            select(GoalRule)
            .join(Goal, GoalRule.goal_id == Goal.id)
            .join(Area, Goal.area_id == Area.id)
            .where(
                GoalRule.id == rule_id,
                Goal.user_id == user_id,
                Area.user_id == user_id,
                Area.archived_at.is_(None),
            )
        )

    def create(
        self,
        *,
        user_id: int,
        area_id: int,
        title: str,
        weekly_target: int | None,
    ) -> Goal:
        goal = Goal(
            user_id=user_id,
            area_id=area_id,
            title=title,
            weekly_target=weekly_target,
        )
        self.session.add(goal)
        self.session.flush()
        return goal

    def update(
        self,
        *,
        goal: Goal,
        area_id: int | None,
        title: str | None,
        weekly_target: int | None,
        update_weekly_target: bool,
    ) -> Goal:
        if area_id is not None:
            goal.area_id = area_id
        if title is not None:
            goal.title = title
        if update_weekly_target:
            goal.weekly_target = weekly_target
        self.session.flush()
        return goal

    def delete(self, *, goal: Goal) -> None:
        self.session.delete(goal)

    def create_rule(
        self,
        *,
        goal_id: int,
        byweekday: list[int],
        start_time: time,
        duration_minutes: int,
        block_count: float,
    ) -> GoalRule:
        rule = GoalRule(
            goal_id=goal_id,
            byweekday=byweekday,
            start_time=start_time,
            duration_minutes=duration_minutes,
            block_count=Decimal(str(block_count)),
        )
        self.session.add(rule)
        self.session.flush()
        return rule

    def update_rule(
        self,
        *,
        rule: GoalRule,
        byweekday: list[int] | None,
        start_time: time | None,
        duration_minutes: int | None,
        block_count: float | None,
    ) -> GoalRule:
        if byweekday is not None:
            rule.byweekday = byweekday
        if start_time is not None:
            rule.start_time = start_time
        if duration_minutes is not None:
            rule.duration_minutes = duration_minutes
        if block_count is not None:
            rule.block_count = Decimal(str(block_count))
        self.session.flush()
        return rule

    def delete_rule(self, *, rule: GoalRule) -> None:
        self.session.delete(rule)

    def _select_active_goals_for_user(self, *, user_id: int) -> Select[tuple[Goal]]:
        """Select the user's goals whose parent area is not archived."""
        return (
            select(Goal)
            .options(selectinload(Goal.rules))
            .join(Area, Goal.area_id == Area.id)
            .where(
                Goal.user_id == user_id,
                Area.user_id == user_id,
                Area.archived_at.is_(None),
            )
        )
