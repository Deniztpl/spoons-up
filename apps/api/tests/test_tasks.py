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
        "parent_id": None,
        "title": "Deep work",
        "occurrence_date": None,
        "scheduled_date": "2026-09-20",
        "due_date": None,
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
        "parent_id": None,
        "title": "Dentist",
        "occurrence_date": None,
        "scheduled_date": "2026-09-27",
        "due_date": None,
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


def test_create_journal_items_can_be_undated_or_driven_by_due_date(
    client: TestClient,
) -> None:
    headers = bearer(register(client, "create-journal-task@example.com"))

    undated = client.post(
        "/api/v1/tasks",
        json={"title": "Backlog item"},
        headers=headers,
    )
    due = client.post(
        "/api/v1/tasks",
        json={
            "title": "Conference",
            "scheduled_date": "2026-10-09",
            "due_date": "2026-10-02",
            "start_time": "10:00",
            "duration_minutes": 45,
        },
        headers=headers,
    )
    time_without_date = client.post(
        "/api/v1/tasks",
        json={"title": "Unplanned call", "start_time": "10:00"},
        headers=headers,
    )
    past_due = client.post(
        "/api/v1/tasks",
        json={"title": "Late", "due_date": "2026-09-26"},
        headers=headers,
    )

    assert undated.status_code == 201
    assert undated.json()["scheduled_date"] is None
    assert undated.json()["due_date"] is None
    assert undated.json()["period_start"] is None
    assert undated.json()["parent_id"] is None

    assert due.status_code == 201
    assert due.json()["scheduled_date"] == "2026-10-02"
    assert due.json()["due_date"] == "2026-10-02"
    assert due.json()["period_start"] == "2026-09-28"
    assert due.json()["end_time"] == "10:45"

    assert time_without_date.status_code == 422
    assert time_without_date.json()["fields"] == {
        "start_time": "Start time requires a scheduled date"
    }
    assert past_due.status_code == 422
    assert past_due.json()["fields"] == {
        "due_date": "Scheduled date cannot be before today"
    }


def test_goal_tasks_still_require_a_schedule_and_reject_journal_fields(
    client: TestClient,
) -> None:
    headers = bearer(register(client, "goal-task-fields@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")

    missing_schedule = client.post(
        "/api/v1/tasks",
        json={"goal_id": goal["id"]},
        headers=headers,
    )
    with_due = client.post(
        "/api/v1/tasks",
        json={
            "goal_id": goal["id"],
            "scheduled_date": "2026-09-27",
            "due_date": "2026-09-27",
        },
        headers=headers,
    )

    assert missing_schedule.status_code == 422
    assert missing_schedule.json()["fields"] == {
        "scheduled_date": "Scheduled date is required for a goal task"
    }
    assert with_due.status_code == 422
    assert with_due.json()["fields"] == {
        "due_date": "Due date is only available on a top-level Journal item"
    }


def test_create_step_requires_an_owned_top_level_journal_parent_and_title_only(
    client: TestClient,
) -> None:
    headers = bearer(register(client, "create-step@example.com"))
    stranger_headers = bearer(register(client, "create-step-stranger@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")
    goal_task = client.post(
        "/api/v1/tasks",
        json={"goal_id": goal["id"], "scheduled_date": "2026-09-27"},
        headers=headers,
    ).json()
    parent = client.post(
        "/api/v1/tasks",
        json={"title": "Launch"},
        headers=headers,
    ).json()

    step = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Prepare slides"},
        headers=headers,
    )
    nested = client.post(
        "/api/v1/tasks",
        json={"parent_id": step.json()["id"], "title": "Nested"},
        headers=headers,
    )
    planned_on_create = client.post(
        "/api/v1/tasks",
        json={
            "parent_id": parent["id"],
            "title": "Invite people",
            "scheduled_date": "2026-09-30",
        },
        headers=headers,
    )
    foreign_parent = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Cannot see it"},
        headers=stranger_headers,
    )
    goal_parent = client.post(
        "/api/v1/tasks",
        json={"parent_id": goal_task["id"], "title": "Not a Journal step"},
        headers=headers,
    )

    assert step.status_code == 201
    assert step.json()["parent_id"] == parent["id"]
    assert step.json()["goal_id"] is None
    assert step.json()["scheduled_date"] is None
    assert step.json()["due_date"] is None
    assert step.json()["period_start"] is None

    assert nested.status_code == 422
    assert nested.json()["fields"] == {
        "parent_id": "Parent must be a top-level Journal item"
    }
    assert planned_on_create.status_code == 422
    assert planned_on_create.json()["fields"] == {
        "scheduled_date": "A step is created with only parent_id and title"
    }
    assert foreign_parent.status_code == 404
    assert goal_parent.status_code == 422
    assert goal_parent.json()["fields"] == {
        "parent_id": "Parent must be a top-level Journal item"
    }


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


