from datetime import date, timedelta


def get_week_start(target_date: date, *, week_start_day: int) -> date:
    if not 1 <= week_start_day <= 7:
        raise ValueError("week_start_day must be between 1 and 7")

    days_since_week_start = (target_date.isoweekday() - week_start_day) % 7
    return target_date - timedelta(days=days_since_week_start)
