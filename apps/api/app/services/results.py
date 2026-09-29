from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import NamedTuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.periods import get_week_start
from app.models import (
    Area,
    Goal,
    Habit,
    HabitMode,
    HabitPeriodType,
    PeriodResult,
    RequirementType,
    User,
)
from app.repositories.areas import AreaRepository
from app.repositories.goals import GoalRepository
from app.repositories.habits import HabitRepository
from app.repositories.period_results import PeriodResultRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.schemas.results import (
    AreaResultResponse,
    GrowthResponse,
    GrowthWeekResponse,
    ProgressResponse,
    RequirementResponse,
    ResultDayResponse,
)

GROWTH_DEFAULT_WEEKS = 8
GROWTH_MAX_WEEKS = 52


class _Requirement(NamedTuple):
    ref_type: RequirementType
    ref_id: int
    title: str
    target: int
    done: Decimal


class ResultsService:
    def __init__(
        self,
        session: Session,
        area_repository: AreaRepository,
        goal_repository: GoalRepository,
        habit_repository: HabitRepository,
        period_result_repository: PeriodResultRepository,
        task_repository: TaskRepository,
        user_repository: UserRepository,
    ) -> None:
        self.session = session
        self.area_repository = area_repository
        self.goal_repository = goal_repository
        self.habit_repository = habit_repository
        self.period_result_repository = period_result_repository
        self.task_repository = task_repository
        self.user_repository = user_repository

    def get_progress(self, *, user_id: int) -> ProgressResponse:
        with self.session.begin():
            user = self._get_user(user_id=user_id)
            timezone = ZoneInfo(user.timezone)
            today = datetime.now(timezone).date()
            days = _week_days(get_week_start(today, week_start_day=user.week_start_day))
            done_blocks = self.task_repository.sum_done_blocks_by_goal(
                user_id=user_id,
                period_start=days[0],
            )
            checked_days, checked_weeks = self._habit_checks(user_id=user_id, week_start=days[0])
            goals_by_area = _group_by_area(
                self.goal_repository.list_for_user(user_id=user_id, area_id=None)
            )
            habits_by_area = _group_by_area(
                self.habit_repository.list_for_user(user_id=user_id, area_id=None)
            )

            results: list[tuple[AreaResultResponse, Decimal]] = []
            for area in self.area_repository.list_for_user(
                user_id=user_id,
                include_archived=False,
            ):
                habits = habits_by_area[area.id]
                requirements = _requirements(
                    area=area,
                    goals=goals_by_area[area.id],
                    habits=habits,
                    days=days,
                    timezone=timezone,
                    done_blocks=done_blocks,
                    checked_days=checked_days,
                    checked_weeks=checked_weeks,
                )
                if requirements:
                    results.append(
                        _area_result(
                            area=area,
                            requirements=requirements,
                            daily_spans=_daily_spans(
                                area=area,
                                habits=habits,
                                days=days,
                                timezone=timezone,
                            ),
                            days=days,
                            checked_days=checked_days,
                        )
                    )

            response = ProgressResponse(
                period_start=days[0],
                period_end=days[-1],
                percent=_week_percent(results),
                areas=[area for area, _ in results],
            )
        return response

    def get_growth(self, *, user_id: int, weeks: int) -> GrowthResponse:
        with self.session.begin():
            user = self._get_user(user_id=user_id)
            timezone = ZoneInfo(user.timezone)
            today = datetime.now(timezone).date()
            last_closed = get_week_start(today, week_start_day=user.week_start_day) - timedelta(
                days=7
            )
            week_starts = [last_closed - timedelta(weeks=offset) for offset in range(weeks)]
            rows_by_area_week: defaultdict[tuple[date, int], list[PeriodResult]] = defaultdict(list)
            for row in self.period_result_repository.list_for_user(
                user_id=user_id,
                from_period_start=week_starts[-1],
                to_period_start=last_closed,
            ):
                if row.area_id is not None:
                    rows_by_area_week[(row.period_start, row.area_id)].append(row)
            areas = self.area_repository.list_for_user(user_id=user_id, include_archived=False)
            habits_by_area = _group_by_area(
                self.habit_repository.list_for_user(user_id=user_id, area_id=None)
            )

            growth_weeks: list[GrowthWeekResponse] = []
            for week_start in week_starts:
                days = _week_days(week_start)
                week_areas = [
                    (area, rows_by_area_week[(week_start, area.id)])
                    for area in areas
                    if (week_start, area.id) in rows_by_area_week
                ]
                checked_days = (
                    self._habit_checks(user_id=user_id, week_start=week_start)[0]
                    if week_areas
                    else defaultdict(set)
                )
                results = [
                    _area_result(
                        area=area,
                        requirements=[
                            _Requirement(
                                ref_type=RequirementType(row.ref_type),
                                ref_id=row.ref_id,
                                title=row.title,
                                target=row.target,
                                done=row.done,
                            )
                            for row in rows
                        ],
                        daily_spans=_daily_spans(
                            area=area,
                            habits=habits_by_area[area.id],
                            days=days,
                            timezone=timezone,
                        ),
                        days=days,
                        checked_days=checked_days,
                    )
                    for area, rows in week_areas
                ]
                growth_weeks.append(
                    GrowthWeekResponse(
                        period_start=days[0],
                        period_end=days[-1],
                        percent=_week_percent(results),
                        areas=[area for area, _ in results],
                    )
                )

            response = GrowthResponse(weeks=growth_weeks)
        return response

    def freeze_closed_weeks(self, *, user: User, today: date) -> None:
        """Snapshot the user's closed weeks not frozen yet, inside the caller's transaction."""
        timezone = ZoneInfo(user.timezone)
        last_closed = get_week_start(today, week_start_day=user.week_start_day) - timedelta(days=7)
        if user.last_frozen_week is not None:
            week_start = user.last_frozen_week + timedelta(days=7)
        else:
            # A first run reaches back to the signup week, as far as Growth can show.
            signup_week = get_week_start(
                _local_date(user.created_at, timezone),
                week_start_day=user.week_start_day,
            )
            week_start = max(signup_week, last_closed - timedelta(weeks=GROWTH_MAX_WEEKS - 1))
        if week_start > last_closed:
            return

        areas = self.area_repository.list_for_user(user_id=user.id, include_archived=True)
        goals_by_area = _group_by_area(self.goal_repository.list_all_for_user(user_id=user.id))
        habits_by_area = _group_by_area(self.habit_repository.list_all_for_user(user_id=user.id))
        values: list[dict[str, object]] = []
        while week_start <= last_closed:
            done_blocks = self.task_repository.sum_done_blocks_by_goal(
                user_id=user.id,
                period_start=week_start,
            )
            checked_days, checked_weeks = self._habit_checks(user_id=user.id, week_start=week_start)
            for area in areas:
                for requirement in _requirements(
                    area=area,
                    goals=goals_by_area[area.id],
                    habits=habits_by_area[area.id],
                    days=_week_days(week_start),
                    timezone=timezone,
                    done_blocks=done_blocks,
                    checked_days=checked_days,
                    checked_weeks=checked_weeks,
                ):
                    values.append(
                        {
                            "user_id": user.id,
                            "area_id": area.id,
                            "period_start": week_start,
                            "ref_type": requirement.ref_type.value,
                            "ref_id": requirement.ref_id,
                            "title": requirement.title,
                            "target": requirement.target,
                            "done": requirement.done,
                        }
                    )
            week_start += timedelta(days=7)

        self.period_result_repository.add_results(values=values)
        self.user_repository.set_last_frozen_week(user=user, week_start=last_closed)

    def _habit_checks(
        self,
        *,
        user_id: int,
        week_start: date,
    ) -> tuple[defaultdict[int, set[date]], set[int]]:
        """Days each daily habit was checked, and the weekly habits checked that week."""
        checked_days: defaultdict[int, set[date]] = defaultdict(set)
        checked_weeks: set[int] = set()
        for entry in self.habit_repository.list_entries_for_week(
            user_id=user_id,
            week_start=week_start,
            week_end=week_start + timedelta(days=6),
        ):
            if entry.period_type == HabitPeriodType.DAY.value:
                checked_days[entry.habit_id].add(entry.period_start)
            else:
                checked_weeks.add(entry.habit_id)
        return checked_days, checked_weeks

    def _get_user(self, *, user_id: int) -> User:
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError
        return user


