from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task, TaskStatus, User
from app.services import journal as journal_service_module

pytestmark = pytest.mark.integration

OBSERVED_AT = datetime(2026, 9, 24, 22, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def fixed_journal_service_time(monkeypatch: pytest.MonkeyPatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return OBSERVED_AT if tz is None else OBSERVED_AT.astimezone(tz)

    monkeypatch.setattr(journal_service_module, "datetime", FixedDateTime)


def test_journal_returns_empty_lists_and_requires_authentication(client: TestClient) -> None:
    headers = bearer(register(client, "empty-journal@example.com"))

    response = client.get("/api/v1/journal", headers=headers)
    unauthorized = client.get("/api/v1/journal")

    assert response.status_code == 200
    assert response.json() == {
        "today": "2026-09-25",
        "active": [],
        "completed": [],
    }
    assert unauthorized.status_code == 401


def test_journal_orders_items_nests_steps_and_scopes_every_row(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = bearer(register(client, "journal@example.com"))
    register(client, "journal-stranger@example.com")
    area = create_area(client, headers, "Work")
    goal = create_goal(client, headers, area_id=str(area["id"]), title="Deep work")

    with db_session.begin():
        user = get_user(db_session, "journal@example.com")
        stranger = get_user(db_session, "journal-stranger@example.com")
        dated_timed = build_task(
            user_id=user.id,
            title="Timed first",
            due_date=date(2026, 10, 1),
            scheduled_date=date(2026, 10, 1),
            start_time=time(10),
            duration_minutes=60,
            end_time=time(11),
            block_count=Decimal("1.5"),
            created_at=datetime(2026, 9, 3, tzinfo=UTC),
        )
        dated_untimed = build_task(
            user_id=user.id,
            title="Untimed second",
            due_date=date(2026, 10, 1),
            scheduled_date=date(2026, 10, 1),
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
        )
        dated_later = build_task(
            user_id=user.id,
            title="Later due",
            due_date=date(2026, 10, 2),
            scheduled_date=date(2026, 10, 2),
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
        )
        undated_old = build_task(
            user_id=user.id,
            title="Old undated",
            scheduled_date=date(2026, 9, 30),
            start_time=time(8),
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
        )
        undated_new = build_task(
            user_id=user.id,
            title="New undated",
            created_at=datetime(2026, 9, 2, tzinfo=UTC),
        )
        completed_old = build_task(
            user_id=user.id,
            title="Completed old",
            status=TaskStatus.DONE,
            completed_at=datetime(2026, 9, 20, 12, tzinfo=UTC),
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
        )
        completed_tie_first = build_task(
            user_id=user.id,
            title="Completed tie first",
            status=TaskStatus.DONE,
            completed_at=datetime(2026, 9, 24, 12, tzinfo=UTC),
            created_at=datetime(2026, 9, 2, tzinfo=UTC),
        )
        completed_tie_second = build_task(
            user_id=user.id,
            title="Completed tie second",
            status=TaskStatus.DONE,
            completed_at=datetime(2026, 9, 24, 12, tzinfo=UTC),
            created_at=datetime(2026, 9, 3, tzinfo=UTC),
        )
        deleted = build_task(
            user_id=user.id,
            title="Deleted",
            status=TaskStatus.DELETED,
            created_at=datetime(2026, 9, 4, tzinfo=UTC),
        )
        strangers_item = build_task(
            user_id=stranger.id,
            title="Private",
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
        )
        goal_task = build_task(
            user_id=user.id,
            goal_id=int(str(goal["id"])),
            title="Deep work",
            scheduled_date=date(2026, 10, 1),
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
        )
        db_session.add_all(
            [
                dated_timed,
                dated_untimed,
                dated_later,
                undated_old,
                undated_new,
                completed_old,
                completed_tie_first,
                completed_tie_second,
                deleted,
                strangers_item,
                goal_task,
            ]
        )
        db_session.flush()

        completed_step = build_task(
            user_id=user.id,
            parent_id=dated_timed.id,
            title="First step",
            scheduled_date=date(2026, 9, 30),
            start_time=time(14),
            duration_minutes=60,
            end_time=time(15),
            block_count=Decimal("1.0"),
            status=TaskStatus.DONE,
            completed_at=datetime(2026, 9, 23, 12, tzinfo=UTC),
            created_at=datetime(2026, 9, 4, tzinfo=UTC),
        )
        pending_step = build_task(
            user_id=user.id,
            parent_id=dated_timed.id,
            title="Second step",
            created_at=datetime(2026, 9, 5, tzinfo=UTC),
        )
        completed_parent_step = build_task(
            user_id=user.id,
            parent_id=completed_tie_second.id,
            title="Still pending",
            created_at=datetime(2026, 9, 6, tzinfo=UTC),
        )
        deleted_step = build_task(
            user_id=user.id,
            parent_id=dated_timed.id,
            title="Deleted step",
            status=TaskStatus.DELETED,
            created_at=datetime(2026, 9, 6, tzinfo=UTC),
        )
        strangers_step = build_task(
            user_id=stranger.id,
            parent_id=dated_timed.id,
            title="Private step",
            created_at=datetime(2026, 9, 6, tzinfo=UTC),
        )
        db_session.add_all(
            [
                completed_step,
                pending_step,
                completed_parent_step,
                deleted_step,
                strangers_step,
            ]
        )
        db_session.flush()

        active_ids = [
            str(dated_timed.id),
            str(dated_untimed.id),
            str(dated_later.id),
            str(undated_old.id),
            str(undated_new.id),
        ]
        completed_ids = [
            str(completed_tie_second.id),
            str(completed_tie_first.id),
            str(completed_old.id),
        ]
        step_ids = [str(completed_step.id), str(pending_step.id)]

    response = client.get("/api/v1/journal", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["today"] == "2026-09-25"
    assert [item["id"] for item in body["active"]] == active_ids
    assert [item["id"] for item in body["completed"]] == completed_ids

    first = body["active"][0]
    assert first["progress"] == {"done": 1, "total": 2}
    assert [step["id"] for step in first["steps"]] == step_ids
    assert first["steps"][0] == {
        "id": step_ids[0],
        "parent_id": active_ids[0],
        "title": "First step",
        "scheduled_date": "2026-09-30",
        "start_time": "14:00",
        "duration_minutes": 60,
        "end_time": "15:00",
        "block_count": 1.0,
        "status": "DONE",
        "completed_at": "2026-09-23T12:00:00Z",
    }
    assert body["active"][1]["progress"] == {"done": 0, "total": 0}
    assert body["completed"][0]["progress"] == {"done": 0, "total": 1}
    assert body["completed"][0]["steps"][0]["title"] == "Still pending"


def build_task(
    *,
    user_id: int,
    title: str,
    goal_id: int | None = None,
    parent_id: int | None = None,
    due_date: date | None = None,
    scheduled_date: date | None = None,
    start_time: time | None = None,
    duration_minutes: int | None = None,
    end_time: time | None = None,
    block_count: Decimal | None = None,
    status: TaskStatus = TaskStatus.PENDING,
    completed_at: datetime | None = None,
    created_at: datetime,
) -> Task:
    return Task(
        user_id=user_id,
        goal_id=goal_id,
        parent_id=parent_id,
        rule_id=None,
        title=title,
        occurrence_date=None,
        scheduled_date=scheduled_date,
        due_date=due_date,
        start_time=start_time,
        duration_minutes=duration_minutes,
        end_time=end_time,
        block_count=block_count,
        period_start=date(2026, 9, 28) if scheduled_date is not None else None,
        status=status.value,
        completed_at=completed_at,
        created_at=created_at,
    )


def register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "password123",
            "timezone": "Europe/Istanbul",
        },
    )
    assert response.status_code == 201
    return response.json()


def bearer(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def create_area(
    client: TestClient,
    headers: dict[str, str],
    name: str,
) -> dict[str, object]:
    response = client.post("/api/v1/areas", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_goal(
    client: TestClient,
    headers: dict[str, str],
    *,
    area_id: str,
    title: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/goals",
        json={"area_id": area_id, "title": title, "weekly_target": 4},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user
