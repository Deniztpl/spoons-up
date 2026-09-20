from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from app.api.dependencies import CurrentUserDependency, DatabaseSession, SettingsDependency
from app.core.config import Settings
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.services.auth import AuthService, TokenPair

router = APIRouter(prefix="/auth", tags=["auth"])

AUTH_RESPONSES = {
    401: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ValidationErrorResponse},
}


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    responses=AUTH_RESPONSES,
)
def register(
    payload: RegisterRequest,
    response: Response,
    session: DatabaseSession,
    settings: SettingsDependency,
) -> TokenResponse:
    tokens = AuthService(session, settings).register(
        email=str(payload.email),
        password=payload.password,
        timezone=payload.timezone,
    )
    _set_refresh_cookie(response, tokens.refresh_token, settings)
    return _token_response(tokens)


@router.post(
    "/login",
    response_model=TokenResponse,
    responses=AUTH_RESPONSES,
)
def login(
    payload: LoginRequest,
    response: Response,
    session: DatabaseSession,
    settings: SettingsDependency,
) -> TokenResponse:
    tokens = AuthService(session, settings).login(
        email=str(payload.email),
        password=payload.password,
    )
    _set_refresh_cookie(response, tokens.refresh_token, settings)
    return _token_response(tokens)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses=AUTH_RESPONSES,
)
def refresh(
    response: Response,
    session: DatabaseSession,
    settings: SettingsDependency,
    payload: RefreshTokenRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> TokenResponse:
    token = payload.refresh_token if payload is not None else refresh_cookie
    tokens = AuthService(session, settings).refresh(token)
    _set_refresh_cookie(response, tokens.refresh_token, settings)
    return _token_response(tokens)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses={401: {"model": ErrorResponse}, 422: {"model": ValidationErrorResponse}},
)
def logout(
    response: Response,
    session: DatabaseSession,
    settings: SettingsDependency,
    current_user: CurrentUserDependency,
    payload: RefreshTokenRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> None:
    token = payload.refresh_token if payload is not None else refresh_cookie
    AuthService(session, settings).logout(user_id=current_user.id, token=token)
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite="lax",
    )


def _set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/api/v1/auth",
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite="lax",
    )


def _token_response(tokens: TokenPair) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
    )
