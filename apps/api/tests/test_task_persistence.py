from datetime import date, time
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.periods import get_week_start
from app.models import Goal, GoalRule, Task, TaskStatus, User

pytestmark = pytest.mark.integration


def test_generated_task_is_persisted_with_its_week_and_defaults(
    client: TestClient,
    db_session: Session,
) -> None:
    user, goal, rule = create_task_context(
        client,
        db_session,
        email="task-persistence@example.com",
    )
    occurrence_date = date(2030, 9, 30)
    task = build_task(
        user=user,
        goal=goal,
        rule=rule,
        occurrence_date=occurrence_date,
    )

    db_session.add(task)
    db_session.flush()
    db_session.refresh(task)

    assert user.last_seen_at is not None
    assert task.period_start == get_week_start(
        occurrence_date,
        week_start_day=user.week_start_day,
    )
    assert task.duration_minutes == 60
    assert task.block_count == Decimal("2.0")
    assert task.status == TaskStatus.PENDING.value
    assert task.completed_at is None
    assert task.created_at is not None


def test_generated_task_occurrence_is_unique_and_block_count_uses_half_steps(
    client: TestClient,
    db_session: Session,
) -> None:
    user, goal, rule = create_task_context(
        client,
        db_session,
        email="task-constraints@example.com",
    )
    occurrence_date = date(2030, 9, 30)
    db_session.add(
        build_task(
            user=user,
            goal=goal,
            rule=rule,
            occurrence_date=occurrence_date,
        )
    )
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(
                build_task(
                    user=user,
                    goal=goal,
                    rule=rule,
                    occurrence_date=occurrence_date,
                )
            )
            db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            invalid_task = build_task(
                user=user,
                goal=goal,
                rule=rule,
                occurrence_date=date(2030, 10, 2),
            )
            invalid_task.block_count = Decimal("0.3")
            db_session.add(invalid_task)
            db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            invalid_task = build_task(
                user=user,
                goal=goal,
                rule=rule,
                occurrence_date=date(2030, 10, 3),
            )
            invalid_task.duration_minutes = 0
            db_session.add(invalid_task)
            db_session.flush()


def test_rule_and_task_schedule_values_can_be_null(
    client: TestClient,
    db_session: Session,
) -> None:
    user, goal, _ = create_task_context(
        client,
        db_session,
        email="nullable-task-schedule@example.com",
    )
    rule = GoalRule(
        goal_id=goal.id,
        byweekday=[2],
        start_time=None,
        duration_minutes=None,
        block_count=None,
    )
    db_session.add(rule)
    db_session.flush()

    occurrence_date = date(2030, 10, 1)
    task = Task(
        user_id=user.id,
        goal_id=goal.id,
        rule_id=rule.id,
        title=goal.title,
        occurrence_date=occurrence_date,
        scheduled_date=occurrence_date,
        start_time=None,
        duration_minutes=None,
        end_time=None,
        block_count=None,
        period_start=get_week_start(
            occurrence_date,
            week_start_day=user.week_start_day,
        ),
    )
    db_session.add(task)
    db_session.flush()
    db_session.refresh(task)

    assert rule.start_time is None
    assert rule.duration_minutes is None
    assert rule.block_count is None
    assert task.start_time is None
    assert task.duration_minutes is None
    assert task.end_time is None
    assert task.block_count is None


