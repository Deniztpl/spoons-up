from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import HabitEntry

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
