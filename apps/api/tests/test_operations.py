from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.orm import Session

from app.api import operations as operations_module
from app.core.config.app import settings
from app.core.database import get_db
from app.jobs import daily as daily_job_module
from app.jobs.daily import HourlyJobResult
from app.main import app


@pytest.fixture
def operation_client() -> Generator[tuple[TestClient, Mock], None, None]:
    session = Mock(spec=Session)

    def override_get_db() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client, session
    finally:
        app.dependency_overrides.clear()


def test_health_responds_without_resolving_database_dependency() -> None:
    def unavailable_database() -> None:
        raise AssertionError("health must not resolve the database dependency")

    app.dependency_overrides[get_db] = unavailable_database
    try:
        with TestClient(app) as client:
            response = client.get("/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("cron_secret", [None, "wrong-secret"])
def test_hourly_job_rejects_missing_or_wrong_secret(
    operation_client: tuple[TestClient, Mock],
    monkeypatch: pytest.MonkeyPatch,
    cron_secret: str | None,
) -> None:
    client, _session = operation_client
    run_hourly_job = Mock()
    monkeypatch.setattr(operations_module, "run_hourly_job", run_hourly_job)
    headers = {"X-Cron-Secret": cron_secret} if cron_secret is not None else {}

    response = client.post("/internal/jobs/hourly", headers=headers)

    assert response.status_code == 401
    assert response.json() == {
        "code": "invalid_cron_secret",
        "message": "Invalid cron secret",
    }
    run_hourly_job.assert_not_called()


def test_hourly_job_runs_with_correct_secret(
    operation_client: tuple[TestClient, Mock],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session = operation_client
    run_hourly_job = Mock()
    monkeypatch.setattr(operations_module, "run_hourly_job", run_hourly_job)

    response = client.post(
        "/internal/jobs/hourly",
        headers={"X-Cron-Secret": settings.cron_secret.get_secret_value()},
    )

    assert response.status_code == 204
    assert response.content == b""
    run_hourly_job.assert_called_once_with(session)


def test_hourly_job_rejects_an_empty_configured_secret(
    operation_client: tuple[TestClient, Mock],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _session = operation_client
    run_hourly_job = Mock()
    monkeypatch.setattr(operations_module, "run_hourly_job", run_hourly_job)
    monkeypatch.setattr(settings, "cron_secret", SecretStr(""))

    response = client.post("/internal/jobs/hourly")

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_cron_secret"
    run_hourly_job.assert_not_called()


def test_hourly_job_rejects_non_ascii_secret_without_server_error(
    operation_client: tuple[TestClient, Mock],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _session = operation_client
    run_hourly_job = Mock()
    monkeypatch.setattr(operations_module, "run_hourly_job", run_hourly_job)

    response = client.post(
        "/internal/jobs/hourly",
        headers=[(b"X-Cron-Secret", "şifre".encode())],
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_cron_secret"
    run_hourly_job.assert_not_called()


def test_operational_routes_are_excluded_from_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "/health" not in paths
    assert "/internal/jobs/hourly" not in paths


def test_hourly_orchestration_runs_both_steps_with_one_timestamp(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    observed_at = datetime(2026, 10, 2, 12, tzinfo=UTC)
    generate_tasks = Mock(return_value=2)
    freeze_results = Mock(return_value=1)
    monkeypatch.setattr(daily_job_module, "run_daily_task_generation", generate_tasks)
    monkeypatch.setattr(daily_job_module, "run_results_freeze", freeze_results)

    result = daily_job_module.run_hourly_job(session, now=observed_at)

    assert result == HourlyJobResult(processed_users=2, frozen_users=1)
    generate_tasks.assert_called_once_with(session, now=observed_at)
    freeze_results.assert_called_once_with(session, now=observed_at)
