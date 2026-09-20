# Spoons Up

Monorepo for a personal habit and task tracker. Areas group what you're trying to be consistent at; habits and goals live under them; weekly results roll up to the area.

The FastAPI backend lives in `apps/api`. Web and mobile clients will live in `apps/web` and `apps/mobile`, with shared code in `packages`.

## Features

- Habits you check off daily or weekly, with sparse entries — a row exists only when you check off
- Goals with weekly quotas and scheduling rules that generate concrete tasks
- Lazy task generation: a week's tasks are created the first time that week is requested
- Postpone a task without moving the week its quota counts toward
- Frozen weekly history — changing a quota never rewrites a past week's result
- Per-user timezone and week start day
- Push reminders before a task starts

## Tech stack

- API: FastAPI, Python 3.12, PostgreSQL, SQLAlchemy 2.0, Alembic, uv
- Web: planned under `apps/web`
- Mobile: planned under `apps/mobile`

## Getting started

### Requirements

- Python 3.12
- Docker (for PostgreSQL)

### Installation

```bash
git clone https://github.com/Deniztpl/spoons-up
cd spoons-up
docker compose up -d
cd apps/api
uv sync
cp .env.example .env
```

Configure `apps/api/.env` as needed:

```env
DATABASE_URL=postgresql+psycopg://spoons:spoons@localhost:5432/spoons
TEST_DATABASE_URL=postgresql+psycopg://spoons:spoons@localhost:5433/spoons_test
JWT_SECRET=replace-with-at-least-32-random-characters
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=30
REFRESH_COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:3000
```

`JWT_SECRET` is required and must contain at least 32 characters. Set `REFRESH_COOKIE_SECURE=true` when the API is served over HTTPS.

### Run the API

From `apps/api/`:

```bash
uv run alembic upgrade head           # migrations
uv run fastapi dev app/main.py        # server on :8000
```

Interactive docs are available at `http://localhost:8000/docs`.

### Tests

Start the dedicated PostgreSQL test service from the repository root:

```bash
docker compose --profile test up -d --wait test-db
```

Then run the checks from `apps/api/`:

```bash
uv run ruff check .
uv run pytest
```

### OpenAPI contract

Generate the tracked API contract from `apps/api/`:

```bash
uv run python -m app.commands.export_openapi
git diff --exit-code -- openapi.json
```

## Project structure

```text
apps/
  api/              FastAPI backend, migrations, and tests
  web/              planned web client
  mobile/           planned mobile client
packages/           planned shared packages
docs/               shared product and architecture documentation
compose.yaml        local PostgreSQL service
```

## Documentation

- [`docs/design.md`](docs/design.md) — features, decisions and the database schema
- [`docs/api-contract.md`](docs/api-contract.md) — request and response shapes
- [`docs/plan.md`](docs/plan.md) — build order
- [`AGENTS.md`](AGENTS.md) — repository-wide rules for coding agents
- [`apps/api/AGENTS.md`](apps/api/AGENTS.md) — backend-specific rules for coding agents

## License

MIT
