import pytest
from pydantic import ValidationError

from app.core.config.auth import AuthSettings


def test_jwt_secret_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET")

    with pytest.raises(ValidationError):
        AuthSettings(_env_file=None)


def test_jwt_secret_must_have_at_least_32_characters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("JWT_SECRET", "too-short")

    with pytest.raises(ValidationError):
        AuthSettings(_env_file=None)