def _requirements(
    *,
    area: Area,
    goals: list[Goal],
    habits: list[Habit],
    days: list[date],
    timezone: ZoneInfo,
    done_blocks: dict[int, Decimal],
    checked_days: defaultdict[int, set[date]],
    checked_weeks: set[int],
) -> list[_Requirement]:
    """The area's requirements for one week, each judged on the days it was active."""
    requirements: list[_Requirement] = []
    for goal in goals:
        span = _active_span(area=area, created_at=goal.created_at, days=days, timezone=timezone)
        if goal.weekly_target is None or span is None:
            continue
        requirements.append(
            _Requirement(
                ref_type=RequirementType.GOAL,
                ref_id=goal.id,
                title=goal.title,
                target=goal.weekly_target,
                done=done_blocks.get(goal.id, Decimal(0)),
            )
        )

    for habit in habits:
        span = _active_span(area=area, created_at=habit.created_at, days=days, timezone=timezone)
        if span is None:
            continue
        if habit.mode == HabitMode.DAILY.value:
            active_days = [day for day in days if span[0] <= day <= span[1]]
            target = len(active_days)
            done = Decimal(len(checked_days[habit.id].intersection(active_days)))
        else:
            target = 1
            done = Decimal(1 if habit.id in checked_weeks else 0)
        requirements.append(
            _Requirement(
                ref_type=RequirementType.HABIT,
                ref_id=habit.id,
                title=habit.title,
                target=target,
                done=done,
            )
        )
    return requirements


