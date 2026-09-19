# Backend Plan — Spoons Up

This file defines the backend scope. The frontend comes later; endpoint shapes are driven by the screens, but the backend is finished on its own first.

---

## A — Auth

1. Repo, uv, FastAPI, Postgres compose, Alembic
2. Error contract + `users` and `refresh_tokens` migration
3. `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
4. **Test:** register -> login -> protected endpoint -> refresh, over curl

## B — Areas

5. `areas` migration + CRUD
6. **Test:** another user's area returns 404

## C — Habits

7. `habits` and `habit_entries` migration + CRUD
8. Check off and undo — a row on check, hard delete on undo
9. **Test:** check off twice in the same period, the unique constraint rejects it; switch `mode` and confirm old rows keep their `period_type`

## D — Goals

10. `goals` and `goal_rules` migration + CRUD
11. **Test:** create a goal with several rules, list it

## E — Task generation

12. Period math — timezone + `week_start_day` -> `period_start`. Standalone, no DB, tested.
13. `tasks` migration
14. `materialize` — expand rules into dates, insert idempotently, bounded to ~12 weeks back
15. **Test:** run it twice and check for duplicates; materialize a 5-week gap in one call

## F — API for the today screen

16. `GET /today?date=` — triggers materialize, returns daily habits, weekly habits and the day's tasks ordered by `start_time`
17. Complete and uncomplete a task
18. Ad-hoc task creation (no goal attached)
19. **Test:** create a goal -> see today's task -> complete it -> add an extra task

## G — API for the calendar screen

20. `GET /week?start=`
21. Postpone (`scheduled_date` moves, `occurrence_date` and `period_start` stay)
22. Delete — soft for rule-generated, hard for ad-hoc
23. **Test:** move between weeks, postpone a task across a week boundary, confirm the quota stays with the original week

## H — Weekly results

24. `period_results` migration
25. Live computation — `target` and `done` per requirement for the open week
26. Freeze — snapshot a closed week the first time it is requested
27. Area result — every row for that week satisfies `done >= target`
28. **Test:** close a week, change `weekly_target`, confirm the past week doesn't move

## I — Notifications

29. `reminders` and `devices` migration
30. Device token registration and removal
31. Write a reminder on task create, update on move, cancel on delete
32. Background worker — materialize the next 24 hours every 5-15 minutes, per user timezone
33. Scheduler — scan due reminders every minute, fan out to the user's tokens, prune invalid ones
34. **Test:** create a task an hour out, confirm the reminder row lands at the right UTC time; move the task and confirm it follows

---

## Features

- **Auth** — email and password, JWT access tokens valid 15 minutes. Stateless: normal requests never touch the database for identity, only the signature is checked. `user_id` comes from the token and never appears in a URL.

- **Refresh tokens** — random string valid 30 days, only its sha256 hash stored. Rotation on: the presented token is revoked and a new one issued, so a stolen copy dies the next time the real user opens the app. Reuse detection on: a revoked token presented again revokes every live row for that user.

- **Refresh races** — several requests hitting 401 at once would each trigger a refresh and falsely fire reuse detection. The client serialises them behind a single in-flight promise; the server reads the row `FOR UPDATE` so two rotations can't both succeed.

- **Session ending** — logout revokes that one row, a password change revokes all of them. An access token can't be revoked; the 15-minute window is accepted deliberately. Login inserts a row without touching existing ones, so several devices stay signed in at once.

- **Token storage** — SecureStore on mobile, httpOnly cookie on web, never localStorage. The access token is held in memory and re-fetched after a reload.

- **Areas** — user-defined top-level buckets (SWE, Finance, Social). Everything that gets tracked belongs to one. Area's weekly result is derived: every requirement under it must pass.

- **Habits** — behaviors you check off. No scheduling, no duration, no moving. `DAILY` (one checkbox per day) or `WEEKLY` (one checkbox per week, any day). No quota, no fixed weekdays.

- **Habit entries are sparse** — a row exists only when the user checks off. No row means not done; no MISSED, SKIPPED, or status column. Undo is a hard delete.

- **Habit mode is editable** — switching `DAILY` <-> `WEEKLY` doesn't corrupt history. Each entry carries its own `period_type`, so old rows stay readable at their original granularity.

- **Daily and weekly views** — the today screen holds both. Daily shows `DAILY` habits with the day's tasks underneath, ordered by start time; weekly shows `WEEKLY` habits on their own. One endpoint returns all three lists, the client switches between them. Quota progress lives in the area view, not here.

- **Goals** — weekly quotas ("3 CS Blocks a week"). The quota is user-entered, never inferred from how many tasks were created. `weekly_target` is nullable for goals the user schedules ad hoc.

- **Goal rules** — a goal can have several: `{Mon, Wed, Fri} 19:00, 60min` and `{Mon, Tue} 07:00, 60min` at the same time. Weekdays here are pre-fill, not a contract — once a task exists the rule stops binding it.

- **Tasks** — concrete scheduled work. Start time, duration, end time derived. Belongs to a goal, or standalone with no goal at all (dentist appointment).

- **Lazy task generation** — no upfront materialization of a year. Tasks for a week are created the first time that week is requested. Idempotent via `INSERT ... ON CONFLICT DO NOTHING`; the check is whether a `(rule_id, period_start)` row already exists, so no bookkeeping table is needed.

- **Background materialization** — a worker also materializes the next 24 hours every 5-15 minutes, so notifications work for users who haven't opened the app. Same `materialize(user_id, from, to)` function as the request path; only the trigger differs.

- **Occurrence identity** — `occurrence_date` records the date a rule produced and never changes. It's what stops a moved, cancelled, or deleted task from being regenerated. Independent from `scheduled_date`, which is where the user actually put it.

- **Postpone** — drag a task to another day. `scheduled_date` moves; `occurrence_date` and `period_start` stay fixed, so a task moved to next Monday still counts toward the week it belonged to.

- **Delete** — rule-generated tasks soft delete (`status = DELETED`) so the generator doesn't resurrect them. Manually added tasks hard delete, since nothing would regenerate them.

- **Extra tasks** — user can add beyond the rule (`rule_id` and `occurrence_date` NULL). Outside the unique index, so unlimited; still counts toward the week's quota via `period_start`.

- **Catch-up on return** — user away for 5 weeks sees all of it on return: every missing week is materialized, past weeks show what was missed, the current week is live and still editable. Bounded to ~12 weeks back so a two-year absence doesn't generate hundreds of weeks in one request.

- **Frozen history** — when a week closes, each requirement's `target` and `done` are snapshotted to `period_results`. Changing a quota from 3 to 2, adding a goal, or archiving one never rewrites a past week's pass or fail.

- **Live current week** — the open week is computed from raw rows, so changing a quota mid-week takes effect immediately. Only closed weeks are frozen.

- **Archive vs delete** — archiving stops generation and hides from active lists while keeping history intact; `archived_at` is a timestamp, not a flag, so past weeks know whether the item existed then. Deleting removes everything, including past results.

- **Push notifications** — reminder 5 minutes before a task starts. A `reminders` row is written at task creation with `scheduled_at` in UTC, updated on move, cancelled on delete. A scheduler scans due reminders every minute and pushes to registered device tokens via FCM/APNs.

- **Multi-device push** — a user can have several registered devices; a reminder fans out to all of their tokens. Invalid tokens are pruned on delivery failure.

- **Timezone-correct everywhere** — dates and times are stored local (`scheduled_date`, `start_time`); `users.timezone` holds an IANA name so DST is handled. The worker derives each user's "today" from their own timezone, not the server's UTC date. Reminder times are converted to UTC once, at write time.

- **Configurable week start** — `users.week_start_day` decides where the week boundary falls, and `period_start` is computed from it rather than assuming ISO Monday.
