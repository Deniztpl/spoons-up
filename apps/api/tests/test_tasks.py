from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task, TaskStatus, User
from app.services import tasks as tasks_service_module

pytestmark = pytest.mark.integration

COMPLETED_AT = datetime(2026, 9, 27, 12, tzinfo=UTC)


def test_task_completion_is_idempotent_and_reversible(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_task_service_time(monkeypatch)
    headers = bearer(register(client, "complete-task@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")

    with db_session.begin():
        user = get_user(db_session, "complete-task@example.com")
        task = build_task(user_id=user.id, goal_id=int(str(goal["id"])))
        db_session.add(task)
        db_session.flush()
        task_id = str(task.id)

    completed = client.post(f"/api/v1/tasks/{task_id}/check", headers=headers)
    completed_again = client.post(f"/api/v1/tasks/{task_id}/check", headers=headers)
    uncompleted = client.delete(f"/api/v1/tasks/{task_id}/check", headers=headers)
    uncompleted_again = client.delete(f"/api/v1/tasks/{task_id}/check", headers=headers)

    assert completed.status_code == 200
    assert completed.json() == {
        "id": task_id,
        "goal_id": goal["id"],
        "rule_id": None,
        "title": "Deep work",
        "occurrence_date": None,
        "scheduled_date": "2026-09-20",
        "start_time": "09:00",
        "end_time": "10:00",
        "block_count": 2.0,
        "period_start": "2026-09-14",
        "status": "DONE",
        "completed_at": "2026-09-27T12:00:00Z",
    }
    assert completed_again.json() == completed.json()
    assert uncompleted.status_code == 200
    assert uncompleted.json()["status"] == "PENDING"
    assert uncompleted.json()["completed_at"] is None
    assert uncompleted_again.json() == uncompleted.json()

    with db_session.begin():
        stored_task = db_session.get(Task, int(task_id))
        assert stored_task is not None
        assert stored_task.status == TaskStatus.PENDING.value
        assert stored_task.completed_at is None


def test_task_completion_is_scoped_and_excludes_unavailable_tasks(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_headers = bearer(register(client, "task-owner@example.com"))
    stranger_headers = bearer(register(client, "task-stranger@example.com"))
    area = create_area(client, owner_headers, "Private")
    goal = create_goal(client, owner_headers, area_id=str(area["id"]), title="Private task")

    with db_session.begin():
        owner = get_user(db_session, "task-owner@example.com")
        archived_task = build_task(user_id=owner.id, goal_id=int(str(goal["id"])))
        deleted_task = build_task(
            user_id=owner.id,
            goal_id=None,
            status=TaskStatus.DELETED,
        )
        standalone_task = build_task(user_id=owner.id, goal_id=None)
        db_session.add_all([archived_task, deleted_task, standalone_task])
        db_session.flush()
        archived_task_id = str(archived_task.id)
        deleted_task_id = str(deleted_task.id)
        standalone_task_id = str(standalone_task.id)

    stranger_response = client.post(
        f"/api/v1/tasks/{archived_task_id}/check",
        headers=stranger_headers,
    )
    archived = client.post(
        f"/api/v1/areas/{area['id']}/archive",
        json={"archived": True},
        headers=owner_headers,
    )
    archived_response = client.post(
        f"/api/v1/tasks/{archived_task_id}/check",
        headers=owner_headers,
    )
    deleted_response = client.post(
        f"/api/v1/tasks/{deleted_task_id}/check",
        headers=owner_headers,
    )
    missing_response = client.delete("/api/v1/tasks/999999/check", headers=owner_headers)
    standalone_response = client.post(
        f"/api/v1/tasks/{standalone_task_id}/check",
        headers=owner_headers,
    )
    unauthorized = client.post(f"/api/v1/tasks/{standalone_task_id}/check")

    assert stranger_response.status_code == 404
    assert archived.status_code == 200
    assert archived_response.status_code == 404
    assert deleted_response.status_code == 404
    assert missing_response.status_code == 404
    assert standalone_response.status_code == 200
    assert standalone_response.json()["status"] == "DONE"
    assert unauthorized.status_code == 401


def freeze_task_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return COMPLETED_AT if tz is None else COMPLETED_AT.astimezone(tz)

    monkeypatch.setattr(tasks_service_module, "datetime", FixedDateTime)


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


def create_area(
    client: TestClient,
    headers: dict[str, str],
    name: str,
) -> dict[str, object]:
    response = client.post("/api/v1/areas", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_goal(
    client: TestClient,
    headers: dict[str, str],
    *,
    area_id: str,
    title: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/goals",
        json={"area_id": area_id, "title": title, "weekly_target": 4},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def build_task(
    *,
    user_id: int,
    goal_id: int | None,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        user_id=user_id,
        goal_id=goal_id,
        rule_id=None,
        title="Deep work",
        occurrence_date=None,
        scheduled_date=date(2026, 9, 20),
        start_time=time(9),
        end_time=time(10),
        block_count=Decimal("2.0"),
        period_start=date(2026, 9, 14),
        status=status.value,
    )
