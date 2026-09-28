from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GoalRule, Task, TaskStatus, User
from app.services import tasks as tasks_service_module

pytestmark = pytest.mark.integration

COMPLETED_AT = datetime(2026, 9, 27, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def fixed_task_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_task_service_time(monkeypatch)


def test_task_completion_is_idempotent_and_reversible(
    client: TestClient,
    db_session: Session,
) -> None:
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
        "duration_minutes": None,
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


def test_create_standalone_and_goal_linked_tasks(client: TestClient) -> None:
    headers = bearer(register(client, "create-task@example.com"))
    stranger_headers = bearer(register(client, "create-task-stranger@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")

    standalone = client.post(
        "/api/v1/tasks",
        json={
            "title": "  Dentist  ",
            "scheduled_date": "2026-09-27",
        },
        headers=headers,
    )
    linked = client.post(
        "/api/v1/tasks",
        json={
            "goal_id": goal["id"],
            "scheduled_date": "2026-09-27",
            "start_time": "09:30",
            "duration_minutes": 60,
            "block_count": 1.5,
        },
        headers=headers,
    )
    missing_title = client.post(
        "/api/v1/tasks",
        json={"scheduled_date": "2026-09-27"},
        headers=headers,
    )
    linked_title = client.post(
        "/api/v1/tasks",
        json={
            "goal_id": goal["id"],
            "title": "Override",
            "scheduled_date": "2026-09-27",
        },
        headers=headers,
    )
    foreign_goal = client.post(
        "/api/v1/tasks",
        json={"goal_id": goal["id"], "scheduled_date": "2026-09-27"},
        headers=stranger_headers,
    )

    assert standalone.status_code == 201
    assert standalone.json() | {"id": "ignored", "completed_at": None} == {
        "id": "ignored",
        "goal_id": None,
        "rule_id": None,
        "title": "Dentist",
        "occurrence_date": None,
        "scheduled_date": "2026-09-27",
        "start_time": None,
        "duration_minutes": None,
        "end_time": None,
        "block_count": None,
        "period_start": "2026-09-21",
        "status": "PENDING",
        "completed_at": None,
    }
    assert linked.status_code == 201
    assert linked.json()["title"] == "Deep work"
    assert linked.json()["goal_id"] == goal["id"]
    assert linked.json()["end_time"] == "10:30"
    assert linked.json()["block_count"] == 1.5
    assert missing_title.status_code == 422
    assert missing_title.json()["fields"] == {"title": "Title is required without a goal"}
    assert linked_title.status_code == 422
    assert linked_title.json()["fields"] == {"title": "Title comes from the selected goal"}
    assert foreign_goal.status_code == 404


def test_create_rejects_a_date_before_today_in_the_user_timezone(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_task_service_time(
        monkeypatch,
        observed_at=datetime(2026, 9, 27, 22, 30, tzinfo=UTC),
    )
    headers = bearer(register(client, "create-task-date@example.com"))

    past = client.post(
        "/api/v1/tasks",
        json={"title": "Past", "scheduled_date": "2026-09-27"},
        headers=headers,
    )
    today = client.post(
        "/api/v1/tasks",
        json={"title": "Today", "scheduled_date": "2026-09-28"},
        headers=headers,
    )
    future = client.post(
        "/api/v1/tasks",
        json={"title": "Future", "scheduled_date": "2030-01-01"},
        headers=headers,
    )

    assert past.status_code == 422
    assert past.json()["fields"] == {"scheduled_date": "Scheduled date cannot be before today"}
    assert today.status_code == 201
    assert future.status_code == 201


def test_update_task_changes_only_editable_task_values(client: TestClient) -> None:
    headers = bearer(register(client, "update-task@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")
    standalone = client.post(
        "/api/v1/tasks",
        json={"title": "Draft", "scheduled_date": "2026-09-27"},
        headers=headers,
    ).json()
    linked = client.post(
        "/api/v1/tasks",
        json={"goal_id": goal["id"], "scheduled_date": "2026-09-27"},
        headers=headers,
    ).json()

    updated = client.patch(
        f"/api/v1/tasks/{standalone['id']}",
        json={
            "title": "  Appointment  ",
            "scheduled_date": "2026-10-01",
            "start_time": "23:30",
            "duration_minutes": 90,
            "block_count": 2,
        },
        headers=headers,
    )
    cleared = client.patch(
        f"/api/v1/tasks/{standalone['id']}",
        json={"start_time": None, "duration_minutes": None, "block_count": None},
        headers=headers,
    )
    linked_title = client.patch(
        f"/api/v1/tasks/{linked['id']}",
        json={"title": "Override"},
        headers=headers,
    )

    assert updated.status_code == 200
    assert updated.json()["title"] == "Appointment"
    assert updated.json()["scheduled_date"] == "2026-10-01"
    assert updated.json()["end_time"] == "01:00"
    assert updated.json()["block_count"] == 2
    assert updated.json()["period_start"] == "2026-09-21"
    assert cleared.status_code == 200
    assert cleared.json()["start_time"] is None
    assert cleared.json()["duration_minutes"] is None
    assert cleared.json()["end_time"] is None
    assert cleared.json()["block_count"] is None
    assert linked_title.status_code == 422
    assert linked_title.json()["fields"] == {"title": "A goal-linked task uses its goal title"}


def test_update_rejects_a_supplied_past_date_but_allows_other_changes(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = bearer(register(client, "update-task-date@example.com"))
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Draft", "scheduled_date": "2026-09-27"},
        headers=headers,
    ).json()
    freeze_task_service_time(
        monkeypatch,
        observed_at=datetime(2026, 9, 28, 22, 30, tzinfo=UTC),
    )

    title_only = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"title": "Updated draft"},
        headers=headers,
    )
    past_date = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"scheduled_date": "2026-09-28"},
        headers=headers,
    )

    assert title_only.status_code == 200
    assert title_only.json()["title"] == "Updated draft"
    assert title_only.json()["scheduled_date"] == "2026-09-27"
    assert past_date.status_code == 422
    assert past_date.json()["fields"] == {"scheduled_date": "Scheduled date cannot be before today"}


