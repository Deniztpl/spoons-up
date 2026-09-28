from datetime import UTC, date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Goal, GoalRule, Task, TaskStatus, User
from app.repositories.goals import GoalRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.services import areas as areas_service_module
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
            db_session,
            TaskRepository(db_session),
            GoalRepository(db_session),
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


def test_rule_generation_copies_nullable_schedule_values(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "untimed-task-generation@example.com"))
    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))

    rule = create_rule(
        client,
        headers,
        goal_id=str(goal["id"]),
        byweekday=[3],
        start_time=None,
        duration_minutes=None,
        block_count=None,
    )

    task = db_session.scalar(
        select(Task).where(Task.rule_id == int(str(rule["id"]))).order_by(Task.occurrence_date)
    )
    assert task is not None
    assert task.start_time is None
    assert task.duration_minutes is None
    assert task.end_time is None
    assert task.block_count is None


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
        customized_task = db_session.scalar(
            select(Task).where(
                Task.rule_id == rule_id,
                Task.occurrence_date == date(2026, 9, 25),
            )
        )
        assert user is not None
        assert goal_model is not None
        assert thursday_task is not None
        assert deleted_task is not None
        assert customized_task is not None

        thursday_task.scheduled_date = date(2026, 9, 26)
        deleted_task.status = TaskStatus.DELETED.value
        customized_task.start_time = time(11)
        customized_task.duration_minutes = 45
        customized_task.end_time = time(11, 45)
        customized_task.block_count = Decimal("2.0")
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
    assert tasks_by_date[date(2026, 9, 25)].start_time == time(11)
    assert tasks_by_date[date(2026, 9, 25)].duration_minutes == 45
    assert tasks_by_date[date(2026, 9, 25)].block_count == Decimal("2.0")
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
        customized_task = db_session.scalar(
            select(Task).where(
                Task.rule_id == rule_id,
                Task.occurrence_date == date(2026, 9, 23),
            )
        )
        assert user is not None
        assert goal_model is not None
        assert moved_task is not None
        assert done_task is not None
        assert customized_task is not None

        moved_task.scheduled_date = date(2026, 9, 27)
        done_task.status = TaskStatus.DONE.value
        done_task.completed_at = datetime(2026, 9, 25, 8, tzinfo=UTC)
        customized_task.start_time = time(11)
        customized_task.duration_minutes = 30
        customized_task.end_time = time(11, 30)
        customized_task.block_count = Decimal("2.0")
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
        (date(2026, 9, 23), TaskStatus.PENDING.value),
        (date(2026, 9, 24), TaskStatus.PENDING.value),
        (date(2026, 9, 25), TaskStatus.DONE.value),
    }
    assert all(task.rule_id is None for task in remaining_tasks)


