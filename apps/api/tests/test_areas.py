import pytest
from fastapi.testclient import TestClient

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


def test_area_crud_and_archive_filter(client: TestClient) -> None:
    tokens = register(client, "areas@example.com")
    headers = bearer(tokens)

    first = client.post("/api/v1/areas", json={"name": "SWE"}, headers=headers)
    second = client.post("/api/v1/areas", json={"name": "Finance"}, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    first_area = first.json()
    assert isinstance(first_area["id"], str)
    assert first_area["name"] == "SWE"
    assert first_area["archived_at"] is None
    assert first_area["unarchived_at"] is None
    assert first_area["created_at"].endswith("Z")

    listed = client.get("/api/v1/areas", headers=headers)
    fetched = client.get(f"/api/v1/areas/{first_area['id']}", headers=headers)
    renamed = client.patch(
        f"/api/v1/areas/{first_area['id']}",
        json={"name": "Software"},
        headers=headers,
    )

    assert listed.status_code == 200
    assert [area["name"] for area in listed.json()["areas"]] == ["SWE", "Finance"]
    assert fetched.json() == first_area
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Software"

    archived = client.post(
        f"/api/v1/areas/{first_area['id']}/archive",
        json={"archived": True},
        headers=headers,
    )
    active_list = client.get("/api/v1/areas", headers=headers)
    full_list = client.get("/api/v1/areas?include_archived=true", headers=headers)

    assert archived.status_code == 200
    assert archived.json()["archived_at"].endswith("Z")
    assert archived.json()["unarchived_at"] is None
    assert [area["name"] for area in active_list.json()["areas"]] == ["Finance"]
    assert [area["name"] for area in full_list.json()["areas"]] == [
        "Software",
        "Finance",
    ]

    already_archived = client.post(
        f"/api/v1/areas/{first_area['id']}/archive",
        json={"archived": True},
        headers=headers,
    )

    assert already_archived.status_code == 200
    assert already_archived.json()["archived_at"] == archived.json()["archived_at"]
    assert already_archived.json()["unarchived_at"] is None

    restored = client.post(
        f"/api/v1/areas/{first_area['id']}/archive",
        json={"archived": False},
        headers=headers,
    )
    restored_active_list = client.get("/api/v1/areas", headers=headers)

    assert restored.status_code == 200
    assert restored.json()["archived_at"] is None
    assert restored.json()["unarchived_at"].endswith("Z")
    assert [area["name"] for area in restored_active_list.json()["areas"]] == [
        "Software",
        "Finance",
    ]

    already_restored = client.post(
        f"/api/v1/areas/{first_area['id']}/archive",
        json={"archived": False},
        headers=headers,
    )

    assert already_restored.status_code == 200
    assert already_restored.json()["archived_at"] is None
    assert already_restored.json()["unarchived_at"] == restored.json()["unarchived_at"]

    rearchived = client.post(
        f"/api/v1/areas/{first_area['id']}/archive",
        json={"archived": True},
        headers=headers,
    )

    assert rearchived.status_code == 200
    assert rearchived.json()["archived_at"].endswith("Z")
    assert rearchived.json()["unarchived_at"] == restored.json()["unarchived_at"]

    deleted = client.delete(f"/api/v1/areas/{first_area['id']}", headers=headers)
    missing = client.get(f"/api/v1/areas/{first_area['id']}", headers=headers)

    assert deleted.status_code == 204
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_area_names_are_validated_and_unique_per_user(client: TestClient) -> None:
    first_user = register(client, "first-area-owner@example.com")
    second_user = register(client, "second-area-owner@example.com")

    created = client.post(
        "/api/v1/areas",
        json={"name": "  SWE  "},
        headers=bearer(first_user),
    )
    duplicate = client.post(
        "/api/v1/areas",
        json={"name": "SWE"},
        headers=bearer(first_user),
    )
    other_user_same_name = client.post(
        "/api/v1/areas",
        json={"name": "SWE"},
        headers=bearer(second_user),
    )
    empty = client.post(
        "/api/v1/areas",
        json={"name": "   "},
        headers=bearer(first_user),
    )

    assert created.status_code == 201
    assert created.json()["name"] == "SWE"
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "area_name_taken"
    assert other_user_same_name.status_code == 201
    assert empty.status_code == 422
    assert "name" in empty.json()["fields"]


def test_another_users_area_is_not_found_for_every_item_operation(
    client: TestClient,
) -> None:
    owner = register(client, "area-owner@example.com")
    stranger = register(client, "area-stranger@example.com")
    created = client.post(
        "/api/v1/areas",
        json={"name": "Private"},
        headers=bearer(owner),
    )
    area_id = created.json()["id"]
    stranger_headers = bearer(stranger)

    responses = [
        client.get(f"/api/v1/areas/{area_id}", headers=stranger_headers),
        client.patch(
            f"/api/v1/areas/{area_id}",
            json={"name": "Stolen"},
            headers=stranger_headers,
        ),
        client.post(
            f"/api/v1/areas/{area_id}/archive",
            json={"archived": True},
            headers=stranger_headers,
        ),
        client.delete(f"/api/v1/areas/{area_id}", headers=stranger_headers),
    ]

    assert all(response.status_code == 404 for response in responses)
    assert all(response.json()["code"] == "not_found" for response in responses)
    assert client.get(f"/api/v1/areas/{area_id}", headers=bearer(owner)).status_code == 200
    assert client.get("/api/v1/areas", headers=stranger_headers).json() == {"areas": []}


def test_areas_require_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/areas")

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
