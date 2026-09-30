from typing import Annotated

from fastapi import Depends

from app.api.deps.db import DatabaseSession
from app.repositories.areas import AreaRepository
from app.repositories.goals import GoalRepository
from app.repositories.habits import HabitRepository
from app.repositories.period_results import PeriodResultRepository
from app.repositories.refresh_tokens import RefreshTokenRepository
from app.repositories.tasks import TaskRepository
from app.repositories.users import UserRepository
from app.services.areas import AreaService
from app.services.auth import AuthService
from app.services.goals import GoalService
from app.services.habits import HabitService
from app.services.journal import JournalService
from app.services.results import ResultsService
from app.services.tasks import TaskService
from app.services.today import TodayService
from app.services.user_activity import UserActivityService
from app.services.week import WeekService


def get_auth_service(session: DatabaseSession) -> AuthService:
    return AuthService(
        session,
        UserRepository(session),
        RefreshTokenRepository(session),
    )


AuthServiceDependency = Annotated[AuthService, Depends(get_auth_service)]


def get_task_service(session: DatabaseSession) -> TaskService:
    return TaskService(
        session,
        TaskRepository(session),
        GoalRepository(session),
        UserRepository(session),
    )


TaskServiceDependency = Annotated[TaskService, Depends(get_task_service)]


def get_area_service(
    session: DatabaseSession,
    task_service: TaskServiceDependency,
) -> AreaService:
    return AreaService(
        session,
        AreaRepository(session),
        UserRepository(session),
        task_service,
    )


AreaServiceDependency = Annotated[AreaService, Depends(get_area_service)]


def get_goal_service(
    session: DatabaseSession,
    task_service: TaskServiceDependency,
) -> GoalService:
    user_repository = UserRepository(session)
    return GoalService(
        session,
        GoalRepository(session),
        AreaRepository(session),
        user_repository,
        task_service,
    )


GoalServiceDependency = Annotated[GoalService, Depends(get_goal_service)]


def get_user_activity_service(
    session: DatabaseSession,
    task_service: TaskServiceDependency,
) -> UserActivityService:
    return UserActivityService(
        session,
        UserRepository(session),
        task_service,
    )


UserActivityServiceDependency = Annotated[
    UserActivityService,
    Depends(get_user_activity_service),
]


def get_habit_service(session: DatabaseSession) -> HabitService:
    return HabitService(
        session,
        HabitRepository(session),
        AreaRepository(session),
        UserRepository(session),
    )


HabitServiceDependency = Annotated[HabitService, Depends(get_habit_service)]


def get_journal_service(session: DatabaseSession) -> JournalService:
    return JournalService(
        session,
        TaskRepository(session),
        UserRepository(session),
    )


JournalServiceDependency = Annotated[JournalService, Depends(get_journal_service)]


def get_today_service(session: DatabaseSession) -> TodayService:
    return TodayService(
        session,
        HabitRepository(session),
        TaskRepository(session),
        UserRepository(session),
    )


TodayServiceDependency = Annotated[TodayService, Depends(get_today_service)]


def get_week_service(session: DatabaseSession) -> WeekService:
    return WeekService(
        session,
        TaskRepository(session),
        UserRepository(session),
    )


WeekServiceDependency = Annotated[WeekService, Depends(get_week_service)]


def get_results_service(session: DatabaseSession) -> ResultsService:
    return ResultsService(
        session,
        AreaRepository(session),
        GoalRepository(session),
        HabitRepository(session),
        PeriodResultRepository(session),
        TaskRepository(session),
        UserRepository(session),
    )


ResultsServiceDependency = Annotated[ResultsService, Depends(get_results_service)]
