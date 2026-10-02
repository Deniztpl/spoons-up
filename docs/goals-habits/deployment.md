# Deployment — Spoons Up

This is the Slice 7 production runbook. Apply it after the implementation blocks in
`plan.md` are complete. The target is one owner using the web app from phone and PC,
with no paid service and no production secret committed to this public repository.

## Architecture

| Provider | Responsibility |
|---|---|
| Vercel Hobby | Static build of `apps/web`; same-origin API and SPA rewrites |
| Render Free | Docker deployment of `apps/api`; migrations and the FastAPI process |
| Supabase Free | Postgres through the Session pooler only |
| cron-job.org | Render keep-alive request and hourly maintenance trigger |

The browser calls relative `/api/v1` paths. `apps/web/vercel.json` rewrites those
requests to Render, which keeps the httpOnly refresh cookie first-party from the
browser's point of view. cron-job.org bypasses Vercel and calls Render directly.

The Compose `scheduler` remains the local job runner. It is not deployed to Render:
the free service has no background worker in this architecture. Local system cron and
the production HTTP trigger call the same idempotent hourly job function.

Supabase Auth, API and Storage, a mobile deployment, custom domains and paid plans are
outside this slice.

## Secret handling

- Store production values only in the provider dashboards.
- Commit variable names and placeholders only. Never commit database URLs, passwords,
  JWT secrets, cron secrets or copied dashboard output.
- Generate independent random values for `JWT_SECRET` and `CRON_SECRET`; do not reuse
  the database password.
- Keep the refresh cookie without a fixed `Domain` and set it `Secure` in production.

## Supabase

1. Create a project and use its Postgres database only.
2. Copy the Session pooler connection string, not a direct or transaction-pooler URL.
3. Change the SQLAlchemy scheme to `postgresql+psycopg://` and ensure the query string
   explicitly contains `sslmode=require`. Append `?sslmode=require` when there is no
   query string, or `&sslmode=require` when other query parameters already exist; do
   not rely on psycopg's `sslmode=prefer` default.
4. Save that value as Render's `DATABASE_URL`. Do not add it to an env file in the
   repository.

## Render

Create one Web Service from the repository with these settings:

| Setting | Value |
|---|---|
| Runtime | Docker |
| Dockerfile | `apps/api/Dockerfile` |
| Docker build context | repository root |
| Health check path | `/health` |
| Start command | use the Dockerfile default: migrate, then serve on `0.0.0.0:$PORT` |

Do not create a Render background worker or deploy the Compose scheduler.

Configure these environment variables in Render:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Supabase Session pooler URL using `postgresql+psycopg://` and `sslmode=require` |
| `JWT_SECRET` | independent random secret, at least 32 characters |
| `CRON_SECRET` | independent random secret shared only with cron-job.org |
| `ACTIVE_USER_DAYS` | `30` |
| `REGISTRATION_ENABLED` | `true` for the first signup, then `false` |
| `REFRESH_COOKIE_SECURE` | `true` |
| `ACCESS_TOKEN_MINUTES` | `15` unless intentionally changed |
| `REFRESH_TOKEN_DAYS` | `30` unless intentionally changed |
| `CORS_ORIGINS` | empty; browser API traffic is same-origin through Vercel |

Render supplies `PORT`; do not hard-code it. The container applies `alembic upgrade
head` before starting the API. After the first deploy, confirm that `GET /health`
returns `200` even before testing database-backed endpoints.

## Vercel

`apps/web/vercel.json` initially contains a placeholder Render destination. Replace it
with the real HTTPS Render service URL before the production deploy; keep the incoming
path unchanged so `/api/v1/...` reaches the same path on Render.

Create a Vercel project with:

| Setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Framework preset | Vite |
| Node.js version | `22.x` |
| Include source files outside Root Directory | enabled |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | `dist` |

Set `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel for Production and Preview so builds
use the repository's pinned `pnpm@12.5.1`. Without Corepack, a custom `pnpm install`
command can select an older Vercel-provided pnpm version. See Vercel's
[Corepack build configuration](https://vercel.com/docs/builds/configure-a-build#corepack).

Leave `VITE_API_URL` unset in production so the web build uses relative URLs. The
rewrite order is significant: `/api/:path*` goes to Render first, and every other path
falls back to `/index.html` for React Router. Vercel runs the commands from the selected
Root Directory; pnpm discovers the workspace root and installs the shared API client.
The API rewrite explicitly disables Vercel rewrite caching so authenticated responses
are never stored at the edge.

## cron-job.org

Create two jobs using the Render service URL directly:

| Schedule | Request | Headers | Expected response |
|---|---|---|---|
| Every 10 minutes | `GET https://<render-service>/health` | none | `200` |
| Every hour | `POST https://<render-service>/internal/jobs/hourly` | `X-Cron-Secret: <CRON_SECRET>` | `204` |

The header value must exactly match Render's `CRON_SECRET`. Do not route either job
through Vercel. The hourly endpoint is idempotent so retrying the same period creates
no duplicate generated tasks or frozen results.

## First production run

Follow this order so migrations exist before the web app or jobs can reach the API:

1. Create Supabase and obtain the SSL Session pooler URL.
2. Deploy Render with `REGISTRATION_ENABLED=true`; confirm `/health` and a
   database-backed request after migrations finish.
3. Put the real Render URL into the Vercel rewrite and deploy Vercel.
4. Register the single owner through the Vercel URL.
5. Change Render to `REGISTRATION_ENABLED=false` and redeploy or restart the service.
6. Confirm a second registration returns `403 registration_closed`.
7. In the Supabase SQL editor, run `SELECT count(*) FROM users;` and confirm the result
   is exactly `1`.
8. Create and check a task, reload, and confirm both the session and task state remain.
9. Create the cron-job.org jobs, run each once manually, and confirm their `200` and
   `204` responses before enabling their schedules.

## Acceptance

Deployment is complete when phone and PC can open the Vercel URL from different
networks, login survives a reload, a checked task survives a reload, registration is
closed after the one owner exists, and cron-job.org runs the hourly job successfully.
