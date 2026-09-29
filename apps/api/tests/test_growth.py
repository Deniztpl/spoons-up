from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.periods import get_week_start
from app.jobs.daily import run_results_freeze
from app.models import Area, Goal, Habit, PeriodResult, Task, TaskStatus, User
from app.services import results as results_service_module

pytestmark = pytest.mark.integration

# Wednesday in Istanbul; the last closed week runs Monday 2026-09-14 to Sunday 2026-09-20.
FIXED_NOW = datetime(2026, 9, 23, 12, tzinfo=UTC)
CLOSED_WEEK_START = datetime(2026, 9, 14, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def fixed_results_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return FIXED_NOW if tz is None else FIXED_NOW.astimezone(tz)

    monkeypatch.setattr(results_service_module, "datetime", FixedDateTime)


def test_freeze_writes_each_closed_week_once_and_growth_reads_it(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "growth@example.com"))
    area_id = str(create_area(client, headers, "Coding")["id"])
    goal = create_goal(client, headers, area_id=area_id, title="Deep work", weekly_target=2)
    practice = create_habit(client, headers, area_id=area_id, title="Practice", mode="DAILY")
    review = create_habit(client, headers, area_id=area_id, title="Review", mode="WEEKLY")
    for day in ("2026-09-14", "2026-09-15"):
        check_habit(client, headers, habit_id=str(practice["id"]), target_date=day)
    check_habit(client, headers, habit_id=str(review["id"]), target_date="2026-09-16")

    with db_session.begin():
        user = get_user(db_session, "growth@example.com")
        start_in_closed_week(db_session, user=user)
        db_session.add_all(
            [
                build_task(user_id=user.id, goal=goal, day=date(2026, 9, 14), blocks="1.0"),
                build_task(user_id=user.id, goal=goal, day=date(2026, 9, 15), blocks="0.5"),
            ]
        )

    # A first run also covers the weeks back to signup; nothing was active in them.
    run_results_freeze(db_session, now=FIXED_NOW)
    run_results_freeze(db_session, now=FIXED_NOW)

    assert frozen_rows(db_session) == [
        (date(2026, 9, 14), int(area_id), "GOAL", "Deep work", 2, Decimal("1.5")),
        (date(2026, 9, 14), int(area_id), "HABIT", "Practice", 7, Decimal("2")),
        (date(2026, 9, 14), int(area_id), "HABIT", "Review", 1, Decimal("1")),
    ]
    assert get_user(db_session, "growth@example.com").last_frozen_week == date(2026, 9, 14)
    db_session.rollback()

    retargeted = client.patch(
        f"/api/v1/goals/{goal['id']}",
        json={"weekly_target": 5},
        headers=headers,
    )
    assert retargeted.status_code == 200
    with db_session.begin():
        db_session.add(build_task(user_id=user.id, goal=goal, day=date(2026, 9, 16), blocks="1.0"))
    run_results_freeze(db_session, now=FIXED_NOW)

    response = client.get("/api/v1/growth?weeks=2", headers=headers)

    assert response.status_code == 200
    closed_week, earlier_week = response.json()["weeks"]
    assert closed_week["period_start"] == "2026-09-14"
    assert closed_week["period_end"] == "2026-09-20"
    # (1.5/2 + 2/7 + 1/1) / 3 = 67.9%, judged against the target the week closed with
    assert closed_week["percent"] == 68
    [coding] = closed_week["areas"]
    assert coding["name"] == "Coding"
    assert coding["percent"] == 68
    assert [
        (item["ref_type"], item["title"], item["target"], item["done"])
        for item in coding["requirements"]
    ] == [
        ("GOAL", "Deep work", 2, 1.5),
        ("HABIT", "Practice", 7, 2),
        ("HABIT", "Review", 1, 1),
    ]
    assert [day["done"] for day in coding["days"]] == [True, True] + [False] * 5
    assert earlier_week == {
        "period_start": "2026-09-07",
        "period_end": "2026-09-13",
        "percent": None,
        "areas": [],
    }


