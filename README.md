# Spoons Up API

Backend for a personal habit and task tracker. Areas group what you're trying to be consistent at; habits and goals live under them; weekly results roll up to the area.

The web and mobile clients live in [`spoons-up-app`](https://github.com/Deniztpl/spoons-up-app).

## Features

- Habits you check off daily or weekly, with sparse entries — a row exists only when you check off
- Goals with weekly quotas and scheduling rules that generate concrete tasks
- Lazy task generation: a week's tasks are created the first time that week is requested
- Postpone a task without moving the week its quota counts toward
- Frozen weekly history — changing a quota never rewrites a past week's result
- Per-user timezone and week start day
- Push reminders before a task starts

## Tech stack

- FastAPI, Python 3.12
- PostgreSQL, SQLAlchemy 2.0, Alembic
- JWT auth with rotating refresh tokens
- uv for dependencies

## Getting started

### Requirements

- Python 3.12
- Docker (for PostgreSQL)

### Installation

```bash
git clone https://github.com/Deniztpl/spoons-up-api
cd spoons-up-api
uv sync
```

### Configuration

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgresql+psycopg://spoons:spoons@localhost:5432/spoons
JWT_SECRET=
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=30
CORS_ORIGINS=http://localhost:3000
```

### Run

```bash
docker compose up -d                  # postgres
uv run alembic upgrade head           # migrations
uv run fastapi dev app/main.py        # server on :8000
```

Interactive docs at `http://localhost:8000/docs`.

### Tests

```bash
uv run pytest
```

## Project structure

```text
app/
  api/            HTTP endpoints
  services/       business logic
  repositories/   database access
  models/         SQLAlchemy models
  schemas/        Pydantic request/response schemas
  jobs/           worker and scheduler entrypoints
alembic/
tests/
docs/
```

## Documentation

- [`docs/design.md`](docs/design.md) — features, decisions and the database schema
- [`docs/api-contract.md`](docs/api-contract.md) — request and response shapes
- [`docs/plan.md`](docs/plan.md) — build order
- [`AGENTS.md`](AGENTS.md) — rules for coding agents working in this repo

## License

MIT