def test_due_date_controls_the_schedule_and_clearing_it_keeps_size_values(
    client: TestClient,
) -> None:
    headers = bearer(register(client, "update-journal-due@example.com"))
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Conference", "duration_minutes": 60, "block_count": 2},
        headers=headers,
    ).json()

    dated = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"due_date": "2026-10-01", "start_time": "09:00"},
        headers=headers,
    )
    planned_earlier = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"scheduled_date": "2026-09-30"},
        headers=headers,
    )
    due_wins = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"scheduled_date": "2026-10-09", "due_date": "2026-10-05"},
        headers=headers,
    )
    cleared = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"due_date": None, "start_time": "12:00"},
        headers=headers,
    )
    rescheduled = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"scheduled_date": "2026-10-12"},
        headers=headers,
    )
    moved_again = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"scheduled_date": "2026-10-20"},
        headers=headers,
    )

    assert dated.status_code == 200
    assert dated.json()["due_date"] == "2026-10-01"
    assert dated.json()["scheduled_date"] == "2026-10-01"
    assert dated.json()["period_start"] == "2026-09-28"
    assert dated.json()["end_time"] == "10:00"

    assert planned_earlier.status_code == 200
    assert planned_earlier.json()["due_date"] == "2026-10-01"
    assert planned_earlier.json()["scheduled_date"] == "2026-09-30"
    assert planned_earlier.json()["period_start"] == "2026-09-28"

    assert due_wins.status_code == 200
    assert due_wins.json()["due_date"] == "2026-10-05"
    assert due_wins.json()["scheduled_date"] == "2026-10-05"
    assert due_wins.json()["period_start"] == "2026-09-28"

    assert cleared.status_code == 200
    assert cleared.json()["due_date"] is None
    assert cleared.json()["scheduled_date"] is None
    assert cleared.json()["period_start"] is None
    assert cleared.json()["start_time"] is None
    assert cleared.json()["end_time"] is None
    assert cleared.json()["duration_minutes"] == 60
    assert cleared.json()["block_count"] == 2

    assert rescheduled.status_code == 200
    assert rescheduled.json()["due_date"] is None
    assert rescheduled.json()["period_start"] == "2026-10-12"
    assert moved_again.status_code == 200
    assert moved_again.json()["period_start"] == "2026-10-12"


def test_update_rejects_time_without_a_schedule_and_due_date_on_a_step_or_goal(
    client: TestClient,
) -> None:
    headers = bearer(register(client, "update-journal-fields@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")
    goal_task = client.post(
        "/api/v1/tasks",
        json={"goal_id": goal["id"], "scheduled_date": "2026-09-27"},
        headers=headers,
    ).json()
    parent = client.post(
        "/api/v1/tasks",
        json={"title": "Launch"},
        headers=headers,
    ).json()
    step = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Prepare slides"},
        headers=headers,
    ).json()

    time_without_schedule = client.patch(
        f"/api/v1/tasks/{parent['id']}",
        json={"start_time": "10:00"},
        headers=headers,
    )
    step_due = client.patch(
        f"/api/v1/tasks/{step['id']}",
        json={"due_date": "2026-10-01"},
        headers=headers,
    )
    goal_due = client.patch(
        f"/api/v1/tasks/{goal_task['id']}",
        json={"due_date": "2026-10-01"},
        headers=headers,
    )

    assert time_without_schedule.status_code == 422
    assert time_without_schedule.json()["fields"] == {
        "start_time": "Start time requires a scheduled date"
    }
    assert step_due.status_code == 422
    assert step_due.json()["fields"] == {
        "due_date": "Due date is only available on a top-level Journal item"
    }
    assert goal_due.status_code == 422
    assert goal_due.json()["fields"] == step_due.json()["fields"]


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


