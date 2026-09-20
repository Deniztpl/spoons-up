# Spoons Up

Monorepo for a personal habit and task tracker.

## Repository structure

- `apps/api/` — FastAPI backend; see `apps/api/AGENTS.md`
- `apps/web/` — planned web client
- `apps/mobile/` — planned mobile client
- `packages/` — planned shared packages
- `docs/` — product design, API contracts, and implementation plan
- `compose.yaml` — local shared infrastructure

## Documentation

- `docs/design.md` — features, decisions with their reasoning, and the database schema. Read before changing behaviour or adding a table.
- `docs/plan.md` — the slice being built and what comes next.
- `docs/api-contract.md` — request and response shapes for the current slice.

## General rules

- Follow the nearest `AGENTS.md` for workspace-specific rules.
- Keep application code under `apps/`, reusable cross-application code under `packages/`, and shared documentation under `docs/`.
- Read the relevant design and contract documents before changing behaviour.
- Prefer existing patterns over new abstractions and keep changes scoped to the requested work.
- No new dependency without a reason.
- Add or update tests when behaviour changes.
- Never weaken or change a test's expected behaviour solely to make the implementation pass.
