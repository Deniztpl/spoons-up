from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config.app import settings
from app.jobs.daily import run_daily_task_generation
from app.models import Task, User
from app.services import user_activity as user_activity_module
from app.services.tasks import TASK_GENERATION_DAYS

pytestmark = pytest.mark.integration

FIXED_NOW = datetime(2026, 9, 23, 21, 30, tzinfo=UTC)


def test_daily_job_generates_tasks_only_for_recently_seen_users(
    client: TestClient,
    db_session: Session,
) -> None:
    active_headers = bearer(register(client, "job-active@example.com"))
    dormant_headers = bearer(register(client, "job-dormant@example.com"))
    active_goal = create_goal_with_daily_rule(client, active_headers, title="Active goal")
    dormant_goal = create_goal_with_daily_rule(client, dormant_headers, title="Dormant goal")

    with db_session.begin():
        active_user = get_user(db_session, "job-active@example.com")
        dormant_user = get_user(db_session, "job-dormant@example.com")
        active_user.last_seen_at = FIXED_NOW - timedelta(days=1)
        dormant_user.last_seen_at = FIXED_NOW - timedelta(days=settings.active_user_days + 1)
        db_session.execute(delete(Task))

    processed_users = run_daily_task_generation(db_session, now=FIXED_NOW)

    active_tasks = list(
        db_session.scalars(
            select(Task)
            .where(Task.goal_id == int(str(active_goal["id"])))
            .order_by(Task.scheduled_date)
        )
    )
    dormant_tasks = list(
        db_session.scalars(select(Task).where(Task.goal_id == int(str(dormant_goal["id"]))))
    )
    active_today = FIXED_NOW.astimezone(ZoneInfo(active_user.timezone)).date()

    assert processed_users == 1
    assert len(active_tasks) == TASK_GENERATION_DAYS
    assert active_tasks[0].scheduled_date == active_today
    assert active_tasks[-1].scheduled_date == active_today + timedelta(
        days=TASK_GENERATION_DAYS - 1
    )
    assert dormant_tasks == []


def test_first_request_after_dormancy_restores_the_current_window(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_user_activity_time(monkeypatch)
    headers = bearer(register(client, "returning-user@example.com"))
    goal = create_goal_with_daily_rule(client, headers, title="Returning goal")

    with db_session.begin():
        user = get_user(db_session, "returning-user@example.com")
        user.last_seen_at = FIXED_NOW - timedelta(days=settings.active_user_days + 1)
        db_session.execute(delete(Task).where(Task.user_id == user.id))

    response = client.get("/api/v1/areas", headers=headers)

    assert response.status_code == 200
    tasks = list(
        db_session.scalars(
            select(Task).where(Task.goal_id == int(str(goal["id"]))).order_by(Task.scheduled_date)
        )
    )
    user = get_user(db_session, "returning-user@example.com")
    local_today = FIXED_NOW.astimezone(ZoneInfo(user.timezone)).date()

    assert user.last_seen_at == FIXED_NOW
    assert len(tasks) == TASK_GENERATION_DAYS
    assert tasks[0].scheduled_date == local_today
    assert all(task.scheduled_date >= local_today for task in tasks)


def test_active_request_refreshes_last_seen_without_generating_missing_tasks(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_user_activity_time(monkeypatch)
    headers = bearer(register(client, "active-request@example.com"))
    goal = create_goal_with_daily_rule(client, headers, title="Active request goal")

    with db_session.begin():
        user = get_user(db_session, "active-request@example.com")
        user.last_seen_at = FIXED_NOW - timedelta(days=1)
        db_session.execute(delete(Task).where(Task.user_id == user.id))

    response = client.get("/api/v1/areas", headers=headers)

    assert response.status_code == 200
    assert (
        db_session.scalar(select(Task).where(Task.goal_id == int(str(goal["id"]))).limit(1)) is None
    )
    assert get_user(db_session, "active-request@example.com").last_seen_at == FIXED_NOW


def freeze_user_activity_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return FIXED_NOW if tz is None else FIXED_NOW.astimezone(tz)

    monkeypatch.setattr(user_activity_module, "datetime", FixedDateTime)


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


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


def create_goal_with_daily_rule(
    client: TestClient,
    headers: dict[str, str],
    *,
    title: str,
) -> dict[str, object]:
    area_response = client.post(
        "/api/v1/areas",
        json={"name": title},
        headers=headers,
    )
    assert area_response.status_code == 201

    goal_response = client.post(
        "/api/v1/goals",
        json={
            "area_id": area_response.json()["id"],
            "title": title,
            "weekly_target": 7,
        },
        headers=headers,
    )
    assert goal_response.status_code == 201

    rule_response = client.post(
        f"/api/v1/goals/{goal_response.json()['id']}/rules",
        json={
            "byweekday": [1, 2, 3, 4, 5, 6, 7],
            "start_time": "09:00",
            "duration_minutes": 60,
            "block_count": 1,
        },
        headers=headers,
    )
    assert rule_response.status_code == 201
    return goal_response.json()
