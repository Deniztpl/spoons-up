from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.periods import get_week_start
from app.models import Area, Goal, Habit, Task, TaskStatus, User
from app.services import results as results_service_module
from app.services import tasks as tasks_service_module

pytestmark = pytest.mark.integration

# Wednesday afternoon in Istanbul; the open week runs Monday 2026-09-21 to Sunday 2026-09-27.
OBSERVED_AT = datetime(2026, 9, 23, 12, tzinfo=UTC)
LONG_AGO = datetime(2026, 9, 1, 9, tzinfo=UTC)


@pytest.fixture(autouse=True)
def fixed_progress_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_progress_service_time(monkeypatch)


def test_progress_weights_every_requirement_equally(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "progress@example.com"))
    area_id = str(create_area(client, headers, "Coding")["id"])
    deep_work = create_goal(client, headers, area_id=area_id, title="Deep work", weekly_target=2)
    ship = create_goal(client, headers, area_id=area_id, title="Ship", weekly_target=1)
    create_goal(client, headers, area_id=area_id, title="Someday", weekly_target=None)
    practice = create_habit(client, headers, area_id=area_id, title="Practice", mode="DAILY")
    review = create_habit(client, headers, area_id=area_id, title="Review", mode="WEEKLY")

    with db_session.begin():
        user = get_user(db_session, "progress@example.com")
        set_created_at(db_session, user_id=user.id, value=LONG_AGO)
        db_session.add_all(
            [
                build_task(user_id=user.id, goal=deep_work, day=date(2026, 9, 21), blocks="1.0"),
                build_task(user_id=user.id, goal=deep_work, day=date(2026, 9, 22), blocks="0.5"),
                build_task(
                    user_id=user.id,
                    goal=deep_work,
                    day=date(2026, 9, 23),
                    blocks="1.0",
                    status=TaskStatus.PENDING,
                ),
                build_task(user_id=user.id, goal=deep_work, day=date(2026, 9, 14), blocks="1.0"),
                build_task(user_id=user.id, goal=ship, day=date(2026, 9, 22), blocks="2.0"),
            ]
        )
    for day in ("2026-09-21", "2026-09-22"):
        check_habit(client, headers, habit_id=str(practice["id"]), target_date=day)
    check_habit(client, headers, habit_id=str(review["id"]), target_date="2026-09-23")

    response = client.get("/api/v1/progress", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["period_start"] == "2026-09-21"
    assert body["period_end"] == "2026-09-27"
    # (1.5/2 + capped 2/1 + 2/7 + 1/1) / 4 = 75.9%
    assert body["percent"] == 76
    [coding] = body["areas"]
    assert coding["area_id"] == area_id
    assert coding["name"] == "Coding"
    assert coding["percent"] == 76
    assert [
        (item["ref_type"], item["ref_id"], item["title"], item["target"], item["done"])
        for item in coding["requirements"]
    ] == [
        ("GOAL", deep_work["id"], "Deep work", 2, 1.5),
        ("GOAL", ship["id"], "Ship", 1, 2.0),
        ("HABIT", practice["id"], "Practice", 7, 2),
        ("HABIT", review["id"], "Review", 1, 1),
    ]
    assert [(day["date"], day["done"]) for day in coding["days"]] == [
        ("2026-09-21", True),
        ("2026-09-22", True),
        ("2026-09-23", False),
        ("2026-09-24", False),
        ("2026-09-25", False),
        ("2026-09-26", False),
        ("2026-09-27", False),
    ]


def test_progress_counts_requirements_only_on_their_active_days(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "progress-active-days@example.com"))
    stranger_headers = bearer(register(client, "progress-stranger@example.com"))
    health_id = str(create_area(client, headers, "Health")["id"])
    sleep_id = str(create_area(client, headers, "Sleep")["id"])
    music_id = str(create_area(client, headers, "Music")["id"])
    someday_id = str(create_area(client, headers, "Someday")["id"])
    stranger_area_id = str(create_area(client, stranger_headers, "Stranger")["id"])
    old = create_habit(client, headers, area_id=health_id, title="Old", mode="DAILY")
    new = create_habit(client, headers, area_id=health_id, title="New", mode="DAILY")
    midweek_goal = create_goal(client, headers, area_id=health_id, title="Mid", weekly_target=3)
    bedtime = create_habit(client, headers, area_id=sleep_id, title="Bedtime", mode="DAILY")
    create_habit(client, headers, area_id=music_id, title="Scales", mode="DAILY")
    create_goal(client, headers, area_id=someday_id, title="Maybe", weekly_target=None)
    create_habit(
        client,
        stranger_headers,
        area_id=stranger_area_id,
        title="Not mine",
        mode="DAILY",
    )
    for day in ("2026-09-21", "2026-09-22", "2026-09-23"):
        check_habit(client, headers, habit_id=str(old["id"]), target_date=day)
    check_habit(client, headers, habit_id=str(bedtime["id"]), target_date="2026-09-22")

    added_wednesday = datetime(2026, 9, 23, 6, tzinfo=UTC)
    with db_session.begin():
        user = get_user(db_session, "progress-active-days@example.com")
        stranger = get_user(db_session, "progress-stranger@example.com")
        set_created_at(db_session, user_id=user.id, value=LONG_AGO)
        set_created_at(db_session, user_id=stranger.id, value=LONG_AGO)
        db_session.execute(
            update(Habit).where(Habit.id == int(str(new["id"]))).values(created_at=added_wednesday)
        )
        db_session.execute(
            update(Goal)
            .where(Goal.id == int(str(midweek_goal["id"])))
            .values(created_at=added_wednesday)
        )
        # Sleep came back from the archive on Thursday morning in Istanbul.
        db_session.execute(
            update(Area)
            .where(Area.id == int(sleep_id))
            .values(unarchived_at=datetime(2026, 9, 24, 7, tzinfo=UTC))
        )
        db_session.execute(
            update(Area).where(Area.id == int(music_id)).values(archived_at=LONG_AGO)
        )

    response = client.get("/api/v1/progress", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert [area["name"] for area in body["areas"]] == ["Health", "Sleep"]
    health, sleep = body["areas"]
    assert [(item["title"], item["target"], item["done"]) for item in health["requirements"]] == [
        ("Mid", 3, 0.0),
        ("Old", 7, 3),
        ("New", 5, 0),
    ]
    # Wednesday is not done: New was active that day and was not checked.
    assert [day["done"] for day in health["days"]] == [True, True] + [False] * 5
    assert health["percent"] == 14
    assert [(item["title"], item["target"], item["done"]) for item in sleep["requirements"]] == [
        ("Bedtime", 4, 0)
    ]
    assert [day["done"] for day in sleep["days"]] == [False] * 7
    assert sleep["percent"] == 0
    assert body["percent"] == 7


def test_progress_counts_a_task_moved_to_next_week_toward_its_original_week(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Task date checks run at the same observed time as progress.
    monkeypatch.setattr(tasks_service_module, "datetime", results_service_module.datetime)
    headers = bearer(register(client, "progress-moved@example.com"))
    area_id = str(create_area(client, headers, "Coding")["id"])
    goal = create_goal(client, headers, area_id=area_id, title="Deep work", weekly_target=2)
    task = client.post(
        "/api/v1/tasks",
        json={"goal_id": goal["id"], "scheduled_date": "2026-09-24", "block_count": 1},
        headers=headers,
    ).json()
    with db_session.begin():
        set_created_at(
            db_session,
            user_id=get_user(db_session, "progress-moved@example.com").id,
            value=LONG_AGO,
        )

    moved = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"scheduled_date": "2026-09-29"},
        headers=headers,
    )
    completed = client.post(f"/api/v1/tasks/{task['id']}/check", headers=headers)
    response = client.get("/api/v1/progress", headers=headers)

    assert moved.status_code == 200
    assert moved.json()["scheduled_date"] == "2026-09-29"
    assert moved.json()["period_start"] == "2026-09-21"
    assert completed.status_code == 200
    body = response.json()
    assert body["period_start"] == "2026-09-21"
    [coding] = body["areas"]
    assert [(item["title"], item["target"], item["done"]) for item in coding["requirements"]] == [
        ("Deep work", 2, 1),
    ]
    assert body["percent"] == 50