def test_journal_task_database_constraints(
    client: TestClient,
    db_session: Session,
) -> None:
    user, goal, _ = create_task_context(
        client,
        db_session,
        email="journal-task-constraints@example.com",
    )
    parent = journal_task(user_id=user.id)
    db_session.add(parent)
    db_session.flush()

    invalid_tasks = [
        # Goal tasks must remain scheduled.
        journal_task(user_id=user.id, goal_id=goal.id),
        # Schedule and period identity are nullable only as a pair.
        journal_task(user_id=user.id, scheduled_date=date(2030, 10, 1)),
        # A start time cannot exist without a calendar date.
        journal_task(user_id=user.id, start_time=time(9)),
        # Due dates belong only to top-level Journal work.
        journal_task(
            user_id=user.id,
            parent_id=parent.id,
            due_date=date(2030, 10, 1),
        ),
        # A step cannot also belong to a goal.
        journal_task(
            user_id=user.id,
            goal_id=goal.id,
            parent_id=parent.id,
            scheduled_date=date(2030, 10, 1),
            period_start=date(2030, 9, 30),
        ),
    ]

    for invalid_task in invalid_tasks:
        with pytest.raises(IntegrityError):
            with db_session.begin_nested():
                db_session.add(invalid_task)
                db_session.flush()


def test_rule_deletion_keeps_task_and_goal_deletion_removes_it(
    client: TestClient,
    db_session: Session,
) -> None:
    user, goal, rule = create_task_context(
        client,
        db_session,
        email="task-delete-behavior@example.com",
    )
    task = build_task(
        user=user,
        goal=goal,
        rule=rule,
        occurrence_date=date(2030, 9, 30),
    )
    db_session.add(task)
    db_session.flush()
    task_id = task.id

    db_session.execute(delete(GoalRule).where(GoalRule.id == rule.id))
    db_session.flush()
    db_session.expire_all()

    preserved_task = db_session.get(Task, task_id)
    assert preserved_task is not None
    assert preserved_task.rule_id is None

    db_session.execute(delete(Goal).where(Goal.id == goal.id))
    db_session.flush()
    db_session.expire_all()

    assert db_session.get(Task, task_id) is None


def create_task_context(
    client: TestClient,
    db_session: Session,
    *,
    email: str,
) -> tuple[User, Goal, GoalRule]:
    tokens = register(client, email)
    headers = bearer(tokens)
    area_response = client.post(
        "/api/v1/areas",
        json={"name": "Work"},
        headers=headers,
    )
    assert area_response.status_code == 201

    goal_response = client.post(
        "/api/v1/goals",
        json={
            "area_id": area_response.json()["id"],
            "title": "Deep work",
            "weekly_target": 4,
        },
        headers=headers,
    )
    assert goal_response.status_code == 201

    rule_response = client.post(
        f"/api/v1/goals/{goal_response.json()['id']}/rules",
        json={
            "byweekday": [1, 3, 5],
            "start_time": "09:00",
            "duration_minutes": 60,
            "block_count": 2,
        },
        headers=headers,
    )
    assert rule_response.status_code == 201

    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    goal = db_session.get(Goal, int(goal_response.json()["id"]))
    rule = db_session.get(GoalRule, int(rule_response.json()["id"]))
    assert goal is not None
    assert rule is not None
    return user, goal, rule


def build_task(
    *,
    user: User,
    goal: Goal,
    rule: GoalRule,
    occurrence_date: date,
) -> Task:
    return Task(
        user_id=user.id,
        goal_id=goal.id,
        rule_id=rule.id,
        title=goal.title,
        occurrence_date=occurrence_date,
        scheduled_date=occurrence_date,
        start_time=time(9),
        duration_minutes=60,
        end_time=time(10),
        block_count=rule.block_count,
        period_start=get_week_start(
            occurrence_date,
            week_start_day=user.week_start_day,
        ),
    )


def journal_task(
    *,
    user_id: int,
    goal_id: int | None = None,
    parent_id: int | None = None,
    scheduled_date: date | None = None,
    due_date: date | None = None,
    start_time: time | None = None,
    period_start: date | None = None,
) -> Task:
    return Task(
        user_id=user_id,
        goal_id=goal_id,
        parent_id=parent_id,
        rule_id=None,
        title="Journal item",
        occurrence_date=None,
        scheduled_date=scheduled_date,
        due_date=due_date,
        start_time=start_time,
        duration_minutes=None,
        end_time=None,
        block_count=None,
        period_start=period_start,
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
