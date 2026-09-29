from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.periods import get_week_end, get_week_start
from app.models import Area, Goal, Habit, HabitMode, HabitPeriodType
from app.repositories.areas import AreaRepository
from app.repositories.goals import GoalRepository
from app.repositories.habits import HabitRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.results import (
    AreaProgressResponse,
    ProgressDayResponse,
    ProgressResponse,
    RequirementResponse,
)


class ResultsService:
    def __init__(
        self,
        session: Session,
        area_repository: AreaRepository,
        goal_repository: GoalRepository,
        habit_repository: HabitRepository,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.area_repository = area_repository
        self.goal_repository = goal_repository
        self.habit_repository = habit_repository
        self.task_repository = task_repository
        self.user_repository = user_repository

    def get_progress(self, *, user_id: int) -> ProgressResponse:
        with self.session.begin():
            user = self.user_repository.get_by_id(user_id)
            if user is None:
                raise NotFoundError

            timezone = ZoneInfo(user.timezone)
            today = datetime.now(timezone).date()
            week_start = get_week_start(today, week_start_day=user.week_start_day)
            week_end = get_week_end(today, week_start_day=user.week_start_day)
            days = [week_start + timedelta(days=offset) for offset in range(7)]

            goals_by_area: defaultdict[int, list[Goal]] = defaultdict(list)
            for goal in self.goal_repository.list_for_user(user_id=user_id, area_id=None):
                goals_by_area[goal.area_id].append(goal)
            habits_by_area: defaultdict[int, list[Habit]] = defaultdict(list)
            for habit in self.habit_repository.list_for_user(user_id=user_id, area_id=None):
                habits_by_area[habit.area_id].append(habit)
            done_blocks = self.task_repository.sum_done_blocks_by_goal(
                user_id=user_id,
                period_start=week_start,
            )
            checked_days: defaultdict[int, set[date]] = defaultdict(set)
            checked_weeks: set[int] = set()
            for entry in self.habit_repository.list_entries_for_week(
                user_id=user_id,
                week_start=week_start,
                week_end=week_end,
            ):
                if entry.period_type == HabitPeriodType.DAY.value:
                    checked_days[entry.habit_id].add(entry.period_start)
                else:
                    checked_weeks.add(entry.habit_id)

            area_responses: list[AreaProgressResponse] = []
            area_ratios: list[Decimal] = []
            for area in self.area_repository.list_for_user(
                user_id=user_id,
                include_archived=False,
            ):
                progress = self._area_progress(
                    area=area,
                    goals=goals_by_area[area.id],
                    habits=habits_by_area[area.id],
                    days=days,
                    timezone=timezone,
                    done_blocks=done_blocks,
                    checked_days=checked_days,
                    checked_weeks=checked_weeks,
                )
                if progress is not None:
                    area_responses.append(progress[0])
                    area_ratios.append(progress[1])

            response = ProgressResponse(
                period_start=week_start,
                period_end=week_end,
                percent=_percent(_average(area_ratios)) if area_ratios else None,
                areas=area_responses,
            )
        return response

    @staticmethod
    def _area_progress(
        *,
        area: Area,
        goals: list[Goal],
        habits: list[Habit],
        days: list[date],
        timezone: ZoneInfo,
        done_blocks: dict[int, Decimal],
        checked_days: defaultdict[int, set[date]],
        checked_weeks: set[int],
    ) -> tuple[AreaProgressResponse, Decimal] | None:
        """Build one area's week, or None when nothing in it was active that week."""
        week_end = days[-1]
        # An area restored during the week counts from the day it came back.
        area_start = days[0]
        if area.unarchived_at is not None:
            area_start = max(area_start, _local_date(area.unarchived_at, timezone))

        requirements: list[RequirementResponse] = []
        ratios: list[Decimal] = []
        for goal in goals:
            starts = max(area_start, _local_date(goal.created_at, timezone))
            if goal.weekly_target is None or starts > week_end:
                continue
            done = done_blocks.get(goal.id, Decimal(0))
            requirements.append(
                RequirementResponse(
                    ref_type="GOAL",
                    ref_id=str(goal.id),
                    title=goal.title,
                    target=goal.weekly_target,
                    done=float(done),
                )
            )
            ratios.append(_ratio(done, goal.weekly_target))

        daily_starts: list[tuple[int, date]] = []
        for habit in habits:
            starts = max(area_start, _local_date(habit.created_at, timezone))
            if starts > week_end:
                continue
            if habit.mode == HabitMode.DAILY.value:
                active_days = [day for day in days if day >= starts]
                target = len(active_days)
                habit_done = len(checked_days[habit.id].intersection(active_days))
                daily_starts.append((habit.id, starts))
            else:
                target = 1
                habit_done = 1 if habit.id in checked_weeks else 0
            requirements.append(
                RequirementResponse(
                    ref_type="HABIT",
                    ref_id=str(habit.id),
                    title=habit.title,
                    target=target,
                    done=habit_done,
                )
            )
            ratios.append(_ratio(Decimal(habit_done), target))

        if not requirements:
            return None

        ratio = _average(ratios)
        return (
            AreaProgressResponse(
                area_id=str(area.id),
                name=area.name,
                percent=_percent(ratio),
                days=[
                    ProgressDayResponse(
                        date=day,
                        done=_is_day_done(
                            day,
                            daily_starts=daily_starts,
                            checked_days=checked_days,
                        ),
                    )
                    for day in days
                ],
                requirements=requirements,
            ),
            ratio,
        )


def _local_date(value: datetime, timezone: ZoneInfo) -> date:
    return value.astimezone(timezone).date()


def _ratio(done: Decimal, target: int) -> Decimal:
    """A requirement's share of its target, capped so going over does not hide the others."""
    return min(done / target, Decimal(1))


def _average(values: list[Decimal]) -> Decimal:
    return sum(values, Decimal(0)) / len(values)


def _percent(ratio: Decimal) -> int:
    return int((ratio * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _is_day_done(
    day: date,
    *,
    daily_starts: list[tuple[int, date]],
    checked_days: defaultdict[int, set[date]],
) -> bool:
    """A day is done when the area had a daily habit that day and every one was checked."""
    active = [habit_id for habit_id, starts in daily_starts if starts <= day]
    return bool(active) and all(day in checked_days[habit_id] for habit_id in active)
