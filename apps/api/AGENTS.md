# Spoons Up API

Backend for a personal habit and task tracker. Areas group habits and goals; goals generate scheduled tasks; weekly results roll up to the area.

## Stack

- FastAPI, Python 3.12, uv
- PostgreSQL, SQLAlchemy 2.0, Alembic
- Synchronous throughout — plain `def` routes, synchronous sessions

## Backend structure

- `app/api/` — HTTP endpoints
- `app/services/` — business logic
- `app/repositories/` — database access
- `app/models/` — SQLAlchemy models
- `app/schemas/` — Pydantic request and response schemas
- `app/jobs/` — worker and scheduler entrypoints
- `alembic/` — migrations
- `tests/`

## Documentation

- `../../docs/design.md` — features, decisions with their reasoning, and the database schema. Read before changing behaviour or adding a table.
- `../../docs/plan.md` — the slice being built and what comes next.
- `../../docs/api-contract.md` — request and response shapes for the current slice.

## Development

Run these commands from `apps/api/`:

```bash
uv run fastapi dev app/main.py     # server
uv run pytest                      # tests
uv run ruff check --fix && uv run ruff format
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

## Architecture rules

- Routes call services; services call repositories. No database access in a route handler.
- Services take the route-layer Pydantic request schema as a single payload argument. Repositories take explicit keyword arguments.
- Transaction boundaries live in the service layer: services wrap writes in `with self.session.begin():`. Repositories never commit — they add, query and flush. The session dependency only opens and closes the session. AuthService.refresh is the one exception: it commits the revocation before raising, so the write survives the error.
- Never return a SQLAlchemy model from an endpoint — always a Pydantic schema.
- Every query for user-owned data is scoped by the `user_id` from the token. A resource owned by another user returns 404, never 403.
- `user_id` is never a path or query parameter.
- Any model change needs an Alembic migration in the same commit.
- Write no `async def` and add no async driver. The codebase is synchronous by decision, not by accident.

## Domain rules

These cannot be inferred from the code and are easy to break.

- All task generation goes through `add_tasks(user_id, from_date, to_date)`. Never expand a rule anywhere else.
- Week boundaries come from the user's `week_start_day`, not ISO Monday. Use the project's period utilities; never calculate a week boundary ad hoc.
- "Today" is derived from the user's `timezone`, never from the server's UTC date. This applies to the worker too.
- `occurrence_date` is immutable once written. Postponing changes `scheduled_date` only.
- `period_start` is fixed at generation. A task moved across a week boundary still counts toward its original week.
- A rule-generated task is soft-deleted (`status = DELETED`); an ad-hoc task is hard-deleted.
- Closed weeks in `period_results` are written once and never recomputed. Only the open week is computed live.
- Habit entries are sparse — a row exists only when checked off. There is no MISSED or SKIPPED state, and undo is a hard delete.
- `archived_at` is a timestamp, not a flag. Past weeks read it to know whether an item existed then.

## Conventions

- Enums are `StrEnum`; the database stores `text` with a CHECK constraint, never a native Postgres enum.
- Errors are raised as application exception classes, never `HTTPException` directly.
- Dates and times are stored local (`scheduled_date`, `start_time`); only `reminders.scheduled_at` is UTC.
- Follow the existing directory and naming conventions. Prefer an existing pattern over a new abstraction.
- Type hints on public functions.

## Testing

- Period math and `materialize` carry the real risk — cover week boundaries, timezones and repeated runs over the same range.

## Before finishing

- Run the tests.
- Run ruff.
- If models changed, generate the migration and run `alembic upgrade head`.
- If endpoints changed, regenerate `openapi.json`.
