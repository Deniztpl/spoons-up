from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_refresh_token, verify_password
from app.models import RefreshToken, User

pytestmark = pytest.mark.integration

REGISTER_PAYLOAD = {
    "email": "Deniz@Example.COM",
    "password": "password123",
    "timezone": "Europe/Istanbul",
}


def register(client: TestClient, **overrides: str) -> dict[str, str]:
    payload = REGISTER_PAYLOAD | overrides
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return response.json()


def test_register_persists_normalized_user_and_hashed_tokens(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert response.cookies["refresh_token"] == body["refresh_token"]
    cookie = response.headers["set-cookie"]
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie
    assert "SameSite=lax" in cookie
    assert "Secure" not in cookie

    user = db_session.scalar(select(User).where(User.email == "deniz@example.com"))
    assert user is not None
    assert user.timezone == "Europe/Istanbul"
    assert user.week_start_day == 1
    assert user.password_hash != REGISTER_PAYLOAD["password"]
    assert verify_password(REGISTER_PAYLOAD["password"], user.password_hash)

    stored_token = db_session.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id))
    assert stored_token is not None
    assert stored_token.token_hash == hash_refresh_token(body["refresh_token"])


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"password": "short"}, "password"),
        ({"timezone": "Not/A-Timezone"}, "timezone"),
    ],
)
def test_register_validates_password_and_timezone(
    client: TestClient,
    overrides: dict[str, str],
    field: str,
) -> None:
    response = client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD | overrides)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert field in response.json()["fields"]


def test_duplicate_email_returns_conflict(client: TestClient) -> None:
    register(client)

    response = client.post(
        "/api/v1/auth/register",
        json=REGISTER_PAYLOAD | {"email": "deniz@example.com"},
    )

    assert response.status_code == 409
    assert response.json() == {
        "code": "email_taken",
        "message": "Email already registered",
    }


def test_login_uses_same_error_for_unknown_email_and_wrong_password(
    client: TestClient,
) -> None:
    register(client)

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": "deniz@example.com", "password": "wrong-password"},
    )
    unknown_email = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )

    expected = {"code": "invalid_credentials", "message": "Invalid email or password"}
    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.json() == expected
    assert unknown_email.json() == expected
    assert wrong_password.headers["www-authenticate"] == "Bearer"
    assert unknown_email.headers["www-authenticate"] == "Bearer"


def test_login_returns_tokens_in_body_and_cookie(client: TestClient) -> None:
    register(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "DENIZ@example.com", "password": REGISTER_PAYLOAD["password"]},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.cookies["refresh_token"] == response.json()["refresh_token"]


def test_refresh_prefers_body_and_replay_revokes_replacement(client: TestClient) -> None:
    original = register(client)
    client.cookies.set("refresh_token", "invalid-cookie", path="/api/v1/auth")

    rotated_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original["refresh_token"]},
    )
    assert rotated_response.status_code == 200
    rotated = rotated_response.json()
    assert rotated["refresh_token"] != original["refresh_token"]

    replay = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original["refresh_token"]},
    )
    replacement = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rotated["refresh_token"]},
    )

    assert replay.status_code == 401
    assert replacement.status_code == 401
    assert replay.json()["code"] == "invalid_token"
    assert replacement.json()["code"] == "invalid_token"


def test_refresh_falls_back_to_cookie(client: TestClient) -> None:
    original = register(client)

    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 200
    assert response.json()["refresh_token"] != original["refresh_token"]


def test_expired_refresh_token_is_rejected(
    client: TestClient,
    db_session: Session,
) -> None:
    register(client)
    user_id = db_session.scalar(select(User.id).where(User.email == "deniz@example.com"))
    assert user_id is not None
    raw_token = "expired-refresh-token"
    db_session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            expires_at=datetime.now(UTC) - timedelta(seconds=1),
            revoked_at=None,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": raw_token},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_logout_requires_bearer_and_is_idempotent(client: TestClient) -> None:
    tokens = register(client)
    payload = {"refresh_token": tokens["refresh_token"]}

    unauthorized = client.post("/api/v1/auth/logout", json=payload)
    first = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    second = client.post(
        "/api/v1/auth/logout",
        json=payload,
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    refresh = client.post("/api/v1/auth/refresh", json=payload)

    assert unauthorized.status_code == 401
    assert unauthorized.headers["www-authenticate"] == "Bearer"
    assert first.status_code == 204
    assert second.status_code == 204
    assert "refresh_token=" in first.headers["set-cookie"]
    assert "Max-Age=0" in first.headers["set-cookie"]
    assert refresh.status_code == 401


def test_logout_does_not_revoke_another_users_token(client: TestClient) -> None:
    first_user = register(client)
    second_user = register(
        client,
        email="second@example.com",
        password="second-password",
    )

    response = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": second_user["refresh_token"]},
        headers={"Authorization": f"Bearer {first_user['access_token']}"},
    )
    still_valid = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second_user["refresh_token"]},
    )

    assert response.status_code == 204
    assert still_valid.status_code == 200
