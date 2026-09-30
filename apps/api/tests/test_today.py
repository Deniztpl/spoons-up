from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import HabitEntry, Task, TaskStatus, User

pytestmark = pytest.mark.integration


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


def create_area(client: TestClient, headers: dict[str, str], name: str) -> dict[str, object]:
    response = client.post("/api/v1/areas", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_habit(
    client: TestClient,
    headers: dict[str, str],
    *,
    area_id: str,
    title: str,
    mode: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/habits",
        json={"area_id": area_id, "title": title, "mode": mode},
        headers=headers,
    )
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


def check_habit(
    client: TestClient,
    headers: dict[str, str],
    *,
    habit_id: str,
    target_date: str,
) -> None:
    response = client.post(
        f"/api/v1/habits/{habit_id}/check",
        json={"date": target_date},
        headers=headers,
    )
    assert response.status_code == 201


def test_today_returns_daily_and_weekly_habits_for_the_requested_date(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "today@example.com"))
    active_area = create_area(client, headers, "Active")
    archived_area = create_area(client, headers, "Archived")
    daily_done = create_habit(
        client,
        headers,
        area_id=str(active_area["id"]),
        title="Read",
        mode="DAILY",
    )
    daily_open = create_habit(
        client,
        headers,
        area_id=str(active_area["id"]),
        title="Walk",
        mode="DAILY",
    )
    weekly_done = create_habit(
        client,
        headers,
        area_id=str(active_area["id"]),
        title="Call home",
        mode="WEEKLY",
    )
    weekly_open = create_habit(
        client,
        headers,
        area_id=str(active_area["id"]),
        title="Plan meals",
        mode="WEEKLY",
    )
    archived_habit = create_habit(
        client,
        headers,
        area_id=str(archived_area["id"]),
        title="Hidden",
        mode="DAILY",
    )

    check_habit(
        client,
        headers,
        habit_id=str(daily_done["id"]),
        target_date="2026-09-24",
    )
    check_habit(
        client,
        headers,
        habit_id=str(weekly_done["id"]),
        target_date="2026-09-21",
    )
    check_habit(
        client,
        headers,
        habit_id=str(archived_habit["id"]),
        target_date="2026-09-24",
    )
    client.post(
        f"/api/v1/areas/{archived_area['id']}/archive",
        json={"archived": True},
        headers=headers,
    )
    response = client.get(
        "/api/v1/today",
        params={"date": "2026-09-24"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "date": "2026-09-24",
        "week_start": "2026-09-21",
        "week_end": "2026-09-27",
        "daily_habits": [
            {
                "id": daily_done["id"],
                "area_id": active_area["id"],
                "title": "Read",
                "done": True,
            },
            {
                "id": daily_open["id"],
                "area_id": active_area["id"],
                "title": "Walk",
                "done": False,
            },
        ],
        "weekly_habits": [
            {
                "id": weekly_done["id"],
                "area_id": active_area["id"],
                "title": "Call home",
                "done": True,
            },
            {
                "id": weekly_open["id"],
                "area_id": active_area["id"],
                "title": "Plan meals",
                "done": False,
            },
        ],
        "tasks": [],
        "left_behind": {"count": 0, "items": []},
    }
    assert db_session.scalar(select(func.count()).select_from(HabitEntry)) == 3


def test_today_defaults_to_the_users_local_date(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            current = cls(2026, 9, 24, 21, 30, tzinfo=UTC)
            return current if tz is None else current.astimezone(tz)

    monkeypatch.setattr("app.services.today.datetime", FrozenDateTime)
    headers = bearer(register(client, "today-timezone@example.com"))
    area = create_area(client, headers, "Health")
    habit = create_habit(
        client,
        headers,
        area_id=str(area["id"]),
        title="Sleep",
        mode="DAILY",
    )
    check_habit(
        client,
        headers,
        habit_id=str(habit["id"]),
        target_date="2026-09-25",
    )

    response = client.get("/api/v1/today", headers=headers)

    assert response.status_code == 200
    assert response.json()["date"] == "2026-09-25"
    assert response.json()["daily_habits"][0]["done"] is True


def test_today_returns_the_days_visible_tasks_in_start_time_order(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "today-tasks@example.com"))
    active_area = create_area(client, headers, "Active tasks")
    archived_area = create_area(client, headers, "Archived tasks")
    active_goal = create_goal(
        client,
        headers,
        area_id=str(active_area["id"]),
        title="Active goal",
    )
    archived_goal = create_goal(
        client,
        headers,
        area_id=str(archived_area["id"]),
        title="Archived goal",
    )
    target_date = date(2026, 9, 24)

    with db_session.begin():
        user = db_session.scalar(select(User).where(User.email == "today-tasks@example.com"))
        assert user is not None
        morning = build_today_task(
            user_id=user.id,
            goal_id=int(str(active_goal["id"])),
            title="Morning block",
            scheduled_date=target_date,
            start_time=time(8),
            end_time=time(8, 30),
            block_count=Decimal("0.5"),
            status=TaskStatus.DONE,
            occurrence_date=target_date,
        )
        standalone = build_today_task(
            user_id=user.id,
            goal_id=None,
            title="Standalone task",
            scheduled_date=target_date,
            start_time=time(9),
            end_time=time(10),
            block_count=Decimal("1.0"),
        )
        evening = build_today_task(
            user_id=user.id,
            goal_id=int(str(active_goal["id"])),
            title="Evening block",
            scheduled_date=target_date,
            start_time=time(18),
            end_time=time(20),
            block_count=Decimal("2.0"),
            occurrence_date=date(2026, 9, 23),
        )
        untimed = build_today_task(
            user_id=user.id,
            goal_id=None,
            title="Untimed task",
            scheduled_date=target_date,
            start_time=None,
            end_time=None,
            block_count=None,
        )
        db_session.add_all(
            [
                morning,
                standalone,
                evening,
                untimed,
                build_today_task(
                    user_id=user.id,
                    goal_id=int(str(active_goal["id"])),
                    title="Deleted task",
                    scheduled_date=target_date,
                    start_time=time(7),
                    end_time=time(8),
                    block_count=Decimal("1.0"),
                    status=TaskStatus.DELETED,
                ),
                build_today_task(
                    user_id=user.id,
                    goal_id=int(str(active_goal["id"])),
                    title="Another day",
                    scheduled_date=date(2026, 9, 25),
                    start_time=time(6),
                    end_time=time(7),
                    block_count=Decimal("1.0"),
                ),
                build_today_task(
                    user_id=user.id,
                    goal_id=int(str(archived_goal["id"])),
                    title="Hidden archived task",
                    scheduled_date=target_date,
                    start_time=time(6),
                    end_time=time(7),
                    block_count=Decimal("1.0"),
                    status=TaskStatus.DONE,
                ),
            ]
        )
        db_session.flush()
        expected_ids = [
            str(morning.id),
            str(standalone.id),
            str(evening.id),
            str(untimed.id),
        ]
        task_count_before = db_session.scalar(select(func.count()).select_from(Task))

    archived = client.post(
        f"/api/v1/areas/{archived_area['id']}/archive",
        json={"archived": True},
        headers=headers,
    )
    response = client.get(
        "/api/v1/today",
        params={"date": target_date.isoformat()},
        headers=headers,
    )

    assert archived.status_code == 200
    assert response.status_code == 200
    tasks = response.json()["tasks"]
    assert [task["id"] for task in tasks] == expected_ids
    assert tasks == [
        {
            "id": expected_ids[0],
            "goal_id": active_goal["id"],
            "rule_id": None,
            "parent_id": None,
            "title": "Morning block",
            "start_time": "08:00",
            "duration_minutes": None,
            "end_time": "08:30",
            "block_count": 0.5,
            "status": "DONE",
            "scheduled_date": "2026-09-24",
            "occurrence_date": "2026-09-24",
            "period_start": "2026-09-21",
            "step_progress": None,
            "parent": None,
        },
        {
            "id": expected_ids[1],
            "goal_id": None,
            "rule_id": None,
            "parent_id": None,
            "title": "Standalone task",
            "start_time": "09:00",
            "duration_minutes": None,
            "end_time": "10:00",
            "block_count": 1.0,
            "status": "PENDING",
            "scheduled_date": "2026-09-24",
            "occurrence_date": None,
            "period_start": "2026-09-21",
            "step_progress": None,
            "parent": None,
        },
        {
            "id": expected_ids[2],
            "goal_id": active_goal["id"],
            "rule_id": None,
            "parent_id": None,
            "title": "Evening block",
            "start_time": "18:00",
            "duration_minutes": None,
            "end_time": "20:00",
            "block_count": 2.0,
            "status": "PENDING",
            "scheduled_date": "2026-09-24",
            "occurrence_date": "2026-09-23",
            "period_start": "2026-09-21",
            "step_progress": None,
            "parent": None,
        },
        {
            "id": expected_ids[3],
            "goal_id": None,
            "rule_id": None,
            "parent_id": None,
            "title": "Untimed task",
            "start_time": None,
            "duration_minutes": None,
            "end_time": None,
            "block_count": None,
            "status": "PENDING",
            "scheduled_date": "2026-09-24",
            "occurrence_date": None,
            "period_start": "2026-09-21",
            "step_progress": None,
            "parent": None,
        },
    ]
    with db_session.begin():
        assert db_session.scalar(select(func.count()).select_from(Task)) == task_count_before


def test_today_returns_the_week_from_the_users_week_start_day(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "today-week-start@example.com"))
    db_session.execute(
        update(User).where(User.email == "today-week-start@example.com").values(week_start_day=7)
    )
    db_session.commit()
    area = create_area(client, headers, "Home")
    habit = create_habit(
        client,
        headers,
        area_id=str(area["id"]),
        title="Tidy up",
        mode="WEEKLY",
    )
    check_habit(
        client,
        headers,
        habit_id=str(habit["id"]),
        target_date="2026-09-20",
    )

    response = client.get(
        "/api/v1/today",
        params={"date": "2026-09-24"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["week_start"] == "2026-09-20"
    assert response.json()["week_end"] == "2026-09-26"
    assert response.json()["weekly_habits"][0]["done"] is True


def test_today_requires_authentication_and_validates_the_date(client: TestClient) -> None:
    unauthorized = client.get("/api/v1/today", params={"date": "2026-09-24"})
    headers = bearer(register(client, "today-validation@example.com"))
    invalid_date = client.get(
        "/api/v1/today",
        params={"date": "not-a-date"},
        headers=headers,
    )

    assert unauthorized.status_code == 401
    assert invalid_date.status_code == 422
    assert invalid_date.json()["code"] == "validation_error"
    assert "date" in invalid_date.json()["fields"]


def test_scheduled_journal_work_carries_its_item_and_step_progress(client: TestClient) -> None:
    headers = bearer(register(client, "today-steps@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")
    day = "2030-01-10"

    item = create_task(client, headers, {"title": "Conference", "due_date": day})
    done_step = create_task(client, headers, {"parent_id": item["id"], "title": "Book the hall"})
    planned_step = create_task(
        client,
        headers,
        {"parent_id": item["id"], "title": "Prepare the slides"},
    )
    create_task(client, headers, {"parent_id": item["id"], "title": "Rehearse"})
    create_task(client, headers, {"goal_id": goal["id"], "scheduled_date": day})
    create_task(client, headers, {"title": "Pay the invoice", "scheduled_date": day})
    checked = client.post(f"/api/v1/tasks/{done_step['id']}/check", headers=headers)
    planned = client.patch(
        f"/api/v1/tasks/{planned_step['id']}",
        json={"scheduled_date": day},
        headers=headers,
    )

    today = client.get("/api/v1/today", params={"date": day}, headers=headers)
    week = client.get("/api/v1/week", headers=headers)

    assert checked.status_code == 200
    assert planned.status_code == 200
    assert today.status_code == 200
    assert week.status_code == 200
    progress = {"done": 1, "total": 3}
    parent = {"id": item["id"], "title": "Conference", "step_progress": progress}
    assert {
        task["title"]: (task["parent_id"], task["step_progress"], task["parent"])
        for task in today.json()["tasks"]
    } == {
        "Conference": (None, progress, None),
        "Prepare the slides": (item["id"], None, parent),
        "Deep work": (None, None, None),
        "Pay the invoice": (None, None, None),
    }
    # Work placed after the following week reads the same in Week's later list.
    later = {task["title"]: task for task in week.json()["later_tasks"]["items"]}
    assert later["Prepare the slides"]["parent"] == parent
    assert later["Conference"]["step_progress"] == progress


def test_left_behind_lists_earlier_pending_work_from_the_real_today(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Thursday 24 September in Istanbul; the open week began on Monday the 21st.
    freeze_now(monkeypatch, datetime(2026, 9, 24, 9, tzinfo=UTC))
    headers = bearer(register(client, "left-behind@example.com"))
    register(client, "left-behind-stranger@example.com")
    work = create_area(client, headers, "Work")
    old = create_area(client, headers, "Old")
    deep_work = create_goal(client, headers, area_id=str(work["id"]), title="Deep work")
    old_goal = create_goal(client, headers, area_id=str(old["id"]), title="Old goal")
    archived = client.post(
        f"/api/v1/areas/{old['id']}/archive",
        json={"archived": True},
        headers=headers,
    )

    with db_session.begin():
        user = get_user(db_session, "left-behind@example.com")
        stranger = get_user(db_session, "left-behind-stranger@example.com")
        goal_id = int(str(deep_work["id"]))
        conference = build_today_task(
            user_id=user.id, goal_id=None, title="Conference", scheduled_date=None
        )
        db_session.add(conference)
        db_session.flush()
        rows = {
            "lease": build_today_task(
                user_id=user.id,
                goal_id=None,
                title="Renew the lease",
                scheduled_date=date(2026, 9, 17),
                start_time=time(14),
                period_start=date(2026, 9, 14),
            ),
            "bank": build_today_task(
                user_id=user.id,
                goal_id=None,
                title="Call the bank",
                scheduled_date=date(2026, 9, 22),
            ),
            "slides": build_today_task(
                user_id=user.id,
                goal_id=None,
                parent_id=conference.id,
                title="Prepare the slides",
                scheduled_date=date(2026, 9, 22),
                start_time=time(9),
            ),
            "focus": build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 23),
                start_time=time(10),
            ),
        }
        hidden = [
            build_today_task(
                user_id=user.id,
                goal_id=None,
                title="Done already",
                scheduled_date=date(2026, 9, 22),
                status=TaskStatus.DONE,
            ),
            # Counts toward last week, even where it sits now.
            build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 18),
                period_start=date(2026, 9, 14),
            ),
            build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 22),
                period_start=date(2026, 9, 14),
            ),
            build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 24),
            ),
            build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 22),
                status=TaskStatus.DELETED,
            ),
            build_today_task(
                user_id=user.id,
                goal_id=int(str(old_goal["id"])),
                title="Old goal",
                scheduled_date=date(2026, 9, 22),
            ),
            build_today_task(
                user_id=stranger.id,
                goal_id=None,
                title="Private",
                scheduled_date=date(2026, 9, 20),
            ),
        ]
        db_session.add_all([*rows.values(), *hidden])
        db_session.flush()
        ids = {name: str(task.id) for name, task in rows.items()}
        conference_id = str(conference.id)

    # Another day asked for does not move where Left behind is measured from.
    response = client.get("/api/v1/today", params={"date": "2026-09-26"}, headers=headers)

    assert archived.status_code == 200
    assert response.status_code == 200

    def journal_row(
        name: str,
        title: str,
        day: str,
        start: str | None,
        parent: str | None,
    ) -> dict[str, object]:
        return {
            "id": ids[name],
            "title": title,
            "goal_id": None,
            "parent_id": parent,
            "scheduled_date": day,
            "start_time": start,
            "source_type": "JOURNAL",
            "source_label": "Journal",
        }

    assert response.json()["left_behind"] == {
        "count": 4,
        "items": [
            journal_row("lease", "Renew the lease", "2026-09-17", "14:00", None),
            journal_row("slides", "Prepare the slides", "2026-09-22", "09:00", conference_id),
            journal_row("bank", "Call the bank", "2026-09-22", None, None),
            {
                "id": ids["focus"],
                "title": "Deep work",
                "goal_id": deep_work["id"],
                "parent_id": None,
                "scheduled_date": "2026-09-23",
                "start_time": "10:00",
                "source_type": "AREA",
                "source_label": "Work",
            },
        ],
    }


