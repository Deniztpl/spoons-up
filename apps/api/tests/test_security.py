from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.api.dependencies import get_current_user
from app.core.config import Settings
from app.core.errors import InvalidTokenError
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

SECRET = "unit-test-secret-that-is-at-least-32-characters"


def test_password_hash_and_verify() -> None:
    password = "correct horse battery staple"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("wrong password", password_hash)


def test_access_token_round_trip() -> None:
    token = create_access_token(42, SECRET, 15)

    assert decode_access_token(token, SECRET) == 42


def test_current_user_is_derived_without_database_lookup() -> None:
    token = create_access_token(42, SECRET, 15)
    settings = Settings(jwt_secret=SECRET)

    current_user = get_current_user(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
        settings,
    )

    assert current_user.id == 42


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        create_access_token(
            1,
            SECRET,
            15,
            now=datetime.now(UTC) - timedelta(minutes=16),
        ),
        jwt.encode(
            {
                "sub": "1",
                "iat": datetime.now(UTC),
                "exp": datetime.now(UTC) + timedelta(minutes=15),
                "type": "refresh",
            },
            SECRET,
            algorithm="HS256",
        ),
    ],
)
def test_invalid_access_tokens_are_rejected(token: str) -> None:
    with pytest.raises(InvalidTokenError):
        decode_access_token(token, SECRET)


def test_refresh_tokens_are_random_and_hash_deterministically() -> None:
    first = generate_refresh_token()
    second = generate_refresh_token()

    assert first != second
    assert hash_refresh_token(first) == hash_refresh_token(first)
    assert hash_refresh_token(first) != hash_refresh_token(second)