def test_repeat_from_a_task_makes_it_the_new_rule_occurrence(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "repeat-from-task@example.com"))
    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "repeat-from-task@example.com"))
        goal_model = db_session.get(Goal, int(str(goal["id"])))
        assert user is not None
        assert goal_model is not None
        task = build_ad_hoc_task(user=user, goal=goal_model, scheduled_date=date(2026, 9, 24))
        db_session.add(task)
        db_session.flush()
        task_id = task.id

    response = client.post(
        f"/api/v1/tasks/{task_id}/repeat",
        json={"byweekday": [6, 4]},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(task_id)
    assert body["rule_id"] is not None
    assert body["occurrence_date"] == "2026-09-24"
    assert body["scheduled_date"] == "2026-09-24"
    rule = db_session.get(GoalRule, int(body["rule_id"]))
    assert rule is not None
    assert rule.byweekday == [4, 6]
    assert rule.start_time == time(19)
    assert rule.duration_minutes == 45
    assert rule.block_count == Decimal("2.0")
    rule_tasks = list(
        db_session.scalars(
            select(Task).where(Task.rule_id == rule.id).order_by(Task.occurrence_date)
        )
    )
    assert [task.occurrence_date for task in rule_tasks] == [
        date(2026, 9, 24),
        date(2026, 9, 26),
        date(2026, 10, 1),
        date(2026, 10, 3),
    ]
    assert rule_tasks[0].id == task_id
    assert all(task.start_time == time(19) for task in rule_tasks)


def test_repeat_from_a_task_needs_a_goal_its_weekday_and_no_schedule_yet(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "repeat-rejected@example.com"))
    stranger_headers = bearer(register(client, "repeat-stranger@example.com"))
    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))
    rule = create_rule(
        client,
        headers,
        goal_id=str(goal["id"]),
        byweekday=[4],
        start_time=None,
        duration_minutes=None,
        block_count=None,
    )

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "repeat-rejected@example.com"))
        goal_model = db_session.get(Goal, int(str(goal["id"])))
        assert user is not None
        assert goal_model is not None
        standalone = build_ad_hoc_task(user=user, goal=None, scheduled_date=date(2026, 9, 24))
        ad_hoc = build_ad_hoc_task(user=user, goal=goal_model, scheduled_date=date(2026, 9, 24))
        db_session.add_all([standalone, ad_hoc])
        db_session.flush()
        standalone_id = standalone.id
        ad_hoc_id = ad_hoc.id
        generated_id = db_session.scalar(
            select(Task.id).where(Task.rule_id == int(str(rule["id"])))
        )

    without_goal = client.post(
        f"/api/v1/tasks/{standalone_id}/repeat", json={"byweekday": [4]}, headers=headers
    )
    without_own_weekday = client.post(
        f"/api/v1/tasks/{ad_hoc_id}/repeat", json={"byweekday": [5]}, headers=headers
    )
    without_weekdays = client.post(
        f"/api/v1/tasks/{ad_hoc_id}/repeat", json={"byweekday": []}, headers=headers
    )
    already_repeating = client.post(
        f"/api/v1/tasks/{generated_id}/repeat", json={"byweekday": [4]}, headers=headers
    )
    stranger = client.post(
        f"/api/v1/tasks/{ad_hoc_id}/repeat", json={"byweekday": [4]}, headers=stranger_headers
    )
    stop_without_schedule = client.delete(f"/api/v1/tasks/{ad_hoc_id}/repeat", headers=headers)

    assert without_goal.status_code == 422
    assert without_goal.json()["fields"] == {"goal_id": "Repeat needs a goal"}
    assert without_own_weekday.status_code == 422
    assert without_own_weekday.json()["fields"] == {
        "byweekday": "Repeat must include the task's own weekday"
    }
    assert without_weekdays.status_code == 422
    assert already_repeating.status_code == 422
    assert already_repeating.json()["fields"] == {"rule_id": "This task already repeats"}
    assert stranger.status_code == 404
    assert stop_without_schedule.status_code == 422
    assert stop_without_schedule.json()["fields"] == {"rule_id": "This task does not repeat"}
    with db_session.begin():
        assert list(
            db_session.scalars(select(GoalRule.id).where(GoalRule.goal_id == int(str(goal["id"]))))
        ) == [int(str(rule["id"]))]


