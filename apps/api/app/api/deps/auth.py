from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config.auth import auth_settings
from app.core.errors import InvalidTokenError
from app.core.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False, scheme_name="BearerAuth")


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: int


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise InvalidTokenError
    user_id = decode_access_token(
        credentials.credentials,
        auth_settings.jwt_secret.get_secret_value(),
    )
    return CurrentUser(id=user_id)


CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]
