from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AlreadyCheckedError, NotFoundError
from app.core.periods import get_week_start
from app.models import Habit, HabitMode, HabitPeriodType, User
from app.repositories.areas import AreaRepository
from app.repositories.habits import HabitRepository
from app.repositories.users import UserRepository
from app.schemas.habits import (
    CheckHabitRequest,
    CreateHabitRequest,
    HabitEntryResponse,
    HabitListResponse,
    HabitResponse,
    UpdateHabitRequest,
)


class HabitService:
    def __init__(
        self,
        session: Session,
        habit_repository: HabitRepository,
        area_repository: AreaRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.habit_repository = habit_repository
        self.area_repository = area_repository
        self.user_repository = user_repository

    def list(self, *, user_id: int, area_id: int | None) -> HabitListResponse:
        with self.session.begin():
            habits = self.habit_repository.list_for_user(user_id=user_id, area_id=area_id)
            response = HabitListResponse(
                habits=[HabitResponse.model_validate(habit) for habit in habits]
            )
        return response

    def create(self, payload: CreateHabitRequest, *, user_id: int) -> HabitResponse:
        with self.session.begin():
            area_id = int(payload.area_id)
            self._get_owned_area(area_id=area_id, user_id=user_id)
            habit = self.habit_repository.create(
                user_id=user_id,
                area_id=area_id,
                title=payload.title,
                mode=payload.mode,
            )
            response = HabitResponse.model_validate(habit)
        return response

    def update(
        self,
        payload: UpdateHabitRequest,
        *,
        habit_id: int,
        user_id: int,
    ) -> HabitResponse:
        with self.session.begin():
            habit = self._get_owned_habit(habit_id=habit_id, user_id=user_id)
            area_id = int(payload.area_id) if payload.area_id is not None else None
            if area_id is not None:
                self._get_owned_area(area_id=area_id, user_id=user_id)
            self.habit_repository.update(
                habit=habit,
                area_id=area_id,
                title=payload.title,
                mode=payload.mode,
            )
            response = HabitResponse.model_validate(habit)
        return response

    def delete(self, *, habit_id: int, user_id: int) -> None:
        with self.session.begin():
            habit = self._get_owned_habit(habit_id=habit_id, user_id=user_id)
            self.habit_repository.delete(habit=habit)

    def check(
        self,
        payload: CheckHabitRequest,
        *,
        habit_id: int,
        user_id: int,
    ) -> HabitEntryResponse:
        try:
            with self.session.begin():
                habit = self._get_owned_habit(habit_id=habit_id, user_id=user_id)
                user = self._get_user(user_id=user_id)
                period_type, period_start = self._get_period_for_date(
                    mode=habit.mode,
                    target_date=payload.date,
                    week_start_day=user.week_start_day,
                )
                entry = self.habit_repository.create_entry(
                    habit_id=habit.id,
                    period_type=period_type,
                    period_start=period_start,
                )
                response = HabitEntryResponse.model_validate(entry)
        except IntegrityError as exc:
            raise AlreadyCheckedError from exc
        return response

    def uncheck(
        self,
        *,
        habit_id: int,
        user_id: int,
        target_date: date,
    ) -> None:
        with self.session.begin():
            habit = self._get_owned_habit(habit_id=habit_id, user_id=user_id)
            user = self._get_user(user_id=user_id)
            period_type, period_start = self._get_period_for_date(
                mode=habit.mode,
                target_date=target_date,
                week_start_day=user.week_start_day,
            )
            self.habit_repository.delete_entry(
                habit_id=habit.id,
                period_type=period_type,
                period_start=period_start,
            )

    @staticmethod
    def _get_period_for_date(
        *,
        mode: str,
        target_date: date,
        week_start_day: int,
    ) -> tuple[HabitPeriodType, date]:
        if HabitMode(mode) == HabitMode.DAILY:
            return HabitPeriodType.DAY, target_date
        return HabitPeriodType.WEEK, get_week_start(
            target_date,
            week_start_day=week_start_day,
        )

    def _get_owned_habit(self, *, habit_id: int, user_id: int) -> Habit:
        habit = self.habit_repository.get_for_user(habit_id=habit_id, user_id=user_id)
        if habit is None:
            raise NotFoundError
        return habit

    def _get_owned_area(self, *, area_id: int, user_id: int) -> None:
        if self.area_repository.get_for_user(area_id=area_id, user_id=user_id) is None:
            raise NotFoundError

    def _get_user(self, *, user_id: int) -> User:
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError
        return user