def test_moving_a_generated_task_keeps_its_occurrence_and_period(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "move-generated-task@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")

    with db_session.begin():
        user = get_user(db_session, "move-generated-task@example.com")
        rule = GoalRule(
            goal_id=int(str(goal["id"])),
            byweekday=[7],
            start_time=None,
            duration_minutes=None,
            block_count=None,
        )
        db_session.add(rule)
        db_session.flush()
        generated = build_task(
            user_id=user.id,
            goal_id=int(str(goal["id"])),
            rule_id=rule.id,
            occurrence_date=date(2026, 9, 20),
        )
        db_session.add(generated)
        db_session.flush()
        task_id = str(generated.id)

    moved = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"scheduled_date": "2026-10-01"},
        headers=headers,
    )

    assert moved.status_code == 200
    assert moved.json()["scheduled_date"] == "2026-10-01"
    assert moved.json()["occurrence_date"] == "2026-09-20"
    assert moved.json()["period_start"] == "2026-09-14"


def test_delete_is_hard_for_ad_hoc_and_soft_for_generated_tasks(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "delete-task@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")
    ad_hoc = client.post(
        "/api/v1/tasks",
        json={"title": "One off", "scheduled_date": "2026-09-27"},
        headers=headers,
    ).json()

    with db_session.begin():
        user = get_user(db_session, "delete-task@example.com")
        rule = GoalRule(
            goal_id=int(str(goal["id"])),
            byweekday=[7],
            start_time=None,
            duration_minutes=None,
            block_count=None,
        )
        db_session.add(rule)
        db_session.flush()
        generated = build_task(
            user_id=user.id,
            goal_id=int(str(goal["id"])),
            rule_id=rule.id,
            occurrence_date=date(2026, 9, 27),
        )
        db_session.add(generated)
        db_session.flush()
        generated_id = str(generated.id)

    ad_hoc_deleted = client.delete(f"/api/v1/tasks/{ad_hoc['id']}", headers=headers)
    generated_deleted = client.delete(f"/api/v1/tasks/{generated_id}", headers=headers)

    assert ad_hoc_deleted.status_code == 204
    assert generated_deleted.status_code == 204
    with db_session.begin():
        assert db_session.get(Task, int(ad_hoc["id"])) is None
        stored_generated = db_session.get(Task, int(generated_id))
        assert stored_generated is not None
        assert stored_generated.status == TaskStatus.DELETED.value
        assert stored_generated.completed_at is None

    assert client.post(f"/api/v1/tasks/{generated_id}/check", headers=headers).status_code == 404


def freeze_task_service_time(
    monkeypatch: pytest.MonkeyPatch,
    *,
    observed_at: datetime = COMPLETED_AT,
) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return observed_at if tz is None else observed_at.astimezone(tz)

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
    rule_id: int | None = None,
    occurrence_date: date | None = None,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        user_id=user_id,
        goal_id=goal_id,
        rule_id=rule_id,
        title="Deep work",
        occurrence_date=occurrence_date,
        scheduled_date=date(2026, 9, 20),
        start_time=time(9),
        end_time=time(10),
        block_count=Decimal("2.0"),
        period_start=date(2026, 9, 14),
        status=status.value,
    )
