from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

import jwt
from pwdlib import PasswordHash

from app.core.errors import InvalidTokenError

JWT_ALGORITHM = "HS256"
_password_hash = PasswordHash.recommended()
_dummy_password_hash = _password_hash.hash("not-a-real-user-password")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def verify_password_for_missing_user(password: str) -> None:
    _password_hash.verify(password, _dummy_password_hash)


def create_access_token(
    user_id: int,
    secret: str,
    lifetime_minutes: int,
    *,
    now: datetime | None = None,
) -> str:
    issued_at = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=lifetime_minutes),
        "type": "access",
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, secret: str) -> int:
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "iat", "exp", "type"]},
        )
        if payload["type"] != "access":
            raise InvalidTokenError
        user_id = int(payload["sub"])
        if user_id < 1:
            raise InvalidTokenError
        return user_id
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise InvalidTokenError from exc


def generate_refresh_token() -> str:
    return token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()
