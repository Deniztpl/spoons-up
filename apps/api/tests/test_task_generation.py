from datetime import UTC, date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Goal, Task, TaskStatus, User
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.services import goals as goals_service_module
from app.services.tasks import TaskService

pytestmark = pytest.mark.integration

FIXED_NOW = datetime(2026, 9, 23, 12, tzinfo=ZoneInfo("Europe/Istanbul"))


def test_rule_creation_adds_the_current_window_idempotently(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "task-generation@example.com"))

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "task-generation@example.com"))
        assert user is not None
        user.week_start_day = 7

    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))
    rule = create_rule(
        client,
        headers,
        goal_id=str(goal["id"]),
        byweekday=[1, 3, 5],
        start_time="23:30",
        duration_minutes=90,
        block_count=2,
    )

    expected_dates = [
        date(2026, 9, 23),
        date(2026, 9, 25),
        date(2026, 9, 28),
        date(2026, 9, 30),
        date(2026, 10, 2),
        date(2026, 10, 5),
    ]
    tasks = list(
        db_session.scalars(
            select(Task).where(Task.rule_id == int(str(rule["id"]))).order_by(Task.id)
        )
    )

    assert [task.occurrence_date for task in tasks] == expected_dates
    assert all(task.scheduled_date == task.occurrence_date for task in tasks)
    assert all(task.start_time == time(23, 30) for task in tasks)
    assert all(task.end_time == time(1) for task in tasks)
    assert all(task.block_count == Decimal("2.0") for task in tasks)
    assert tasks[0].period_start == date(2026, 9, 20)
    assert tasks[-1].period_start == date(2026, 10, 4)

    db_session.rollback()
    with db_session.begin():
        task_service = TaskService(
            TaskRepository(db_session),
            UserRepository(db_session),
        )
        task_service.add_tasks(
            user_id=user.id,
            from_date=date(2026, 9, 23),
            to_date=date(2026, 10, 6),
        )

    repeated_tasks = list(
        db_session.scalars(select(Task).where(Task.rule_id == int(str(rule["id"]))))
    )
    assert len(repeated_tasks) == len(expected_dates)


def test_rule_update_clears_open_week_but_only_regenerates_from_today(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "task-rule-update@example.com"))
    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))
    rule = create_rule(
        client,
        headers,
        goal_id=str(goal["id"]),
        byweekday=[1, 2, 4, 5],
        start_time="09:00",
        duration_minutes=60,
        block_count=1,
    )
    rule_id = int(str(rule["id"]))

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "task-rule-update@example.com"))
        goal_model = db_session.get(Goal, int(str(goal["id"])))
        thursday_task = db_session.scalar(
            select(Task).where(
                Task.rule_id == rule_id,
                Task.occurrence_date == date(2026, 9, 24),
            )
        )
        deleted_task = db_session.scalar(
            select(Task).where(
                Task.rule_id == rule_id,
                Task.occurrence_date == date(2026, 10, 2),
            )
        )
        assert user is not None
        assert goal_model is not None
        assert thursday_task is not None
        assert deleted_task is not None

        thursday_task.scheduled_date = date(2026, 9, 26)
        deleted_task.status = TaskStatus.DELETED.value
        db_session.add_all(
            [
                build_task(
                    user=user,
                    goal=goal_model,
                    rule_id=rule_id,
                    occurrence_date=date(2026, 9, 21),
                ),
                build_task(
                    user=user,
                    goal=goal_model,
                    rule_id=rule_id,
                    occurrence_date=date(2026, 9, 22),
                    status=TaskStatus.DONE,
                ),
            ]
        )

    response = client.patch(
        f"/api/v1/rules/{rule_id}",
        json={
            "byweekday": [1, 4, 6],
            "start_time": "10:00",
            "duration_minutes": 30,
            "block_count": 0.5,
        },
        headers=headers,
    )

    assert response.status_code == 200
    tasks = list(
        db_session.scalars(
            select(Task).where(Task.rule_id == rule_id).order_by(Task.occurrence_date)
        )
    )
    tasks_by_date = {task.occurrence_date: task for task in tasks}

    assert date(2026, 9, 21) not in tasks_by_date
    assert tasks_by_date[date(2026, 9, 22)].status == TaskStatus.DONE.value
    assert tasks_by_date[date(2026, 9, 24)].scheduled_date == date(2026, 9, 26)
    assert tasks_by_date[date(2026, 9, 24)].start_time == time(9)
    assert date(2026, 9, 25) not in tasks_by_date
    assert tasks_by_date[date(2026, 10, 2)].status == TaskStatus.DELETED.value

    regenerated_dates = {
        date(2026, 9, 26),
        date(2026, 9, 28),
        date(2026, 10, 1),
        date(2026, 10, 3),
        date(2026, 10, 5),
    }
    assert regenerated_dates <= tasks_by_date.keys()
    assert all(tasks_by_date[value].start_time == time(10) for value in regenerated_dates)
    assert all(tasks_by_date[value].block_count == Decimal("0.5") for value in regenerated_dates)


