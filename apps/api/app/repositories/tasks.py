from datetime import date, datetime, time
from decimal import Decimal

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
            .order_by(Task.start_time.asc().nulls_last(), Task.id)
        )
        return list(self.session.scalars(query))

    def list_for_week(
        self,
        *,
        user_id: int,
        week_start: date,
        week_end: date,
    ) -> list[Task]:
        query = (
            self._select_visible_tasks_for_user(user_id=user_id)
            .where(
                Task.scheduled_date >= week_start,
                Task.scheduled_date <= week_end,
            )
            .order_by(
                Task.scheduled_date,
                Task.start_time.asc().nulls_last(),
                Task.id,
            )
        )
        return list(self.session.scalars(query))

    def list_later_tasks(
        self,
        *,
        user_id: int,
        cutoff_date: date,
    ) -> list[Task]:
        query = (
            self._select_visible_tasks_for_user(user_id=user_id)
            .where(
                Task.scheduled_date > cutoff_date,
                or_(
                    Task.occurrence_date.is_(None),
                    Task.scheduled_date != Task.occurrence_date,
                ),
            )
            .order_by(
                Task.scheduled_date,
                Task.start_time.asc().nulls_last(),
                Task.id,
            )
        )
        return list(self.session.scalars(query))

    def get_task_and_lock(self, *, task_id: int, user_id: int) -> Task | None:
        return self.session.scalar(
            self._select_visible_tasks_for_user(user_id=user_id)
            .where(Task.id == task_id)
            .with_for_update(of=Task)
        )

    def create(
        self,
        *,
        user_id: int,
        goal_id: int | None,
        title: str,
        scheduled_date: date,
        start_time: time | None,
        duration_minutes: int | None,
        end_time: time | None,
        block_count: float | None,
        period_start: date,
    ) -> Task:
        task = Task(
            user_id=user_id,
            goal_id=goal_id,
            rule_id=None,
            title=title,
            occurrence_date=None,
            scheduled_date=scheduled_date,
            start_time=start_time,
            duration_minutes=duration_minutes,
            end_time=end_time,
            block_count=Decimal(str(block_count)) if block_count is not None else None,
            period_start=period_start,
        )
        self.session.add(task)
        self.session.flush()
        return task

    def update(
        self,
        *,
        task: Task,
        title: str,
        scheduled_date: date,
        start_time: time | None,
        duration_minutes: int | None,
        end_time: time | None,
        block_count: float | None,
        update_title: bool,
        update_scheduled_date: bool,
        update_start_time: bool,
        update_duration_minutes: bool,
        update_end_time: bool,
        update_block_count: bool,
    ) -> Task:
        if update_title:
            task.title = title
        if update_scheduled_date:
            task.scheduled_date = scheduled_date
        if update_start_time:
            task.start_time = start_time
        if update_duration_minutes:
            task.duration_minutes = duration_minutes
        if update_end_time:
            task.end_time = end_time
        if update_block_count:
            task.block_count = Decimal(str(block_count)) if block_count is not None else None
        self.session.flush()
        return task

    def set_rule(
        self,
        *,
        task: Task,
        rule_id: int | None,
        occurrence_date: date | None,
    ) -> Task:
        task.rule_id = rule_id
        task.occurrence_date = occurrence_date
        self.session.flush()
        return task

    def delete(self, *, task: Task) -> None:
        if task.occurrence_date is None:
            self.session.delete(task)
            return
        task.status = TaskStatus.DELETED.value
        task.completed_at = None
        self.session.flush()

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
        start_time: time | None,
        duration_minutes: int | None,
        block_count: Decimal | None,
    ) -> None:
        query = delete(Task).where(
            Task.rule_id == rule_id,
            Task.user_id == user_id,
            Task.occurrence_date >= from_date,
            Task.status == TaskStatus.PENDING.value,
            Task.scheduled_date == Task.occurrence_date,
            Task.start_time.is_(None) if start_time is None else Task.start_time == start_time,
            (
                Task.duration_minutes.is_(None)
                if duration_minutes is None
                else Task.duration_minutes == duration_minutes
            ),
            (
                Task.block_count.is_(None)
                if block_count is None
                else Task.block_count == block_count
            ),
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
