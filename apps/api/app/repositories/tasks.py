from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Area, Goal, GoalRule, Task, TaskStatus


class TaskRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_active_rules_for_user(self, *, user_id: int) -> list[tuple[Goal, GoalRule]]:
        query = (
            select(Goal, GoalRule)
            .join(GoalRule, GoalRule.goal_id == Goal.id)
            .join(Area, Goal.area_id == Area.id)
            .where(
                Goal.user_id == user_id,
                Area.user_id == user_id,
                Area.archived_at.is_(None),
            )
            .order_by(Goal.id, GoalRule.id)
        )
        return [(goal, rule) for goal, rule in self.session.execute(query)]

    def add_generated_tasks(self, *, task_values: list[dict[str, object]]) -> None:
        if not task_values:
            return

        query = insert(Task).values(task_values).on_conflict_do_nothing()
        self.session.execute(query)

    def delete_untouched_pending_tasks_for_rule(
        self,
        *,
        rule_id: int,
        user_id: int,
        from_date: date,
    ) -> None:
        query = delete(Task).where(
            Task.rule_id == rule_id,
            Task.user_id == user_id,
            Task.occurrence_date >= from_date,
            Task.status == TaskStatus.PENDING.value,
            Task.scheduled_date == Task.occurrence_date,
        )
        self.session.execute(query)
