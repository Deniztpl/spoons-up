import json

from fastapi.testclient import TestClient

from app.commands.export_openapi import export_openapi
from app.main import app


def test_openapi_smoke() -> None:
    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"] == {"title": "Spoons Up API", "version": "0.1.0"}
    assert set(response.json()["paths"]) == {
        "/api/v1/areas",
        "/api/v1/areas/{area_id}",
        "/api/v1/areas/{area_id}/archive",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/v1/auth/register",
    }


def test_openapi_describes_bearer_auth_and_refresh_cookie() -> None:
    schema = app.openapi()
    logout_operation = schema["paths"]["/api/v1/auth/logout"]["post"]
    refresh_operation = schema["paths"]["/api/v1/auth/refresh"]["post"]

    assert schema["components"]["securitySchemes"]["BearerAuth"] == {
        "scheme": "bearer",
        "type": "http",
    }
    assert logout_operation["security"] == [{"BearerAuth": []}]
    assert any(
        parameter["in"] == "cookie" and parameter["name"] == "refresh_token"
        for parameter in refresh_operation["parameters"]
    )


def test_openapi_export_is_deterministic(tmp_path) -> None:
    output_path = tmp_path / "openapi.json"

    export_openapi(output_path)
    first_export = output_path.read_bytes()
    export_openapi(output_path)

    assert output_path.read_bytes() == first_export
    assert json.loads(first_export) == app.openapi()
