# Spoons Up

Monorepo for a personal habit and task tracker. Areas group what you're trying to be consistent at; habits and goals live under them; weekly results roll up to the area.

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
- Web: React 19, Vite 8, strict TypeScript, Tailwind CSS 4, Vitest
- API client: `openapi-fetch`, generated types from the tracked OpenAPI contract
- Workspace: pnpm 12.5.1
- Mobile: planned under `apps/mobile`

## Requirements

- Docker with Docker Compose
- For running services outside Docker: Python 3.12, Node.js 22.12 or newer, pnpm 12.5.1, and uv

## Installation

Clone the repository and start the complete development stack:

```bash
git clone https://github.com/Deniztpl/spoons-up
cd spoons-up
docker compose up --build -d
```

Compose starts PostgreSQL, runs every pending Alembic migration, then starts the API and web app. Open the web app at `http://localhost:3000`; the API and its interactive docs are available at `http://localhost:8000` and `http://localhost:8000/docs`.

The Compose defaults are for local development. They can be overridden through a root `.env` file or shell environment, including `JWT_SECRET`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `REFRESH_COOKIE_SECURE`, `CORS_ORIGINS`, and `VITE_API_URL`.

To run the application processes outside Docker instead, install the JavaScript workspace from the repository root:

```bash
npm install --global pnpm@12.5.1
pnpm install
```

Then set up and configure the API:

```bash
cd apps/api
uv sync
cp .env.example .env
```

`apps/api/.env` contains:

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

## Run services outside Docker

Compose can still provide only PostgreSQL while the API and web app run directly on the host. Use three terminals.

Terminal 1, from the repository root, starts PostgreSQL:

```bash
docker compose up -d --wait db
```

Terminal 2 starts the API:

```bash
cd apps/api
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

The API is available at `http://localhost:8000`; interactive docs are at `http://localhost:8000/docs`.

Terminal 3, from the repository root, starts the web app:

```bash
pnpm dev
```

The web app is available at `http://localhost:3000`. Copy `apps/web/.env.example` to `apps/web/.env.local` to override `VITE_API_URL`; it defaults to `http://localhost:8000`.

### Web authentication

The web client keeps the short-lived access token in memory and sends it as a bearer token. The refresh token stays in the API's `httpOnly` cookie; the client restores the session through `/api/v1/auth/refresh` when the page loads and never writes either token to browser storage.

With all three processes running, open `http://localhost:3000/register`, create an account, reload the shell to confirm the cookie restores the session, then use **Log out** to return to the login screen.

## API contract and typed client

Generate the tracked OpenAPI contract from `apps/api/` after changing endpoints:

```bash
uv run python -m app.commands.export_openapi
git diff --exit-code -- openapi.json
```

Then generate or verify the tracked TypeScript schema from the repository root:

```bash
pnpm api-client:generate
pnpm api-client:check
```

The client factory is exported by `@spoons-up/api-client`. Callers provide the base URL, credentials policy, custom `fetch`, and any middleware they need.

## Checks

Start the dedicated PostgreSQL test service from the repository root:

```bash
docker compose --profile test up -d --wait test-db
```

Run backend checks from `apps/api/`:

```bash
uv run ruff check .
uv run pytest
```

Run frontend and client checks from the repository root:

```bash
pnpm api-client:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Project structure

```text
apps/
  api/              FastAPI backend, migrations, OpenAPI contract, and tests
  web/              Vite + React web application
  mobile/           planned mobile application
packages/
  api-client/       shared typed OpenAPI client
docs/               shared product and architecture documentation
compose.yaml        complete local development stack
```

## Documentation

- [`docs/design.md`](docs/design.md) — features, decisions, and the database schema
- [`docs/api-contract.md`](docs/api-contract.md) — request and response shapes
- [`docs/plan.md`](docs/plan.md) — build order
- [`AGENTS.md`](AGENTS.md) — repository-wide rules for coding agents
- [`apps/api/AGENTS.md`](apps/api/AGENTS.md) — backend-specific rules for coding agents

## License

MIT