def test_freeze_waits_for_the_local_week_turn_and_catches_up_missed_weeks(
    client: TestClient,
    db_session: Session,
) -> None:
    istanbul_headers = bearer(register(client, "growth-istanbul@example.com"))
    new_york_headers = bearer(
        register(client, "growth-new-york@example.com", timezone="America/New_York")
    )
    for headers in (istanbul_headers, new_york_headers):
        area_id = str(create_area(client, headers, "Health")["id"])
        create_habit(client, headers, area_id=area_id, title="Walk", mode="DAILY")

    with db_session.begin():
        for email in ("growth-istanbul@example.com", "growth-new-york@example.com"):
            user = get_user(db_session, email)
            db_session.execute(
                update(Habit)
                .where(Habit.user_id == user.id)
                .values(created_at=datetime(2026, 9, 1, tzinfo=UTC))
            )
            user.last_frozen_week = date(2026, 8, 31)

    # Sunday 22:00 UTC: Monday has begun in Istanbul but not yet in New York.
    run_results_freeze(db_session, now=datetime(2026, 9, 20, 22, tzinfo=UTC))

    istanbul = get_user(db_session, "growth-istanbul@example.com")
    new_york = get_user(db_session, "growth-new-york@example.com")
    assert frozen_weeks(db_session, user_id=istanbul.id) == [date(2026, 9, 7), date(2026, 9, 14)]
    assert istanbul.last_frozen_week == date(2026, 9, 14)
    assert frozen_weeks(db_session, user_id=new_york.id) == [date(2026, 9, 7)]
    assert new_york.last_frozen_week == date(2026, 9, 7)


def test_freeze_judges_an_area_archived_mid_week_and_keeps_its_rows_after_delete(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "growth-archived@example.com"))
    area_id = str(create_area(client, headers, "Sleep")["id"])
    bedtime = create_habit(client, headers, area_id=area_id, title="Bedtime", mode="DAILY")
    check_habit(client, headers, habit_id=str(bedtime["id"]), target_date="2026-09-14")

    with db_session.begin():
        user = get_user(db_session, "growth-archived@example.com")
        start_in_closed_week(db_session, user=user)
        # Archived on Wednesday afternoon in Istanbul.
        db_session.execute(
            update(Area)
            .where(Area.id == int(area_id))
            .values(archived_at=datetime(2026, 9, 16, 12, tzinfo=UTC))
        )

    run_results_freeze(db_session, now=FIXED_NOW)

    assert frozen_rows(db_session) == [
        (date(2026, 9, 14), int(area_id), "HABIT", "Bedtime", 3, Decimal("1")),
    ]
    db_session.rollback()
    archived_week = client.get("/api/v1/growth?weeks=1", headers=headers).json()["weeks"][0]
    assert archived_week["areas"] == []
    assert archived_week["percent"] is None

    deleted = client.delete(f"/api/v1/areas/{area_id}", headers=headers)

    assert deleted.status_code == 204
    assert frozen_rows(db_session) == [
        (date(2026, 9, 14), None, "HABIT", "Bedtime", 3, Decimal("1")),
    ]


def test_growth_validates_weeks_and_requires_authentication(client: TestClient) -> None:
    headers = bearer(register(client, "growth-weeks@example.com"))

    assert client.get("/api/v1/growth?weeks=0", headers=headers).status_code == 422
    assert client.get("/api/v1/growth?weeks=53", headers=headers).status_code == 422
    assert len(client.get("/api/v1/growth", headers=headers).json()["weeks"]) == 8
    assert client.get("/api/v1/growth").status_code == 401


def register(
    client: TestClient,
    email: str,
    *,
    timezone: str = "Europe/Istanbul",
) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "timezone": timezone},
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


def start_in_closed_week(db_session: Session, *, user: User) -> None:
    """Sign the user up earlier this month and start their goals and habits in the closed week."""
    user.created_at = datetime(2026, 9, 1, tzinfo=UTC)
    db_session.execute(
        update(Goal).where(Goal.user_id == user.id).values(created_at=CLOSED_WEEK_START)
    )
    db_session.execute(
        update(Habit).where(Habit.user_id == user.id).values(created_at=CLOSED_WEEK_START)
    )


def frozen_rows(db_session: Session) -> list[tuple[object, ...]]:
    rows = db_session.scalars(select(PeriodResult).order_by(PeriodResult.id))
    return [
        (row.period_start, row.area_id, row.ref_type, row.title, row.target, row.done)
        for row in rows
    ]


def frozen_weeks(db_session: Session, *, user_id: int) -> list[date]:
    return list(
        db_session.scalars(
            select(PeriodResult.period_start)
            .where(PeriodResult.user_id == user_id)
            .distinct()
            .order_by(PeriodResult.period_start)
        )
    )


def build_task(
    *,
    user_id: int,
    goal: dict[str, object],
    day: date,
    blocks: str,
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
        status=TaskStatus.DONE.value,
        completed_at=datetime.combine(day, datetime.min.time(), tzinfo=UTC),
    )
