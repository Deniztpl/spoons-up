from datetime import date

import pytest

from app.core.periods import get_week_start


@pytest.mark.parametrize(
    ("target_date", "week_start_day", "expected"),
    [
        (date(2026, 9, 24), 1, date(2026, 9, 21)),
        (date(2026, 9, 21), 1, date(2026, 9, 21)),
        (date(2026, 9, 20), 1, date(2026, 9, 14)),
        (date(2026, 9, 24), 7, date(2026, 9, 20)),
    ],
)
def test_get_week_start_uses_the_users_week_start_day(
    target_date: date,
    week_start_day: int,
    expected: date,
) -> None:
    assert get_week_start(target_date, week_start_day=week_start_day) == expected


@pytest.mark.parametrize("week_start_day", [0, 8])
def test_get_week_start_rejects_an_invalid_week_start_day(week_start_day: int) -> None:
    with pytest.raises(ValueError, match="week_start_day must be between 1 and 7"):
        get_week_start(date(2026, 9, 24), week_start_day=week_start_day)
