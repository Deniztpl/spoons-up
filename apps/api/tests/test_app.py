from fastapi.testclient import TestClient

from app.main import app


def test_openapi_smoke() -> None:
    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"] == {"title": "Spoons Up API", "version": "0.1.0"}
    assert response.json()["paths"] == {}
