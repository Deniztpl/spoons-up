from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
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


def test_habit_crud_and_area_filter(client: TestClient) -> None:
    headers = bearer(register(client, "habits@example.com"))
    first_area = create_area(client, headers, "Health")
    second_area = create_area(client, headers, "Social")

    first = create_habit(
        client,
        headers,
        area_id=str(first_area["id"]),
        title="  Walk  ",
        mode="DAILY",
    )
    second = create_habit(
        client,
        headers,
        area_id=str(second_area["id"]),
        title="Call family",
        mode="WEEKLY",
    )

    assert isinstance(first["id"], str)
    assert first["title"] == "Walk"
    assert first["mode"] == "DAILY"
    assert str(first["created_at"]).endswith("Z")

    listed = client.get("/api/v1/habits", headers=headers)
    filtered = client.get(
        "/api/v1/habits",
        params={"area_id": second_area["id"]},
        headers=headers,
    )

    assert listed.status_code == 200
    assert [habit["title"] for habit in listed.json()["habits"]] == [
        "Walk",
        "Call family",
    ]
    assert [habit["id"] for habit in filtered.json()["habits"]] == [second["id"]]

    updated = client.patch(
        f"/api/v1/habits/{first['id']}",
        json={
            "area_id": second_area["id"],
            "title": "Morning walk",
            "mode": "WEEKLY",
        },
        headers=headers,
    )

    assert updated.status_code == 200
    assert updated.json()["area_id"] == second_area["id"]
    assert updated.json()["title"] == "Morning walk"
    assert updated.json()["mode"] == "WEEKLY"

    deleted = client.delete(f"/api/v1/habits/{first['id']}", headers=headers)
    missing = client.patch(
        f"/api/v1/habits/{first['id']}",
        json={"title": "Missing"},
        headers=headers,
    )

    assert deleted.status_code == 204
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_habit_payloads_are_validated(client: TestClient) -> None:
    headers = bearer(register(client, "habit-validation@example.com"))
    area = create_area(client, headers, "Health")

    empty_title = client.post(
        "/api/v1/habits",
        json={"area_id": area["id"], "title": "   ", "mode": "DAILY"},
        headers=headers,
    )
    invalid_mode = client.post(
        "/api/v1/habits",
        json={"area_id": area["id"], "title": "Walk", "mode": "MONTHLY"},
        headers=headers,
    )
    invalid_area_id = client.post(
        "/api/v1/habits",
        json={"area_id": "invalid", "title": "Walk", "mode": "DAILY"},
        headers=headers,
    )
    explicit_null = client.patch(
        "/api/v1/habits/1",
        json={"title": None},
        headers=headers,
    )

    assert empty_title.status_code == 422
    assert "title" in empty_title.json()["fields"]
    assert invalid_mode.status_code == 422
    assert "mode" in invalid_mode.json()["fields"]
    assert invalid_area_id.status_code == 422
    assert "area_id" in invalid_area_id.json()["fields"]
    assert explicit_null.status_code == 422
    assert "title" in explicit_null.json()["fields"]


def test_habits_are_scoped_to_the_token_user(client: TestClient) -> None:
    owner_headers = bearer(register(client, "habit-owner@example.com"))
    stranger_headers = bearer(register(client, "habit-stranger@example.com"))
    owner_area = create_area(client, owner_headers, "Private")
    stranger_area = create_area(client, stranger_headers, "Other")
    habit = create_habit(
        client,
        owner_headers,
        area_id=str(owner_area["id"]),
        title="Journal",
        mode="DAILY",
    )

    responses = [
        client.patch(
            f"/api/v1/habits/{habit['id']}",
            json={"title": "Changed"},
            headers=stranger_headers,
        ),
        client.delete(f"/api/v1/habits/{habit['id']}", headers=stranger_headers),
        client.post(
            f"/api/v1/habits/{habit['id']}/check",
            json={"date": "2026-09-24"},
            headers=stranger_headers,
        ),
        client.delete(
            f"/api/v1/habits/{habit['id']}/check",
            params={"date": "2026-09-24"},
            headers=stranger_headers,
        ),
        client.post(
            "/api/v1/habits",
            json={"area_id": owner_area["id"], "title": "Stolen", "mode": "DAILY"},
            headers=stranger_headers,
        ),
        client.patch(
            f"/api/v1/habits/{habit['id']}",
            json={"area_id": stranger_area["id"]},
            headers=owner_headers,
        ),
    ]

    assert all(response.status_code == 404 for response in responses)
    assert all(response.json()["code"] == "not_found" for response in responses)
    assert client.get("/api/v1/habits", headers=stranger_headers).json() == {"habits": []}


