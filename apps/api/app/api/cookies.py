from fastapi import Response

from app.core.config.auth import auth_settings

REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        max_age=auth_settings.refresh_token_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        secure=auth_settings.refresh_cookie_secure,
        httponly=True,
        samesite="lax",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        path=REFRESH_COOKIE_PATH,
        secure=auth_settings.refresh_cookie_secure,
        httponly=True,
        samesite="lax",
    )
