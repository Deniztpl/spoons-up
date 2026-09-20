from typing import Annotated

from fastapi import Depends

from app.api.deps.db import DatabaseSession
from app.repositories.refresh_tokens import RefreshTokenRepository
from app.repositories.users import UserRepository
from app.services.auth import AuthService


def get_auth_service(session: DatabaseSession) -> AuthService:
    return AuthService(
        session,
        UserRepository(session),
        RefreshTokenRepository(session),
    )


AuthServiceDependency = Annotated[AuthService, Depends(get_auth_service)]