def test_daily_habit_check_duplicate_and_undo(client: TestClient) -> None:
    headers = bearer(register(client, "daily-check@example.com"))
    area = create_area(client, headers, "Health")
    habit = create_habit(
        client,
        headers,
        area_id=str(area["id"]),
        title="Walk",
        mode="DAILY",
    )
    check_url = f"/api/v1/habits/{habit['id']}/check"

    checked = client.post(check_url, json={"date": "2026-09-24"}, headers=headers)
    duplicate = client.post(check_url, json={"date": "2026-09-24"}, headers=headers)

    assert checked.status_code == 201
    assert checked.json()["habit_id"] == habit["id"]
    assert checked.json()["period_type"] == "DAY"
    assert checked.json()["period_start"] == "2026-09-24"
    assert checked.json()["completed_at"].endswith("Z")
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "already_checked"

    unchecked = client.delete(check_url, params={"date": "2026-09-24"}, headers=headers)
    already_unchecked = client.delete(
        check_url,
        params={"date": "2026-09-24"},
        headers=headers,
    )
    rechecked = client.post(check_url, json={"date": "2026-09-24"}, headers=headers)

    assert unchecked.status_code == 204
    assert already_unchecked.status_code == 204
    assert rechecked.status_code == 201


def test_weekly_checks_follow_week_start_and_mode_changes_keep_old_entries(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "weekly-check@example.com"))
    area = create_area(client, headers, "Social")
    habit = create_habit(
        client,
        headers,
        area_id=str(area["id"]),
        title="Call family",
        mode="DAILY",
    )
    check_url = f"/api/v1/habits/{habit['id']}/check"

    daily_entry = client.post(check_url, json={"date": "2026-09-24"}, headers=headers)
    updated = client.patch(
        f"/api/v1/habits/{habit['id']}",
        json={"mode": "WEEKLY"},
        headers=headers,
    )
    weekly_entry = client.post(check_url, json={"date": "2026-09-24"}, headers=headers)
    same_week = client.post(check_url, json={"date": "2026-09-27"}, headers=headers)
    next_week = client.post(check_url, json={"date": "2026-09-28"}, headers=headers)

    assert daily_entry.json()["period_type"] == "DAY"
    assert daily_entry.json()["period_start"] == "2026-09-24"
    assert updated.status_code == 200
    assert weekly_entry.status_code == 201
    assert weekly_entry.json()["period_type"] == "WEEK"
    assert weekly_entry.json()["period_start"] == "2026-09-21"
    assert same_week.status_code == 409
    assert same_week.json()["code"] == "already_checked"
    assert next_week.status_code == 201
    assert next_week.json()["period_start"] == "2026-09-28"

    entries = list(
        db_session.scalars(select(HabitEntry).where(HabitEntry.habit_id == int(str(habit["id"]))))
    )
    assert {(entry.period_type, entry.period_start) for entry in entries} == {
        ("DAY", date(2026, 9, 24)),
        ("WEEK", date(2026, 9, 21)),
        ("WEEK", date(2026, 9, 28)),
    }


def test_deleting_a_habit_hard_deletes_its_entries(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "habit-delete@example.com"))
    area = create_area(client, headers, "Health")
    habit = create_habit(
        client,
        headers,
        area_id=str(area["id"]),
        title="Walk",
        mode="DAILY",
    )
    checked = client.post(
        f"/api/v1/habits/{habit['id']}/check",
        json={"date": "2026-09-24"},
        headers=headers,
    )

    deleted = client.delete(f"/api/v1/habits/{habit['id']}", headers=headers)

    assert checked.status_code == 201
    assert deleted.status_code == 204
    assert (
        db_session.scalar(select(HabitEntry).where(HabitEntry.habit_id == int(str(habit["id"]))))
        is None
    )


def test_habits_require_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/habits")

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
