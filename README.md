# Spoons Up

Spoons Up helps you build yourself across habits, goals, focused work, fitness, and
nutrition.

## Product

- **Areas** organize the parts of life you want to improve.
- **Habits** track daily or weekly consistency.
- **Goals** define weekly progress in blocks.
- **Tasks** turn goals into concrete scheduled work.

The current implementation focuses on the Goals & Habits domain. Development status
and upcoming slices are tracked in [`docs/plan.md`](docs/plan.md).

## Stack

- FastAPI, Python 3.12, PostgreSQL, SQLAlchemy, and Alembic
- React 19, Vite, TypeScript, and Tailwind CSS
- A generated `openapi-fetch` client shared through the pnpm workspace
- Docker Compose for the local development stack

## Quick start

```bash
git clone https://github.com/Deniztpl/spoons-up
cd spoons-up
docker compose up --build -d
```

Then open:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

Docker Compose starts PostgreSQL, applies pending migrations, and starts the API,
scheduler, and web app.

## Development

Running services outside Docker requires Python 3.12, Node.js 22.12 or newer,
pnpm 12.5.1, and uv.

Start the test database and run backend checks:

```bash
docker compose --profile test up -d --wait test-db
cd apps/api
uv sync
uv run ruff check .
uv run pytest
```

Install the JavaScript workspace and run its checks from the repository root:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Repository

```text
apps/api/            FastAPI backend, migrations, and tests
apps/web/            React web application
apps/mobile/         planned mobile application
packages/api-client/ generated TypeScript API contract and client
docs/                product design, API contract, and implementation plan
```

Read [`docs/design.md`](docs/design.md) for product decisions,
[`docs/api-contract.md`](docs/api-contract.md) for request and response shapes, and
[`docs/project-structure.md`](docs/project-structure.md) for code placement rules.

## License

MIT
