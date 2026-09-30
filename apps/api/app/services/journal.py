from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Task, TaskStatus
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.journal import (
    JournalItemResponse,
    JournalProgressResponse,
    JournalResponse,
    JournalStepResponse,
)


class JournalService:
    def __init__(
        self,
        session: Session,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.task_repository = task_repository
        self.user_repository = user_repository

    def get(self, *, user_id: int) -> JournalResponse:
        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise NotFoundError

            active = self.task_repository.list_active_journal_items(user_id=user_id)
            completed = self.task_repository.list_completed_journal_items(user_id=user_id)
            parent_ids = [task.id for task in [*active, *completed]]
            steps = self.task_repository.list_journal_steps(
                user_id=user_id,
                parent_ids=parent_ids,
            )
            steps_by_parent: dict[int, list[Task]] = defaultdict(list)
            for step in steps:
                if step.parent_id is not None:
                    steps_by_parent[step.parent_id].append(step)

            today = datetime.now(ZoneInfo(user.timezone)).date()
            return JournalResponse(
                today=today,
                active=[self._item_response(task, steps_by_parent[task.id]) for task in active],
                completed=[
                    self._item_response(task, steps_by_parent[task.id]) for task in completed
                ],
            )

    @staticmethod
    def _item_response(task: Task, steps: list[Task]) -> JournalItemResponse:
        step_responses = [JournalStepResponse.model_validate(step) for step in steps]
        return JournalItemResponse(
            id=str(task.id),
            title=task.title,
            due_date=task.due_date,
            priority=task.priority,
            scheduled_date=task.scheduled_date,
            start_time=task.start_time,
            duration_minutes=task.duration_minutes,
            end_time=task.end_time,
            block_count=float(task.block_count) if task.block_count is not None else None,
            status=task.status,
            completed_at=task.completed_at,
            created_at=task.created_at,
            progress=JournalProgressResponse(
                done=sum(step.status == TaskStatus.DONE.value for step in steps),
                total=len(steps),
            ),
            steps=step_responses,
        )
