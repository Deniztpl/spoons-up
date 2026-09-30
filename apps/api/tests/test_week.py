from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.periods import get_week_start
from app.models import GoalRule, Task, TaskStatus, User
from app.services import week as week_service_module

pytestmark = pytest.mark.integration

OBSERVED_AT = datetime(2026, 9, 24, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def fixed_week_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_week_service_time(monkeypatch)


def test_week_returns_seven_ordered_days_and_tasks(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "week@example.com"))
    stranger_headers = bearer(register(client, "week-stranger@example.com"))

    with db_session.begin():
        user = get_user(db_session, "week@example.com")
        stranger = get_user(db_session, "week-stranger@example.com")
        early = build_task(
            user_id=user.id,
            title="Early",
            scheduled_date=date(2026, 9, 21),
            start_time=time(8),
        )
        late = build_task(
            user_id=user.id,
            title="Late",
            scheduled_date=date(2026, 9, 21),
            start_time=time(10),
        )
        untimed = build_task(
            user_id=user.id,
            title="Untimed",
            scheduled_date=date(2026, 9, 21),
        )
        midweek = build_task(
            user_id=user.id,
            title="Midweek",
            scheduled_date=date(2026, 9, 23),
        )
        deleted = build_task(
            user_id=user.id,
            title="Deleted",
            scheduled_date=date(2026, 9, 22),
            status=TaskStatus.DELETED,
        )
        strangers_task = build_task(
            user_id=stranger.id,
            title="Private",
            scheduled_date=date(2026, 9, 21),
        )
        db_session.add_all([early, late, untimed, midweek, deleted, strangers_task])
        db_session.flush()
        early_id = str(early.id)

    response = client.get(
        "/api/v1/week",
        params={"start": "2026-09-24"},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["period_start"] == "2026-09-21"
    assert [day["date"] for day in body["days"]] == [
        "2026-09-21",
        "2026-09-22",
        "2026-09-23",
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
    ]
    assert [task["title"] for task in body["days"][0]["tasks"]] == [
        "Early",
        "Late",
        "Untimed",
    ]
    assert body["days"][0]["tasks"][0] == {
        "id": early_id,
        "goal_id": None,
        "rule_id": None,
        "parent_id": None,
        "title": "Early",
        "start_time": "08:00",
        "duration_minutes": None,
        "end_time": None,
        "block_count": 1.0,
        "status": "PENDING",
        "scheduled_date": "2026-09-21",
        "occurrence_date": None,
        "period_start": "2026-09-21",
        "step_progress": None,
        "parent": None,
    }
    assert body["days"][1]["tasks"] == []
    assert [task["title"] for task in body["days"][2]["tasks"]] == ["Midweek"]
    assert body["later_tasks"] == {"count": 0, "items": []}
    assert client.get("/api/v1/week", headers=stranger_headers).status_code == 200


def test_week_defaults_to_current_allows_next_and_rejects_other_weeks(
    client: TestClient,
) -> None:
    headers = bearer(register(client, "week-range@example.com"))

    current = client.get("/api/v1/week", headers=headers)
    following = client.get(
        "/api/v1/week",
        params={"start": "2026-10-01"},
        headers=headers,
    )
    past = client.get(
        "/api/v1/week",
        params={"start": "2026-09-20"},
        headers=headers,
    )
    third = client.get(
        "/api/v1/week",
        params={"start": "2026-10-05"},
        headers=headers,
    )
    invalid = client.get(
        "/api/v1/week",
        params={"start": "not-a-date"},
        headers=headers,
    )
    unauthorized = client.get("/api/v1/week")

    assert current.status_code == 200
    assert current.json()["period_start"] == "2026-09-21"
    assert following.status_code == 200
    assert following.json()["period_start"] == "2026-09-28"
    assert past.status_code == 422
    assert past.json()["fields"] == {"start": "Week must be the current or following week"}
    assert third.status_code == 422
    assert third.json()["fields"] == {"start": "Week must be the current or following week"}
    assert invalid.status_code == 422
    assert "start" in invalid.json()["fields"]
    assert unauthorized.status_code == 401


def test_week_uses_the_users_timezone_and_week_start_day(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_week_service_time(
        monkeypatch,
        observed_at=datetime(2026, 9, 27, 22, 30, tzinfo=UTC),
    )
    headers = bearer(register(client, "week-boundary@example.com"))

    monday_start = client.get("/api/v1/week", headers=headers)
    db_session.execute(
        update(User).where(User.email == "week-boundary@example.com").values(week_start_day=7)
    )
    db_session.commit()
    sunday_start = client.get("/api/v1/week", headers=headers)

    assert monday_start.status_code == 200
    assert monday_start.json()["period_start"] == "2026-09-28"
    assert sunday_start.status_code == 200
    assert sunday_start.json()["period_start"] == "2026-09-27"


def test_week_returns_only_manually_placed_tasks_after_the_following_week(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "week-later@example.com"))
    bearer(register(client, "week-later-stranger@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(
        client,
        headers,
        area_id=str(area["id"]),
        title="Deep work",
    )

    with db_session.begin():
        user = get_user(db_session, "week-later@example.com")
        stranger = get_user(db_session, "week-later-stranger@example.com")
        rule = GoalRule(
            goal_id=int(str(goal["id"])),
            byweekday=[1],
            start_time=None,
            duration_minutes=None,
            block_count=None,
        )
        db_session.add(rule)
        db_session.flush()
        db_session.add_all(
            [
                build_task(
                    user_id=user.id,
                    title="Timed manual",
                    scheduled_date=date(2026, 10, 5),
                    start_time=time(9),
                ),
                build_task(
                    user_id=user.id,
                    title="Untimed manual",
                    scheduled_date=date(2026, 10, 5),
                ),
                build_task(
                    user_id=user.id,
                    goal_id=int(str(goal["id"])),
                    rule_id=rule.id,
                    title="Moved generated",
                    occurrence_date=date(2026, 9, 28),
                    scheduled_date=date(2026, 10, 6),
                    start_time=time(8),
                ),
                build_task(
                    user_id=user.id,
                    goal_id=int(str(goal["id"])),
                    rule_id=rule.id,
                    title="Untouched generated",
                    occurrence_date=date(2026, 10, 7),
                    scheduled_date=date(2026, 10, 7),
                ),
                build_task(
                    user_id=user.id,
                    title="Still next week",
                    scheduled_date=date(2026, 10, 4),
                ),
                build_task(
                    user_id=user.id,
                    title="Deleted manual",
                    scheduled_date=date(2026, 10, 5),
                    status=TaskStatus.DELETED,
                ),
                build_task(
                    user_id=stranger.id,
                    title="Someone else's task",
                    scheduled_date=date(2026, 10, 5),
                ),
            ]
        )

    response = client.get("/api/v1/week", headers=headers)

    assert response.status_code == 200
    later_tasks = response.json()["later_tasks"]
    assert later_tasks["count"] == 3
    assert [
        (item["scheduled_date"], item["start_time"], item["title"]) for item in later_tasks["items"]
    ] == [
        ("2026-10-05", "09:00", "Timed manual"),
        ("2026-10-05", None, "Untimed manual"),
        ("2026-10-06", "08:00", "Moved generated"),
    ]
    assert all(item["id"] for item in later_tasks["items"])
    assert later_tasks["items"][2]["occurrence_date"] == "2026-09-28"


def freeze_week_service_time(
    monkeypatch: pytest.MonkeyPatch,
    *,
    observed_at: datetime = OBSERVED_AT,
) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return observed_at if tz is None else observed_at.astimezone(tz)

    monkeypatch.setattr(week_service_module, "datetime", FixedDateTime)


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
    title: str,
    scheduled_date: date,
    goal_id: int | None = None,
    rule_id: int | None = None,
    occurrence_date: date | None = None,
    start_time: time | None = None,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    quota_date = occurrence_date or scheduled_date
    return Task(
        user_id=user_id,
        goal_id=goal_id,
        rule_id=rule_id,
        title=title,
        occurrence_date=occurrence_date,
        scheduled_date=scheduled_date,
        start_time=start_time,
        duration_minutes=None,
        end_time=None,
        block_count=Decimal("1.0"),
        period_start=get_week_start(quota_date, week_start_day=1),
        status=status.value,
    )
