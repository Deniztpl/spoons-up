import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from threading import Lock

from app.core.errors import TooManyAttemptsError

MAX_FAILED_ATTEMPTS = 5
ATTEMPT_WINDOW_SECONDS = 15 * 60


@dataclass(slots=True)
class _LoginAttemptState:
    attempts: deque[float] = field(default_factory=deque)
    locked_until: float | None = None


class LoginAttemptLimiter:
    def __init__(self, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._states: dict[str, _LoginAttemptState] = {}
        self._lock = Lock()

    def begin_attempt(self, email: str) -> None:
        with self._lock:
            now = self._clock()
            self._remove_expired(now)
            state = self._states.setdefault(email, _LoginAttemptState())
            if state.locked_until is not None:
                raise TooManyAttemptsError

            state.attempts.append(now)
            if len(state.attempts) >= MAX_FAILED_ATTEMPTS:
                state.locked_until = now + ATTEMPT_WINDOW_SECONDS

    def clear(self, email: str) -> None:
        with self._lock:
            self._states.pop(email, None)

    def clear_all(self) -> None:
        with self._lock:
            self._states.clear()

    def _remove_expired(self, now: float) -> None:
        cutoff = now - ATTEMPT_WINDOW_SECONDS
        expired_emails: list[str] = []

        for email, state in self._states.items():
            while state.attempts and state.attempts[0] <= cutoff:
                state.attempts.popleft()
            if state.locked_until is not None and state.locked_until <= now:
                state.locked_until = None
            if not state.attempts and state.locked_until is None:
                expired_emails.append(email)

        for email in expired_emails:
            del self._states[email]


login_attempt_limiter = LoginAttemptLimiter()