def test_progress_uses_the_users_week_start_and_local_date(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Sunday 22:00 UTC is already Monday 01:00 in Istanbul.
    freeze_progress_service_time(monkeypatch, observed_at=datetime(2026, 9, 27, 22, tzinfo=UTC))
    monday_headers = bearer(register(client, "progress-monday@example.com"))
    sunday_headers = bearer(register(client, "progress-sunday@example.com"))

    with db_session.begin():
        get_user(db_session, "progress-sunday@example.com").week_start_day = 7

    monday_week = client.get("/api/v1/progress", headers=monday_headers)
    sunday_week = client.get("/api/v1/progress", headers=sunday_headers)

    assert monday_week.status_code == 200
    assert monday_week.json() == {
        "period_start": "2026-09-28",
        "period_end": "2026-10-04",
        "percent": None,
        "areas": [],
    }
    assert sunday_week.json()["period_start"] == "2026-09-27"
    assert sunday_week.json()["period_end"] == "2026-10-03"


def test_progress_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/progress")

    assert response.status_code == 401


def freeze_progress_service_time(
    monkeypatch: pytest.MonkeyPatch,
    *,
    observed_at: datetime = OBSERVED_AT,
) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return observed_at if tz is None else observed_at.astimezone(tz)

    monkeypatch.setattr(results_service_module, "datetime", FixedDateTime)


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


def create_goal(
    client: TestClient,
    headers: dict[str, str],
    *,
    area_id: str,
    title: str,
    weekly_target: int | None,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/goals",
        json={"area_id": area_id, "title": title, "weekly_target": weekly_target},
        headers=headers,
    )
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


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def set_created_at(db_session: Session, *, user_id: int, value: datetime) -> None:
    """Move the user's goals and habits before the observed week; creation time is real time."""
    db_session.execute(update(Goal).where(Goal.user_id == user_id).values(created_at=value))
    db_session.execute(update(Habit).where(Habit.user_id == user_id).values(created_at=value))


def build_task(
    *,
    user_id: int,
    goal: dict[str, object],
    day: date,
    blocks: str,
    status: TaskStatus = TaskStatus.DONE,
) -> Task:
    return Task(
        user_id=user_id,
        goal_id=int(str(goal["id"])),
        rule_id=None,
        title=str(goal["title"]),
        occurrence_date=None,
        scheduled_date=day,
        start_time=None,
        duration_minutes=None,
        end_time=None,
        block_count=Decimal(blocks),
        period_start=get_week_start(day, week_start_day=1),
        status=status.value,
        completed_at=OBSERVED_AT if status == TaskStatus.DONE else None,
    )