def test_completing_a_journal_parent_clears_only_pending_step_plans(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "complete-journal-parent@example.com"))
    parent = client.post(
        "/api/v1/tasks",
        json={"title": "Launch"},
        headers=headers,
    ).json()
    pending_step = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Prepare slides"},
        headers=headers,
    ).json()
    completed_step = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Book the room"},
        headers=headers,
    ).json()

    pending_plan = client.patch(
        f"/api/v1/tasks/{pending_step['id']}",
        json={
            "scheduled_date": "2026-10-01",
            "start_time": "09:00",
            "duration_minutes": 60,
            "block_count": 2,
        },
        headers=headers,
    )
    completed_plan = client.patch(
        f"/api/v1/tasks/{completed_step['id']}",
        json={
            "scheduled_date": "2026-10-02",
            "start_time": "11:00",
            "duration_minutes": 30,
            "block_count": 1,
        },
        headers=headers,
    )
    completed_step_response = client.post(
        f"/api/v1/tasks/{completed_step['id']}/check",
        headers=headers,
    )
    completed_parent = client.post(
        f"/api/v1/tasks/{parent['id']}/check",
        headers=headers,
    )
    reopened_parent = client.delete(
        f"/api/v1/tasks/{parent['id']}/check",
        headers=headers,
    )

    assert pending_plan.status_code == 200
    assert completed_plan.status_code == 200
    assert completed_step_response.status_code == 200
    assert completed_parent.status_code == 200
    assert completed_parent.json()["status"] == "DONE"
    assert reopened_parent.status_code == 200

    with db_session.begin():
        db_session.expire_all()
        stored_pending = db_session.get(Task, int(pending_step["id"]))
        stored_completed = db_session.get(Task, int(completed_step["id"]))
        assert stored_pending is not None
        assert stored_completed is not None

        assert stored_pending.status == TaskStatus.PENDING.value
        assert stored_pending.scheduled_date is None
        assert stored_pending.period_start is None
        assert stored_pending.start_time is None
        assert stored_pending.end_time is None
        assert stored_pending.duration_minutes == 60
        assert stored_pending.block_count == Decimal("2.0")

        assert stored_completed.status == TaskStatus.DONE.value
        assert stored_completed.scheduled_date == date(2026, 10, 2)
        assert stored_completed.period_start == date(2026, 9, 28)
        assert stored_completed.start_time == time(11)
        assert stored_completed.end_time == time(11, 30)


def test_deleting_a_journal_parent_cascades_to_its_steps(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "delete-journal-parent@example.com"))
    parent = client.post(
        "/api/v1/tasks",
        json={"title": "Launch"},
        headers=headers,
    ).json()
    first_step = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Prepare slides"},
        headers=headers,
    ).json()
    second_step = client.post(
        "/api/v1/tasks",
        json={"parent_id": parent["id"], "title": "Book the room"},
        headers=headers,
    ).json()

    deleted = client.delete(f"/api/v1/tasks/{parent['id']}", headers=headers)

    assert deleted.status_code == 204
    with db_session.begin():
        db_session.expire_all()
        assert db_session.get(Task, int(parent["id"])) is None
        assert db_session.get(Task, int(first_step["id"])) is None
        assert db_session.get(Task, int(second_step["id"])) is None


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
