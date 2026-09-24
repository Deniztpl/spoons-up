from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Habit, HabitEntry, HabitMode, HabitPeriodType


class HabitRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(self, *, user_id: int, area_id: int | None) -> list[Habit]:
        statement = select(Habit).where(Habit.user_id == user_id)
        if area_id is not None:
            statement = statement.where(Habit.area_id == area_id)
        return list(self.session.scalars(statement.order_by(Habit.created_at, Habit.id)))

    def get_for_user(self, *, habit_id: int, user_id: int) -> Habit | None:
        return self.session.scalar(
            select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id)
        )

    def create(
        self,
        *,
        user_id: int,
        area_id: int,
        title: str,
        mode: HabitMode,
    ) -> Habit:
        habit = Habit(
            user_id=user_id,
            area_id=area_id,
            title=title,
            mode=mode.value,
        )
        self.session.add(habit)
        self.session.flush()
        return habit

    def update(
        self,
        *,
        habit: Habit,
        area_id: int | None,
        title: str | None,
        mode: HabitMode | None,
    ) -> Habit:
        if area_id is not None:
            habit.area_id = area_id
        if title is not None:
            habit.title = title
        if mode is not None:
            habit.mode = mode.value
        self.session.flush()
        return habit

    def delete(self, *, habit: Habit) -> None:
        self.session.delete(habit)

    def create_entry(
        self,
        *,
        habit_id: int,
        period_type: HabitPeriodType,
        period_start: date,
    ) -> HabitEntry:
        entry = HabitEntry(
            habit_id=habit_id,
            period_type=period_type.value,
            period_start=period_start,
        )
        self.session.add(entry)
        self.session.flush()
        return entry

    def delete_entry(
        self,
        *,
        habit_id: int,
        period_type: HabitPeriodType,
        period_start: date,
    ) -> None:
        entry = self.session.scalar(
            select(HabitEntry).where(
                HabitEntry.habit_id == habit_id,
                HabitEntry.period_type == period_type.value,
                HabitEntry.period_start == period_start,
            )
        )
        if entry is not None:
            self.session.delete(entry)
