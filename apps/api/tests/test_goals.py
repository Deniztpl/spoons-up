import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Goal, GoalRule

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
        json={
            "area_id": area_id,
            "title": title,
            "weekly_target": weekly_target,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_rule(
    client: TestClient,
    headers: dict[str, str],
    *,
    goal_id: str,
    block_count: float | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "byweekday": [5, 1, 3],
        "start_time": "19:00",
        "duration_minutes": 60,
    }
    if block_count is not None:
        payload["block_count"] = block_count
    response = client.post(
        f"/api/v1/goals/{goal_id}/rules",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_goal_crud_and_area_filter(client: TestClient) -> None:
    headers = bearer(register(client, "goals@example.com"))
    first_area = create_area(client, headers, "Work")
    second_area = create_area(client, headers, "Learning")

    first = create_goal(
        client,
        headers,
        area_id=str(first_area["id"]),
        title="  CS blocks  ",
        weekly_target=3,
    )
    second = create_goal(
        client,
        headers,
        area_id=str(second_area["id"]),
        title="Read a book",
        weekly_target=None,
    )

    assert isinstance(first["id"], str)
    assert first["title"] == "CS blocks"
    assert first["weekly_target"] == 3
    assert first["rules"] == []
    assert str(first["created_at"]).endswith("Z")

    listed = client.get("/api/v1/goals", headers=headers)
    filtered = client.get(
        "/api/v1/goals",
        params={"area_id": second_area["id"]},
        headers=headers,
    )
    fetched = client.get(f"/api/v1/goals/{first['id']}", headers=headers)

    assert listed.status_code == 200
    assert [goal["id"] for goal in listed.json()["goals"]] == [first["id"], second["id"]]
    assert [goal["id"] for goal in filtered.json()["goals"]] == [second["id"]]
    assert fetched.json()["id"] == first["id"]

    updated = client.patch(
        f"/api/v1/goals/{first['id']}",
        json={
            "area_id": second_area["id"],
            "title": "Focused study",
            "weekly_target": None,
        },
        headers=headers,
    )

    assert updated.status_code == 200
    assert updated.json()["area_id"] == second_area["id"]
    assert updated.json()["title"] == "Focused study"
    assert updated.json()["weekly_target"] is None

    deleted = client.delete(f"/api/v1/goals/{first['id']}", headers=headers)
    missing = client.get(f"/api/v1/goals/{first['id']}", headers=headers)

    assert deleted.status_code == 204
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_goal_rule_crud_and_nested_response(client: TestClient) -> None:
    headers = bearer(register(client, "goal-rules@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(
        client,
        headers,
        area_id=str(area["id"]),
        title="CS blocks",
        weekly_target=3,
    )

    default_rule = create_rule(client, headers, goal_id=str(goal["id"]))
    second_rule = create_rule(client, headers, goal_id=str(goal["id"]), block_count=2)

    assert default_rule["goal_id"] == goal["id"]
    assert default_rule["byweekday"] == [1, 3, 5]
    assert default_rule["start_time"] == "19:00"
    assert default_rule["duration_minutes"] == 60
    assert default_rule["block_count"] == 1

    updated = client.patch(
        f"/api/v1/rules/{default_rule['id']}",
        json={
            "byweekday": [4, 1],
            "start_time": "20:30",
            "duration_minutes": 90,
            "block_count": 0.5,
        },
        headers=headers,
    )
    goal_with_rules = client.get(f"/api/v1/goals/{goal['id']}", headers=headers)

    assert updated.status_code == 200
    assert updated.json()["byweekday"] == [1, 4]
    assert updated.json()["start_time"] == "20:30"
    assert updated.json()["duration_minutes"] == 90
    assert updated.json()["block_count"] == 0.5
    assert [rule["id"] for rule in goal_with_rules.json()["rules"]] == [
        default_rule["id"],
        second_rule["id"],
    ]

    deleted = client.delete(f"/api/v1/rules/{second_rule['id']}", headers=headers)
    after_delete = client.get(f"/api/v1/goals/{goal['id']}", headers=headers)

    assert deleted.status_code == 204
    assert [rule["id"] for rule in after_delete.json()["rules"]] == [default_rule["id"]]


def test_goal_and_rule_payloads_are_validated(client: TestClient) -> None:
    headers = bearer(register(client, "goal-validation@example.com"))
    area = create_area(client, headers, "Work")
    goal = create_goal(
        client,
        headers,
        area_id=str(area["id"]),
        title="CS blocks",
        weekly_target=3,
    )

    invalid_requests = [
        client.post(
            "/api/v1/goals",
            json={"area_id": area["id"], "title": "   ", "weekly_target": 1},
            headers=headers,
        ),
        client.post(
            "/api/v1/goals",
            json={"area_id": area["id"], "title": "Goal", "weekly_target": 0},
            headers=headers,
        ),
        client.patch(
            f"/api/v1/goals/{goal['id']}",
            json={"title": None},
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={"byweekday": [], "start_time": "19:00", "duration_minutes": 60},
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={"byweekday": [1, 8], "start_time": "19:00", "duration_minutes": 60},
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={"byweekday": [1, 1], "start_time": "19:00", "duration_minutes": 60},
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={"byweekday": [1], "start_time": "19:00", "duration_minutes": 0},
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={
                "byweekday": [1],
                "start_time": "19:00",
                "duration_minutes": 60,
                "block_count": 0.25,
            },
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={
                "byweekday": [1],
                "start_time": "19:00+03:00",
                "duration_minutes": 60,
            },
            headers=headers,
        ),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={
                "byweekday": [1],
                "start_time": "19:00",
                "duration_minutes": 60,
                "block_count": 100,
            },
            headers=headers,
        ),
    ]

    assert all(response.status_code == 422 for response in invalid_requests)
    assert all(response.json()["code"] == "validation_error" for response in invalid_requests)


def test_goals_and_rules_are_scoped_to_the_token_user_and_active_areas(
    client: TestClient,
) -> None:
    owner_headers = bearer(register(client, "goal-owner@example.com"))
    stranger_headers = bearer(register(client, "goal-stranger@example.com"))
    owner_area = create_area(client, owner_headers, "Private")
    stranger_area = create_area(client, stranger_headers, "Other")
    goal = create_goal(
        client,
        owner_headers,
        area_id=str(owner_area["id"]),
        title="Private goal",
        weekly_target=2,
    )
    rule = create_rule(client, owner_headers, goal_id=str(goal["id"]))

    stranger_responses = [
        client.get(f"/api/v1/goals/{goal['id']}", headers=stranger_headers),
        client.patch(
            f"/api/v1/goals/{goal['id']}",
            json={"title": "Changed"},
            headers=stranger_headers,
        ),
        client.delete(f"/api/v1/goals/{goal['id']}", headers=stranger_headers),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={"byweekday": [1], "start_time": "09:00", "duration_minutes": 30},
            headers=stranger_headers,
        ),
        client.patch(
            f"/api/v1/rules/{rule['id']}",
            json={"duration_minutes": 30},
            headers=stranger_headers,
        ),
        client.delete(f"/api/v1/rules/{rule['id']}", headers=stranger_headers),
        client.post(
            "/api/v1/goals",
            json={
                "area_id": owner_area["id"],
                "title": "Stolen",
                "weekly_target": 1,
            },
            headers=stranger_headers,
        ),
        client.patch(
            f"/api/v1/goals/{goal['id']}",
            json={"area_id": stranger_area["id"]},
            headers=owner_headers,
        ),
    ]

    assert all(response.status_code == 404 for response in stranger_responses)
    assert client.get("/api/v1/goals", headers=stranger_headers).json() == {"goals": []}

    archived = client.post(
        f"/api/v1/areas/{owner_area['id']}/archive",
        json={"archived": True},
        headers=owner_headers,
    )
    archived_responses = [
        client.post(
            "/api/v1/goals",
            json={
                "area_id": owner_area["id"],
                "title": "New goal",
                "weekly_target": 1,
            },
            headers=owner_headers,
        ),
        client.get(f"/api/v1/goals/{goal['id']}", headers=owner_headers),
        client.patch(
            f"/api/v1/goals/{goal['id']}",
            json={"title": "Changed"},
            headers=owner_headers,
        ),
        client.delete(f"/api/v1/goals/{goal['id']}", headers=owner_headers),
        client.post(
            f"/api/v1/goals/{goal['id']}/rules",
            json={"byweekday": [1], "start_time": "09:00", "duration_minutes": 30},
            headers=owner_headers,
        ),
        client.patch(
            f"/api/v1/rules/{rule['id']}",
            json={"duration_minutes": 30},
            headers=owner_headers,
        ),
        client.delete(f"/api/v1/rules/{rule['id']}", headers=owner_headers),
    ]

    assert archived.status_code == 200
    assert all(response.status_code == 404 for response in archived_responses)
    assert client.get("/api/v1/goals", headers=owner_headers).json() == {"goals": []}

    restored = client.post(
        f"/api/v1/areas/{owner_area['id']}/archive",
        json={"archived": False},
        headers=owner_headers,
    )
    restored_goal = client.get(f"/api/v1/goals/{goal['id']}", headers=owner_headers)

    assert restored.status_code == 200
    assert restored_goal.status_code == 200
    assert restored_goal.json()["rules"][0]["id"] == rule["id"]


def test_goal_and_area_deletes_cascade_to_rules(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "goal-delete@example.com"))
    first_area = create_area(client, headers, "First area")
    second_area = create_area(client, headers, "Second area")
    first_goal = create_goal(
        client,
        headers,
        area_id=str(first_area["id"]),
        title="First",
        weekly_target=1,
    )
    first_rule = create_rule(client, headers, goal_id=str(first_goal["id"]))
    second_goal = create_goal(
        client,
        headers,
        area_id=str(second_area["id"]),
        title="Second",
        weekly_target=1,
    )
    second_rule = create_rule(client, headers, goal_id=str(second_goal["id"]))

    goal_deleted = client.delete(f"/api/v1/goals/{first_goal['id']}", headers=headers)
    area_deleted = client.delete(f"/api/v1/areas/{second_area['id']}", headers=headers)

    assert goal_deleted.status_code == 204
    assert area_deleted.status_code == 204
    assert db_session.get(Goal, int(str(first_goal["id"]))) is None
    assert db_session.get(GoalRule, int(str(first_rule["id"]))) is None
    assert db_session.get(Goal, int(str(second_goal["id"]))) is None
    assert db_session.get(GoalRule, int(str(second_rule["id"]))) is None


def test_goals_require_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/goals")

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
