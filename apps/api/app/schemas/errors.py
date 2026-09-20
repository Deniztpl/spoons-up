from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str


class ValidationErrorResponse(ErrorResponse):
    fields: dict[str, str]
