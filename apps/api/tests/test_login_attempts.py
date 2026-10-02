from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from app.core.errors import TooManyAttemptsError
from app.services.login_attempts import (
    ATTEMPT_WINDOW_SECONDS,
    MAX_FAILED_ATTEMPTS,
    LoginAttemptLimiter,
)


class MutableClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_limiter_rejects_the_attempt_after_five_failures() -> None:
    limiter = LoginAttemptLimiter()

    for _ in range(MAX_FAILED_ATTEMPTS):
        limiter.begin_attempt("deniz@example.com")

    with pytest.raises(TooManyAttemptsError):
        limiter.begin_attempt("deniz@example.com")


def test_limiter_clear_resets_failures_and_keeps_emails_independent() -> None:
    limiter = LoginAttemptLimiter()
    for _ in range(MAX_FAILED_ATTEMPTS):
        limiter.begin_attempt("first@example.com")

    limiter.begin_attempt("second@example.com")
    limiter.clear("first@example.com")
    limiter.begin_attempt("first@example.com")


def test_limiter_expires_failures_and_lockout_after_fifteen_minutes() -> None:
    clock = MutableClock()
    limiter = LoginAttemptLimiter(clock=clock)
    for _ in range(MAX_FAILED_ATTEMPTS):
        limiter.begin_attempt("deniz@example.com")

    with pytest.raises(TooManyAttemptsError):
        limiter.begin_attempt("deniz@example.com")

    clock.now += ATTEMPT_WINDOW_SECONDS
    limiter.begin_attempt("deniz@example.com")


def test_limiter_allows_only_five_concurrent_attempts() -> None:
    limiter = LoginAttemptLimiter()
    concurrent_attempts = 40
    start = Barrier(concurrent_attempts)

    def begin_attempt() -> bool:
        start.wait()
        try:
            limiter.begin_attempt("deniz@example.com")
        except TooManyAttemptsError:
            return False
        return True

    with ThreadPoolExecutor(max_workers=concurrent_attempts) as executor:
        allowed = list(executor.map(lambda _index: begin_attempt(), range(concurrent_attempts)))

    assert sum(allowed) == MAX_FAILED_ATTEMPTS
