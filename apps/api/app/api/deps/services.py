from typing import Annotated

from fastapi import Depends

from app.api.deps.db import DatabaseSession
from app.repositories.areas import AreaRepository
from app.repositories.habits import HabitRepository
from app.repositories.refresh_tokens import RefreshTokenRepository
from app.repositories.users import UserRepository
from app.services.areas import AreaService
from app.services.auth import AuthService
from app.services.habits import HabitService


def get_auth_service(session: DatabaseSession) -> AuthService:
    return AuthService(
        session,
        UserRepository(session),
        RefreshTokenRepository(session),
    )


AuthServiceDependency = Annotated[AuthService, Depends(get_auth_service)]


def get_area_service(session: DatabaseSession) -> AreaService:
    return AreaService(session, AreaRepository(session))


AreaServiceDependency = Annotated[AreaService, Depends(get_area_service)]


def get_habit_service(session: DatabaseSession) -> HabitService:
    return HabitService(
        session,
        HabitRepository(session),
        AreaRepository(session),
        UserRepository(session),
    )


HabitServiceDependency = Annotated[HabitService, Depends(get_habit_service)]