def test_left_behind_work_moves_to_today_and_goal_work_leaves_at_the_week_turn(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Sunday 27 September in Istanbul, the last day of the week that began on Monday the 21st.
    freeze_now(monkeypatch, datetime(2026, 9, 27, 9, tzinfo=UTC))
    headers = bearer(register(client, "left-behind-move@example.com"))
    work = create_area(client, headers, "Work")
    deep_work = create_goal(client, headers, area_id=str(work["id"]), title="Deep work")

    with db_session.begin():
        user = get_user(db_session, "left-behind-move@example.com")
        goal_id = int(str(deep_work["id"]))
        rows = {
            "friday": build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 25),
                start_time=time(9),
            ),
            "saturday": build_today_task(
                user_id=user.id,
                goal_id=goal_id,
                title="Deep work",
                scheduled_date=date(2026, 9, 26),
                start_time=time(9),
            ),
            "lease": build_today_task(
                user_id=user.id,
                goal_id=None,
                title="Renew the lease",
                scheduled_date=date(2026, 9, 25),
                due_date=date(2026, 9, 25),
            ),
        }
        db_session.add_all(rows.values())
        db_session.flush()
        ids = {name: str(task.id) for name, task in rows.items()}

    before = client.get("/api/v1/today", headers=headers)
    moved_goal = client.patch(
        f"/api/v1/tasks/{ids['saturday']}",
        json={"scheduled_date": "2026-09-27"},
        headers=headers,
    )
    moved_lease = client.patch(
        f"/api/v1/tasks/{ids['lease']}",
        json={"scheduled_date": "2026-09-27"},
        headers=headers,
    )
    after = client.get("/api/v1/today", headers=headers)
    # Monday 28 September: the week has turned.
    freeze_now(monkeypatch, datetime(2026, 9, 28, 9, tzinfo=UTC))
    next_week = client.get("/api/v1/today", headers=headers)

    def left_behind(response: Response) -> list[str]:
        assert response.status_code == 200
        return [item["id"] for item in response.json()["left_behind"]["items"]]

    assert left_behind(before) == [ids["friday"], ids["lease"], ids["saturday"]]
    # Moving changes the day alone: the goal work keeps its week, the Journal item its due date.
    assert moved_goal.status_code == 200
    assert moved_goal.json()["scheduled_date"] == "2026-09-27"
    assert moved_goal.json()["period_start"] == "2026-09-21"
    assert moved_lease.status_code == 200
    assert moved_lease.json()["scheduled_date"] == "2026-09-27"
    assert moved_lease.json()["due_date"] == "2026-09-25"
    assert left_behind(after) == [ids["friday"]]
    assert [task["id"] for task in after.json()["tasks"]] == [ids["saturday"], ids["lease"]]
    # Goal work stays with its closed week; Journal work waits until it is done.
    assert left_behind(next_week) == [ids["lease"]]


