from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from app.api.cookies import clear_refresh_cookie, set_refresh_cookie
from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import AuthServiceDependency
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.services.auth import TokenPair

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
    auth_service: AuthServiceDependency,
) -> TokenResponse:
    tokens = auth_service.register(payload)
    set_refresh_cookie(response, tokens.refresh_token)
    return _token_response(tokens)


@router.post(
    "/login",
    response_model=TokenResponse,
    responses=AUTH_RESPONSES,
)
def login(
    payload: LoginRequest,
    response: Response,
    auth_service: AuthServiceDependency,
) -> TokenResponse:
    tokens = auth_service.login(payload)
    set_refresh_cookie(response, tokens.refresh_token)
    return _token_response(tokens)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses=AUTH_RESPONSES,
)
def refresh(
    response: Response,
    auth_service: AuthServiceDependency,
    payload: RefreshTokenRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> TokenResponse:
    token = payload.refresh_token if payload is not None else refresh_cookie
    tokens = auth_service.refresh(token)
    set_refresh_cookie(response, tokens.refresh_token)
    return _token_response(tokens)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses={401: {"model": ErrorResponse}, 422: {"model": ValidationErrorResponse}},
)
def logout(
    response: Response,
    auth_service: AuthServiceDependency,
    current_user: CurrentUserDependency,
    payload: RefreshTokenRequest | None = None,
    refresh_cookie: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> None:
    token = payload.refresh_token if payload is not None else refresh_cookie
    auth_service.logout(user_id=current_user.id, token=token)
    clear_refresh_cookie(response)


def _token_response(tokens: TokenPair) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
    )
