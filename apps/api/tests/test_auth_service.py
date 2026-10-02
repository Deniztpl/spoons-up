from unittest.mock import Mock

import pytest
from sqlalchemy.orm import Session

from app.core.config.app import settings
from app.core.errors import RegistrationClosedError, TooManyAttemptsError
from app.repositories.refresh_tokens import RefreshTokenRepository
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth import AuthService
from app.services.login_attempts import LoginAttemptLimiter


def test_registration_switch_stops_before_database_or_password_work(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    users = Mock(spec=UserRepository)
    refresh_tokens = Mock(spec=RefreshTokenRepository)
    service = AuthService(session, users, refresh_tokens, LoginAttemptLimiter())
    payload = RegisterRequest(
        email="deniz@example.com",
        password="password123",
        timezone="Europe/Istanbul",
    )
    monkeypatch.setattr(settings, "registration_enabled", False)

    with pytest.raises(RegistrationClosedError):
        service.register(payload)

    assert session.mock_calls == []
    assert users.mock_calls == []
    assert refresh_tokens.mock_calls == []


def test_login_limit_stops_before_database_or_password_work() -> None:
    session = Mock(spec=Session)
    users = Mock(spec=UserRepository)
    refresh_tokens = Mock(spec=RefreshTokenRepository)
    limiter = Mock(spec=LoginAttemptLimiter)
    limiter.begin_attempt.side_effect = TooManyAttemptsError
    service = AuthService(session, users, refresh_tokens, limiter)
    payload = LoginRequest(email="DENIZ@example.com", password="password123")

    with pytest.raises(TooManyAttemptsError):
        service.login(payload)

    limiter.begin_attempt.assert_called_once_with("deniz@example.com")
    assert session.mock_calls == []
    assert users.mock_calls == []
    assert refresh_tokens.mock_calls == []
