import logging
from abc import ABC
from typing import ClassVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.errors import ErrorResponse, ValidationErrorResponse

logger = logging.getLogger(__name__)


class AppError(Exception, ABC):
    status_code: ClassVar[int]
    code: ClassVar[str]
    default_message: ClassVar[str]

    def __init__(self, message: str | None = None) -> None:
        if type(self) is AppError:
            raise TypeError("AppError is abstract")
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    default_message = "Resource not found"


class ValidationAppError(AppError):
    status_code = 422
    code = "validation_error"
    default_message = "Request body is invalid"

    def __init__(self, fields: dict[str, str], message: str | None = None) -> None:
        self.fields = fields
        super().__init__(message)


def _app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    if isinstance(exc, ValidationAppError):
        content = ValidationErrorResponse(
            code=exc.code,
            message=exc.message,
            fields=exc.fields,
        ).model_dump()
    else:
        content = ErrorResponse(code=exc.code, message=exc.message).model_dump()

    return JSONResponse(status_code=exc.status_code, content=content)


def _validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields: dict[str, str] = {}
    transport_prefixes = {"body", "path", "query"}

    for error in exc.errors():
        location = list(error["loc"])
        if location and location[0] in transport_prefixes:
            location = location[1:]
        field = ".".join(str(part) for part in location) or "_request"
        fields.setdefault(field, error["msg"])

    content = ValidationErrorResponse(
        code=ValidationAppError.code,
        message=ValidationAppError.default_message,
        fields=fields,
    ).model_dump()
    return JSONResponse(status_code=422, content=content)


def _http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    errors = {
        404: ("not_found", "Resource not found"),
        405: ("method_not_allowed", "Method not allowed"),
    }
    code, message = errors.get(exc.status_code, ("http_error", "Request failed"))
    content = ErrorResponse(code=code, message=message).model_dump()
    return JSONResponse(status_code=exc.status_code, content=content)


def _unexpected_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled application error",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    content = ErrorResponse(
        code="internal_error",
        message="Internal server error",
    ).model_dump()
    return JSONResponse(status_code=500, content=content)


def register_exception_handlers(application: FastAPI) -> None:
    application.add_exception_handler(AppError, _app_error_handler)
    application.add_exception_handler(RequestValidationError, _validation_error_handler)
    application.add_exception_handler(StarletteHTTPException, _http_error_handler)
    application.add_exception_handler(Exception, _unexpected_error_handler)