def test_stop_repeating_keeps_the_task_and_removes_its_rule(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    headers = bearer(register(client, "stop-repeating@example.com"))
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
        generated = {
            task.occurrence_date: task
            for task in db_session.scalars(select(Task).where(Task.rule_id == rule_id))
        }
        kept_id = generated[date(2026, 9, 24)].id
        generated[date(2026, 9, 25)].status = TaskStatus.DONE.value
        generated[date(2026, 9, 25)].completed_at = datetime(2026, 9, 25, 8, tzinfo=UTC)
        generated[date(2026, 9, 30)].scheduled_date = date(2026, 10, 2)

    response = client.delete(f"/api/v1/tasks/{kept_id}/repeat", headers=headers)

    assert response.status_code == 200
    assert response.json()["rule_id"] is None
    assert response.json()["occurrence_date"] is None
    assert response.json()["scheduled_date"] == "2026-09-24"
    assert response.json()["start_time"] == "09:00"
    with db_session.begin():
        assert db_session.get(GoalRule, rule_id) is None
        remaining = list(
            db_session.scalars(select(Task).where(Task.goal_id == int(str(goal["id"]))))
        )
        assert {(task.id == kept_id, task.occurrence_date, task.status) for task in remaining} == {
            (True, None, TaskStatus.PENDING.value),
            (False, date(2026, 9, 25), TaskStatus.DONE.value),
            (False, date(2026, 9, 30), TaskStatus.PENDING.value),
        }
        assert all(task.rule_id is None for task in remaining)

    repeated_again = client.post(
        f"/api/v1/tasks/{kept_id}/repeat", json={"byweekday": [4]}, headers=headers
    )

    assert repeated_again.status_code == 200
    assert repeated_again.json()["occurrence_date"] == "2026-09-24"


def test_area_archive_hard_deletes_only_future_pending_tasks(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_goal_service_time(monkeypatch)
    freeze_area_service_time(monkeypatch)
    headers = bearer(register(client, "area-task-archive@example.com"))
    area = create_area(client, headers)
    goal = create_goal(client, headers, area_id=str(area["id"]))
    rule = create_rule(
        client,
        headers,
        goal_id=str(goal["id"]),
        byweekday=[1, 2, 3, 4, 5, 6, 7],
        start_time="09:00",
        duration_minutes=60,
        block_count=1,
    )
    other_area = create_area(client, headers, name="Personal")
    other_goal = create_goal(client, headers, area_id=str(other_area["id"]))
    other_rule = create_rule(
        client,
        headers,
        goal_id=str(other_goal["id"]),
        byweekday=[1, 2, 3, 4, 5, 6, 7],
        start_time="18:00",
        duration_minutes=30,
        block_count=1,
    )
    goal_id = int(str(goal["id"]))
    rule_id = int(str(rule["id"]))
    other_rule_id = int(str(other_rule["id"]))

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "area-task-archive@example.com"))
        goal_model = db_session.get(Goal, goal_id)
        generated_tasks = {
            task.occurrence_date: task
            for task in db_session.scalars(select(Task).where(Task.rule_id == rule_id))
        }
        assert user is not None
        assert goal_model is not None

        generated_tasks[date(2026, 9, 23)].scheduled_date = date(2026, 9, 30)
        generated_tasks[date(2026, 9, 25)].status = TaskStatus.DONE.value
        generated_tasks[date(2026, 9, 26)].status = TaskStatus.DELETED.value
        db_session.add(
            build_task(
                user=user,
                goal=goal_model,
                rule_id=rule_id,
                occurrence_date=date(2026, 9, 22),
            )
        )

    archived = client.post(
        f"/api/v1/areas/{area['id']}/archive",
        json={"archived": True},
        headers=headers,
    )

    assert archived.status_code == 200
    with db_session.begin():
        remaining_tasks = list(
            db_session.scalars(
                select(Task).where(Task.goal_id == goal_id).order_by(Task.occurrence_date)
            )
        )
        assert {
            (task.occurrence_date, task.scheduled_date, task.status) for task in remaining_tasks
        } == {
            (date(2026, 9, 22), date(2026, 9, 22), TaskStatus.PENDING.value),
            (date(2026, 9, 25), date(2026, 9, 25), TaskStatus.DONE.value),
            (date(2026, 9, 26), date(2026, 9, 26), TaskStatus.DELETED.value),
        }
        assert db_session.get(Goal, goal_id) is not None
        assert db_session.get(GoalRule, rule_id) is not None
        remaining_task_ids = {task.id for task in remaining_tasks}
        other_task_ids = set(
            db_session.scalars(select(Task.id).where(Task.rule_id == other_rule_id))
        )
        assert len(other_task_ids) == 14

    restored = client.post(
        f"/api/v1/areas/{area['id']}/archive",
        json={"archived": False},
        headers=headers,
    )

    assert restored.status_code == 200
    with db_session.begin():
        assert (
            set(db_session.scalars(select(Task.id).where(Task.goal_id == goal_id)))
            == remaining_task_ids
        )
        assert set(db_session.scalars(select(Task.id).where(Task.rule_id == other_rule_id))) == (
            other_task_ids
        )


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
        duration_minutes=60,
        end_time=time(10),
        block_count=Decimal("1.0"),
        period_start=date(2026, 9, 21),
        status=status.value,
    )


def build_ad_hoc_task(*, user: User, goal: Goal | None, scheduled_date: date) -> Task:
    return Task(
        user_id=user.id,
        goal_id=goal.id if goal is not None else None,
        rule_id=None,
        title=goal.title if goal is not None else "Dentist",
        occurrence_date=None,
        scheduled_date=scheduled_date,
        start_time=time(19),
        duration_minutes=45,
        end_time=time(19, 45),
        block_count=Decimal("2.0"),
        period_start=date(2026, 9, 21),
    )


def freeze_goal_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return FIXED_NOW if tz is None else FIXED_NOW.astimezone(tz)

    monkeypatch.setattr(goals_service_module, "datetime", FixedDateTime)


def freeze_area_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return FIXED_NOW if tz is None else FIXED_NOW.astimezone(tz)

    monkeypatch.setattr(areas_service_module, "datetime", FixedDateTime)


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
    *,
    name: str = "Work",
) -> dict[str, object]:
    response = client.post("/api/v1/areas", json={"name": name}, headers=headers)
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
    start_time: str | None,
    duration_minutes: int | None,
    block_count: float | None,
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
