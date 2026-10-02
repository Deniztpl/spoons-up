import hmac
from typing import Annotated

from fastapi import APIRouter, Header, Response, status

from app.api.deps.db import DatabaseSession
from app.core.config.app import settings
from app.core.errors import InvalidCronSecretError
from app.jobs.daily import run_hourly_job
from app.schemas.operations import HealthResponse

router = APIRouter(include_in_schema=False)


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.post(
    "/internal/jobs/hourly",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def hourly_job(
    session: DatabaseSession,
    cron_secret: Annotated[str | None, Header(alias="X-Cron-Secret")] = None,
) -> None:
    configured_secret = settings.cron_secret.get_secret_value()
    if not configured_secret or not hmac.compare_digest(
        (cron_secret or "").encode(),
        configured_secret.encode(),
    ):
        raise InvalidCronSecretError

    run_hourly_job(session)
