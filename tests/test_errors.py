import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import AppError, NotFoundError, ValidationAppError, register_exception_handlers


class Profile(BaseModel):
    count: int


class Payload(BaseModel):
    profile: Profile


def create_test_app() -> FastAPI:
    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/resource")
    def missing_resource() -> None:
        raise NotFoundError

    @application.get("/domain-validation")
    def invalid_domain_value() -> None:
        raise ValidationAppError(fields={"email": "invalid format"})

    @application.post("/request-validation")
    def validate_request(_payload: Payload) -> dict[str, bool]:
        return {"ok": True}

    @application.get("/method-only")
    def method_only() -> dict[str, bool]:
        return {"ok": True}

    @application.get("/boom")
    def unexpected_error() -> None:
        raise RuntimeError("sensitive detail")

    return application


client = TestClient(create_test_app(), raise_server_exceptions=False)


def test_app_error_base_is_abstract() -> None:
    with pytest.raises(TypeError):
        AppError()


def test_application_error_contract() -> None:
    response = client.get("/resource")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Resource not found"}


def test_domain_validation_error_contract() -> None:
    response = client.get("/domain-validation")

    assert response.status_code == 422
    assert response.json() == {
        "code": "validation_error",
        "message": "Request body is invalid",
        "fields": {"email": "invalid format"},
    }


def test_request_validation_error_flattens_nested_field_path() -> None:
    response = client.post(
        "/request-validation",
        json={"profile": {"count": "not-an-integer"}},
    )

    assert response.status_code == 422
    assert response.json() == {
        "code": "validation_error",
        "message": "Request body is invalid",
        "fields": {
            "profile.count": "Input should be a valid integer, unable to parse string as an integer"
        },
    }


def test_framework_not_found_uses_error_contract() -> None:
    response = client.get("/unknown")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Resource not found"}


def test_method_not_allowed_uses_error_contract() -> None:
    response = client.post("/method-only")

    assert response.status_code == 405
    assert response.json() == {
        "code": "method_not_allowed",
        "message": "Method not allowed",
    }


def test_unexpected_error_hides_internal_details() -> None:
    response = client.get("/boom")

    assert response.status_code == 500
    assert response.json() == {
        "code": "internal_error",
        "message": "Internal server error",
    }
