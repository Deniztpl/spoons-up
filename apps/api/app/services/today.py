from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.periods import get_week_end, get_week_start
from app.models import HabitMode
from app.repositories.habits import HabitRepository
from app.repositories.users import UserRepository
from app.schemas.today import TodayHabitResponse, TodayResponse


class TodayService:
    def __init__(
        self,
        session: Session,
        habit_repository: HabitRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.habit_repository = habit_repository
        self.user_repository = user_repository

    def get(self, *, user_id: int, target_date: date | None) -> TodayResponse:
        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise NotFoundError

            resolved_date = target_date or datetime.now(ZoneInfo(user.timezone)).date()
            week_start = get_week_start(
                resolved_date,
                week_start_day=user.week_start_day,
            )
            week_end = get_week_end(
                resolved_date,
                week_start_day=user.week_start_day,
            )
            habits = self.habit_repository.list_for_today(
                user_id=user_id,
                target_date=resolved_date,
                week_start=week_start,
            )

            daily_habits: list[TodayHabitResponse] = []
            weekly_habits: list[TodayHabitResponse] = []
            for habit, done in habits:
                response = TodayHabitResponse(
                    id=str(habit.id),
                    area_id=str(habit.area_id),
                    title=habit.title,
                    done=done,
                )
                if habit.mode == HabitMode.DAILY.value:
                    daily_habits.append(response)
                else:
                    weekly_habits.append(response)

            return TodayResponse(
                date=resolved_date,
                week_start=week_start,
                week_end=week_end,
                daily_habits=daily_habits,
                weekly_habits=weekly_habits,
                tasks=[],
            )