def test_rule_delete_removes_only_untouched_pending_tasks_from_the_open_week(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "task-rule-delete@example.com"))
    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))
    rule = create_rule(
        client,
        headers,
        goal_id=str(goal["id"]),
        byweekday=[1, 3, 4, 5],
        start_time="09:00",
        duration_minutes=60,
        block_count=1,
    )
    rule_id = int(str(rule["id"]))

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "task-rule-delete@example.com"))
        goal_model = db_session.get(Goal, int(str(goal["id"])))
        moved_task = db_session.scalar(
            select(Task).where(
                Task.rule_id == rule_id,
                Task.occurrence_date == date(2026, 9, 24),
            )
        )
        done_task = db_session.scalar(
            select(Task).where(
                Task.rule_id == rule_id,
                Task.occurrence_date == date(2026, 9, 25),
            )
        )
        assert user is not None
        assert goal_model is not None
        assert moved_task is not None
        assert done_task is not None

        moved_task.scheduled_date = date(2026, 9, 27)
        done_task.status = TaskStatus.DONE.value
        done_task.completed_at = datetime(2026, 9, 25, 8, tzinfo=UTC)
        db_session.add(
            build_task(
                user=user,
                goal=goal_model,
                rule_id=rule_id,
                occurrence_date=date(2026, 9, 21),
            )
        )

    response = client.delete(f"/api/v1/rules/{rule_id}", headers=headers)

    assert response.status_code == 204
    remaining_tasks = list(
        db_session.scalars(
            select(Task).where(Task.goal_id == int(str(goal["id"]))).order_by(Task.id)
        )
    )
    assert {(task.occurrence_date, task.status) for task in remaining_tasks} == {
        (date(2026, 9, 24), TaskStatus.PENDING.value),
        (date(2026, 9, 25), TaskStatus.DONE.value),
    }
    assert all(task.rule_id is None for task in remaining_tasks)


def build_task(
    *,
    user: User,
    goal: Goal,
    rule_id: int,
    occurrence_date: date,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        user_id=user.id,
        goal_id=goal.id,
        rule_id=rule_id,
        title=goal.title,
        occurrence_date=occurrence_date,
        scheduled_date=occurrence_date,
        start_time=time(9),
        end_time=time(10),
        block_count=Decimal("1.0"),
        period_start=date(2026, 9, 21),
        status=status.value,
    )


def freeze_goal_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return FIXED_NOW if tz is None else FIXED_NOW.astimezone(tz)

    monkeypatch.setattr(goals_service_module, "datetime", FixedDateTime)


def register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "password123",
            "timezone": "Europe/Istanbul",
        },
    )
    assert response.status_code == 201
    return response.json()


def bearer(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def create_area(client: TestClient, headers: dict[str, str]) -> dict[str, object]:
    response = client.post("/api/v1/areas", json={"name": "Work"}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_goal(
    client: TestClient,
    headers: dict[str, str],
    *,
    area_id: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/goals",
        json={"area_id": area_id, "title": "Deep work", "weekly_target": 4},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_rule(
    client: TestClient,
    headers: dict[str, str],
    *,
    goal_id: str,
    byweekday: list[int],
    start_time: str,
    duration_minutes: int,
    block_count: float,
) -> dict[str, object]:
    response = client.post(
        f"/api/v1/goals/{goal_id}/rules",
        json={
            "byweekday": byweekday,
            "start_time": start_time,
            "duration_minutes": duration_minutes,
            "block_count": block_count,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()