def create_task(
    client: TestClient,
    headers: dict[str, str],
    payload: dict[str, object],
) -> dict[str, object]:
    response = client.post("/api/v1/tasks", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def build_today_task(
    *,
    user_id: int,
    goal_id: int | None,
    title: str,
    scheduled_date: date | None,
    start_time: time | None = None,
    end_time: time | None = None,
    block_count: Decimal | None = None,
    status: TaskStatus = TaskStatus.PENDING,
    occurrence_date: date | None = None,
    period_start: date = date(2026, 9, 21),
    parent_id: int | None = None,
    due_date: date | None = None,
) -> Task:
    return Task(
        user_id=user_id,
        goal_id=goal_id,
        parent_id=parent_id,
        rule_id=None,
        title=title,
        occurrence_date=occurrence_date,
        scheduled_date=scheduled_date,
        due_date=due_date,
        start_time=start_time,
        end_time=end_time,
        block_count=block_count,
        period_start=period_start if scheduled_date is not None else None,
        status=status.value,
        completed_at=(datetime(2026, 9, 24, 8, tzinfo=UTC) if status == TaskStatus.DONE else None),
    )


def freeze_now(monkeypatch: pytest.MonkeyPatch, moment: datetime) -> None:
    """Pin the clock for the Today read and for task writes."""

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return moment if tz is None else moment.astimezone(tz)

    monkeypatch.setattr("app.services.today.datetime", FrozenDateTime)
    monkeypatch.setattr("app.services.tasks.datetime", FrozenDateTime)


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user
