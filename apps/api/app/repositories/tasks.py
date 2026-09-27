from datetime import date, datetime

from sqlalchemy import Select, and_, delete, or_, select
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

    def list_for_today(self, *, user_id: int, target_date: date) -> list[Task]:
        query = (
            self._select_visible_tasks_for_user(user_id=user_id)
            .where(Task.scheduled_date == target_date)
            .order_by(Task.start_time, Task.id)
        )
        return list(self.session.scalars(query))

    def get_task_and_lock(self, *, task_id: int, user_id: int) -> Task | None:
        return self.session.scalar(
            self._select_visible_tasks_for_user(user_id=user_id)
            .where(Task.id == task_id)
            .with_for_update(of=Task)
        )

    def complete(self, *, task: Task, completed_at: datetime) -> None:
        if task.status == TaskStatus.DONE.value:
            return
        task.status = TaskStatus.DONE.value
        task.completed_at = completed_at
        self.session.flush()

    def uncomplete(self, *, task: Task) -> None:
        if task.status == TaskStatus.PENDING.value:
            return
        task.status = TaskStatus.PENDING.value
        task.completed_at = None
        self.session.flush()

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

    def delete_pending_tasks_for_area(
        self,
        *,
        area_id: int,
        user_id: int,
        from_date: date,
    ) -> None:
        goal_ids = select(Goal.id).where(
            Goal.area_id == area_id,
            Goal.user_id == user_id,
        )
        query = delete(Task).where(
            Task.user_id == user_id,
            Task.goal_id.in_(goal_ids),
            Task.scheduled_date >= from_date,
            Task.status == TaskStatus.PENDING.value,
        )
        self.session.execute(query)

    def _select_visible_tasks_for_user(self, *, user_id: int) -> Select[tuple[Task]]:
        """Select non-deleted tasks that are standalone or under an active area."""
        return (
            select(Task)
            .outerjoin(Goal, Task.goal_id == Goal.id)
            .outerjoin(Area, Goal.area_id == Area.id)
            .where(
                Task.user_id == user_id,
                Task.status != TaskStatus.DELETED.value,
                or_(
                    Task.goal_id.is_(None),
                    and_(
                        Goal.user_id == user_id,
                        Area.user_id == user_id,
                        Area.archived_at.is_(None),
                    ),
                ),
            )
        )