def _active_span(
    *,
    area: Area,
    created_at: datetime,
    days: list[date],
    timezone: ZoneInfo,
) -> tuple[date, date] | None:
    """The part of the week a requirement counted: once it and its area were in, until archived."""
    start = max(days[0], _local_date(created_at, timezone))
    if area.unarchived_at is not None:
        start = max(start, _local_date(area.unarchived_at, timezone))
    end = days[-1]
    if area.archived_at is not None:
        end = min(end, _local_date(area.archived_at, timezone))
    return (start, end) if start <= end else None


def _daily_spans(
    *,
    area: Area,
    habits: list[Habit],
    days: list[date],
    timezone: ZoneInfo,
) -> list[tuple[int, date, date]]:
    spans: list[tuple[int, date, date]] = []
    for habit in habits:
        if habit.mode != HabitMode.DAILY.value:
            continue
        span = _active_span(area=area, created_at=habit.created_at, days=days, timezone=timezone)
        if span is not None:
            spans.append((habit.id, span[0], span[1]))
    return spans


def _area_result(
    *,
    area: Area,
    requirements: list[_Requirement],
    daily_spans: list[tuple[int, date, date]],
    days: list[date],
    checked_days: defaultdict[int, set[date]],
) -> tuple[AreaResultResponse, Decimal]:
    ratio = _average([_ratio(item.done, item.target) for item in requirements])
    return (
        AreaResultResponse(
            area_id=str(area.id),
            name=area.name,
            percent=_percent(ratio),
            days=[
                ResultDayResponse(
                    date=day,
                    done=_is_day_done(day, daily_spans=daily_spans, checked_days=checked_days),
                )
                for day in days
            ],
            requirements=[
                RequirementResponse(
                    ref_type=item.ref_type.value,
                    ref_id=str(item.ref_id),
                    title=item.title,
                    target=item.target,
                    done=float(item.done),
                )
                for item in requirements
            ],
        ),
        ratio,
    )


def _is_day_done(
    day: date,
    *,
    daily_spans: list[tuple[int, date, date]],
    checked_days: defaultdict[int, set[date]],
) -> bool:
    """A day is done when the area had a daily habit that day and every one was checked."""
    active = [habit_id for habit_id, start, end in daily_spans if start <= day <= end]
    return bool(active) and all(day in checked_days[habit_id] for habit_id in active)


def _week_percent(results: list[tuple[AreaResultResponse, Decimal]]) -> int | None:
    return _percent(_average([ratio for _, ratio in results])) if results else None


def _group_by_area[T: (Goal, Habit)](items: list[T]) -> defaultdict[int, list[T]]:
    grouped: defaultdict[int, list[T]] = defaultdict(list)
    for item in items:
        grouped[item.area_id].append(item)
    return grouped


def _week_days(week_start: date) -> list[date]:
    return [week_start + timedelta(days=offset) for offset in range(7)]


def _local_date(value: datetime, timezone: ZoneInfo) -> date:
    return value.astimezone(timezone).date()


def _ratio(done: Decimal, target: int) -> Decimal:
    """A requirement's share of its target, capped so going over does not hide the others."""
    return min(done / target, Decimal(1))


def _average(values: list[Decimal]) -> Decimal:
    return sum(values, Decimal(0)) / len(values)


def _percent(ratio: Decimal) -> int:
    return int((ratio * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
