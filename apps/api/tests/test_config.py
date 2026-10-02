import pytest
from pydantic import ValidationError

from app.core.config.app import AppSettings
from app.core.config.auth import AuthSettings

VALID_DATABASE_URL = "postgresql+psycopg://user:password@database.example/spoons"
VALID_CRON_SECRET = "cron-secret-that-is-at-least-32-characters"


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL")
    monkeypatch.setenv("CRON_SECRET", VALID_CRON_SECRET)

    with pytest.raises(ValidationError):
        AppSettings(_env_file=None)


@pytest.mark.parametrize("invalid_secret", ["", "too-short"])
def test_cron_secret_is_required_and_long_enough(
    monkeypatch: pytest.MonkeyPatch,
    invalid_secret: str,
) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_DATABASE_URL)
    monkeypatch.delenv("CRON_SECRET")

    with pytest.raises(ValidationError):
        AppSettings(_env_file=None)

    monkeypatch.setenv("CRON_SECRET", invalid_secret)

    with pytest.raises(ValidationError):
        AppSettings(_env_file=None)


def test_app_settings_have_environment_safe_defaults(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_DATABASE_URL)
    monkeypatch.setenv("CRON_SECRET", VALID_CRON_SECRET)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("ACTIVE_USER_DAYS", raising=False)
    monkeypatch.delenv("REGISTRATION_ENABLED", raising=False)

    app_settings = AppSettings(_env_file=None)

    assert app_settings.cors_origin_list == []
    assert app_settings.active_user_days == 30
    assert app_settings.registration_enabled is True


def test_app_settings_read_deployment_overrides(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_DATABASE_URL)
    monkeypatch.setenv("CRON_SECRET", VALID_CRON_SECRET)
    monkeypatch.setenv("CORS_ORIGINS", "https://one.example, https://two.example")
    monkeypatch.setenv("ACTIVE_USER_DAYS", "14")
    monkeypatch.setenv("REGISTRATION_ENABLED", "false")

    app_settings = AppSettings(_env_file=None)

    assert app_settings.database_url == VALID_DATABASE_URL
    assert app_settings.cron_secret.get_secret_value() == VALID_CRON_SECRET
    assert app_settings.cors_origin_list == [
        "https://one.example",
        "https://two.example",
    ]
    assert app_settings.active_user_days == 14
    assert app_settings.registration_enabled is False


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


def test_refresh_cookie_is_secure_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-that-is-at-least-32-characters")
    monkeypatch.delenv("REFRESH_COOKIE_SECURE", raising=False)

    secure_settings = AuthSettings(_env_file=None)

    assert secure_settings.refresh_cookie_secure is True


def test_auth_settings_read_deployment_overrides(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    jwt_secret = "deployment-jwt-secret-at-least-32-characters"
    monkeypatch.setenv("JWT_SECRET", jwt_secret)
    monkeypatch.setenv("ACCESS_TOKEN_MINUTES", "10")
    monkeypatch.setenv("REFRESH_TOKEN_DAYS", "20")
    monkeypatch.setenv("REFRESH_COOKIE_SECURE", "true")

    deployment_settings = AuthSettings(_env_file=None)

    assert deployment_settings.jwt_secret.get_secret_value() == jwt_secret
    assert deployment_settings.access_token_minutes == 10
    assert deployment_settings.refresh_token_days == 20
    assert deployment_settings.refresh_cookie_secure is True
