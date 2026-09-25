## API Contract

Base path `/api/v1`. Every endpoint except `/auth/register`, `/auth/login` and `/auth/refresh` requires `Authorization: Bearer <access_token>`.

### Conventions

**Error response**

Every error uses the same shape. `code` is stable and machine-readable; `message` is for humans and may change.

```json
{ "code": "email_taken", "message": "Email already registered" }
```

Validation errors carry an extra `fields` object:

```json
{
  "code": "validation_error",
  "message": "Request body is invalid",
  "fields": { "email": "invalid format" }
}
```

Errors are raised as application exception classes and rendered by one handler. Routes never raise `HTTPException` directly.

**IDs**

`bigint` in the database, string in JSON — `"id": "12"`. JavaScript numbers are only safe to 2^53; strings avoid the question entirely and cost nothing.

**Timestamps**

Two different things, don't mix them:

- Instants (`created_at`, `completed_at`, `scheduled_at`) — UTC, ISO-8601 with `Z`: `"2026-09-19T07:30:00Z"`
- Local dates and times (`scheduled_date`, `occurrence_date`, `period_start`, `start_time`, `end_time`) — no timezone, they mean what the user's calendar says: `"2026-09-19"`, `"19:00"`

**Common errors**

| Status | When |
|---|---|
| 401 | missing, expired or invalid access token |
| 404 | resource does not exist, or belongs to another user |
| 409 | uniqueness conflict |
| 422 | request body fails validation |

---

### Auth

The access token and refresh token are returned in the response body. The same refresh token is also set as an httpOnly cookie. Mobile stores the body value in SecureStore; web ignores the body value and uses the cookie. Returning the refresh token in both places weakens the benefit of httpOnly for web and is a deliberate temporary decision while both clients share one auth surface.

Before the web client reaches production, the shared auth surface will be split into web and mobile HTTP contracts. Web endpoints will return refresh tokens only through httpOnly cookies; mobile endpoints will return them in the response body. Both contracts will continue using the same `AuthService` and business logic.

#### POST /auth/register

```json
{ "email": "deniz@example.com", "password": "...", "timezone": "Europe/Istanbul" }
```

`timezone` is an IANA name read from the browser or device, not asked for. `week_start_day` defaults to 1.

**201**

```json
{ "access_token": "eyJhbGci...", "refresh_token": "8f3a9c2e...", "token_type": "bearer" }
```

| Error | When |
|---|---|
| 409 `email_taken` | that email already has an account |
| 422 `validation_error` | bad email format, password too short, unknown timezone |

#### POST /auth/login

```json
{ "email": "deniz@example.com", "password": "..." }
```

**200** — same body as register.

| Error | When |
|---|---|
| 401 `invalid_credentials` | wrong email or password — the same code for both, so the response doesn't reveal which emails exist |

#### POST /auth/refresh

```json
{ "refresh_token": "8f3a9c2e..." }
```

Omitted on web, where the token travels as a cookie.

**200** — a new access token and a new refresh token; the presented one is revoked.

```json
{ "access_token": "eyJhbGci...", "refresh_token": "1d7b4e9a...", "token_type": "bearer" }
```

| Error | When |
|---|---|
| 401 `invalid_token` | unknown, revoked or expired — the client goes back to login |

A revoked token presented again revokes every live token for that user. Same response, so an attacker learns nothing.

#### POST /auth/logout

```json
{ "refresh_token": "8f3a9c2e..." }
```

**204** — that token is revoked. The access token stays valid until it expires.

Already-invalid tokens also return 204; logout is idempotent.

---

### Profile

Called from the profile screen, not on startup. Nothing else in the app needs the user object — endpoints that depend on `timezone` or `week_start_day` read them server-side.

#### GET /me

**200**

```json
{
  "id": "1",
  "email": "deniz@example.com",
  "timezone": "Europe/Istanbul",
  "week_start_day": 1,
  "created_at": "2026-09-19T07:30:00Z"
}
```

#### PATCH /me

Both fields optional; send only what changes.

```json
{ "timezone": "Europe/Berlin", "week_start_day": 7 }
```

**200** — the updated user, same shape as GET.

| Error | When |
|---|---|
| 422 `validation_error` | unknown IANA timezone, or `week_start_day` outside 1-7 |

Changing `week_start_day` mid-week shifts the boundary under tasks that already carry a `period_start` computed from the old value, so the open week's quota stops matching. Unresolved — decide in slice 3.

---

### Areas

An area object:

```json
{
  "id": "3",
  "name": "SWE",
  "archived_at": null,
  "unarchived_at": null,
  "created_at": "2026-09-01T09:00:00Z"
}
```

#### GET /areas

| Query | Default |
|---|---|
| `include_archived` | `false` |

**200**

```json
{ "areas": [ { "id": "3", "name": "SWE", "archived_at": null, "unarchived_at": null, "created_at": "..." } ] }
```

Ordered by `created_at`.

#### POST /areas

```json
{ "name": "Finance" }
```

**201** — the created area.

| Error | When |
|---|---|
| 409 `area_name_taken` | the user already has an area with that name |
| 422 `validation_error` | empty name, or longer than 60 characters |

#### GET /areas/{id}

**200** — the area.

#### PATCH /areas/{id}

```json
{ "name": "Software" }
```

**200** — the updated area. Only `name` is editable; archiving has its own endpoint.

#### POST /areas/{id}/archive

```json
{ "archived": true }
```

**200** — the updated area. `archived: true` sets `archived_at` to now; `archived: false` clears it and sets `unarchived_at` to now.

Archiving stops task generation for every goal under the area, hides it and everything under it from the active lists, and removes its future pending tasks and their reminders. The habits, goals and rules themselves are untouched, so restoring brings them back as they were.

Restoring does not bring back the removed tasks. Generation resumes from today forward, so the archived days stay empty. Past weeks are untouched; `archived_at` and `unarchived_at` tell each week which days the area was active.

Areas are the only thing that archives. Habits and goals have delete only.

#### DELETE /areas/{id}

**204** — the area and everything under it: habits with their entries, goals with their rules and tasks. Its `period_results` rows stay, so past weeks keep reading correctly. Not recoverable.

Active and archived areas can both be deleted. The client asks for confirmation with a strong warning that names what goes with the area — its habits, goals and all of their history — and offers archive as the reversible way to put an area down.

---

### Habits

A habit object:

```json
{
  "id": "12",
  "area_id": "3",
  "title": "Read",
  "mode": "DAILY",
  "created_at": "2026-09-01T09:00:00Z"
}
```

`mode` is `DAILY` or `WEEKLY`.

#### GET /habits

| Query | Default |
|---|---|
| `area_id` | all areas |

Habits in an archived area are not returned.

**200**

```json
{ "habits": [ { "id": "12", "area_id": "3", "title": "Read", "mode": "DAILY", "created_at": "..." } ] }
```

#### POST /habits

```json
{ "area_id": "3", "title": "Read", "mode": "DAILY" }
```

**201** — the created habit.

| Error | When |
|---|---|
| 404 `not_found` | no such area, or it belongs to another user |
| 422 `validation_error` | empty title, or `mode` not `DAILY`/`WEEKLY` |

#### PATCH /habits/{id}

```json
{ "title": "Read 20 pages", "mode": "WEEKLY", "area_id": "4" }
```

All fields optional.

**200** — the updated habit.

Changing `mode` does not touch existing entries: each one carries its own `period_type`, so old rows stay readable at the granularity they were written with.

#### DELETE /habits/{id}

**204** — the habit and all its entries. Its `period_results` rows stay, so past weeks keep reading correctly. The day-level history goes with the entries. Not recoverable.

Habits do not archive. Dropping one is a delete.

#### POST /habits/{id}/check

```json
{ "date": "2026-09-19" }
```

The date the user is checking off. For a `WEEKLY` habit any date in the week works — the server resolves it to that week's `period_start`.

**201**

```json
{ "habit_id": "12", "period_type": "DAY", "period_start": "2026-09-19", "completed_at": "2026-09-19T07:30:00Z" }
```

| Error | When |
|---|---|
| 404 `not_found` | no such habit |
| 409 `already_checked` | already checked off for that period |

#### DELETE /habits/{id}/check

| Query | Required |
|---|---|
| `date` | yes |

**204** — the entry is hard-deleted. Undo leaves no trace; a missing row means not done.

Deleting an entry that isn't there also returns 204.

---

### Goals

A goal object, with its rules embedded:

```json
{
  "id": "7",
  "area_id": "3",
  "title": "CS Block",
  "weekly_target": 3,
  "created_at": "2026-09-01T09:00:00Z",
  "rules": [
    { "id": "21", "byweekday": [1, 3, 5], "start_time": "19:00", "duration_minutes": 60, "block_count": 2 }
  ]
}
```

`weekly_target` is measured in whole blocks. It is null for goals the user schedules ad hoc — those have no quota, so they never fail a week. Completed blocks can include halves (see `block_count`), so a week's `done` can be 2.5 against a target of 3.

`byweekday` is 1 (Monday) to 7 (Sunday), independent of the user's `week_start_day`.

#### GET /goals

| Query | Default |
|---|---|
| `area_id` | all areas |

Goals in an archived area are not returned.

**200**

```json
{ "goals": [ ... ] }
```

Rules are included on each goal — a goal without them is not useful to display.

#### POST /goals

```json
{ "area_id": "3", "title": "CS Block", "weekly_target": 3 }
```

**201** — the created goal, `rules` empty. Rules are added separately; a goal without rules generates nothing.

| Error | When |
|---|---|
| 404 `not_found` | no such area |
| 422 `validation_error` | empty title, or `weekly_target` below 1 |

#### GET /goals/{id}

**200** — the goal with its rules.

#### PATCH /goals/{id}

```json
{ "title": "CS Block", "weekly_target": 2, "area_id": "4" }
```

All fields optional. Send `weekly_target: null` to drop the quota.

**200** — the updated goal.

Lowering `weekly_target` takes effect on the open week immediately. Closed weeks in `period_results` keep the target they were judged against.

#### DELETE /goals/{id}

**204** — the goal, its rules, all its tasks and their reminders. Its `period_results` rows stay, so past weeks keep reading correctly. Old calendars lose the goal's blocks.

Goals do not archive. Dropping one is a delete.

---

### Goal rules

A rule is a pre-fill for generation, not a contract. Once a task exists the rule no longer binds it — editing the rule does not move or delete tasks already generated.

#### POST /goals/{id}/rules

```json
{ "byweekday": [1, 3, 5], "start_time": "19:00", "duration_minutes": 60, "block_count": 2 }
```

**201**

```json
{ "id": "21", "goal_id": "7", "byweekday": [1, 3, 5], "start_time": "19:00", "duration_minutes": 60, "block_count": 2 }
```

The rule adds its tasks and reminders for the current window in the same request, copying `block_count` to every generated task, so today's block is on screen as soon as it is saved. `block_count` defaults to 1 and is independent of `duration_minutes`. It is a positive multiple of 0.5 — half a block is the smallest unit — and the client offers 0.5, 1, 2 and 4.

A goal can hold several rules at once — `{Mon, Wed, Fri} 19:00` alongside `{Mon, Tue} 07:00`. `block_count: 2` still generates one task per occurrence; two different times on the same day still use two rules.

| Error | When |
|---|---|
| 404 `not_found` | no such goal |
| 422 `validation_error` | empty or out-of-range `byweekday`, `duration_minutes` below 1, or `block_count` not a positive multiple of 0.5 |

#### PATCH /rules/{id}

```json
{ "byweekday": [1, 4], "start_time": "20:00", "duration_minutes": 90, "block_count": 2 }
```

All fields optional.

**200** — the updated rule. The tasks it produced are removed from the open week forward and added again in the same request; newly added tasks carry the updated `block_count`. `DONE` tasks and tasks the user moved are kept unchanged; closed weeks are untouched.

#### DELETE /rules/{id}

**204** — the rule, and its untouched pending tasks from the open week forward. Tasks already done, tasks the user moved, and everything in closed weeks stay and keep counting toward their weeks.

---

### Tasks

A task object:

```json
{
  "id": "481",
  "goal_id": "7",
  "rule_id": "21",
  "title": "CS Block",
  "occurrence_date": "2026-09-16",
  "scheduled_date": "2026-09-17",
  "start_time": "19:00",
  "end_time": "20:00",
  "block_count": 2,
  "period_start": "2026-09-14",
  "status": "PENDING",
  "completed_at": null
}
```

The three dates mean different things and only one of them moves:

- `occurrence_date` — the date the rule produced. Immutable. Null for ad-hoc tasks.
- `scheduled_date` — where the task sits now. This is what the calendar draws.
- `period_start` — the week the task counts toward. Fixed at generation, so postponing across a week boundary doesn't move the quota.
- `block_count` — how many blocks the task contributes when completed: a positive multiple of 0.5, independent of the task's duration.

There is no `GET /tasks`. Tasks are read through `/today` and `/week`.

#### POST /tasks

Ad-hoc task, created by the user rather than a rule.

```json
{
  "title": "Dentist",
  "scheduled_date": "2026-09-22",
  "start_time": "14:00",
  "duration_minutes": 45,
  "block_count": 2,
  "goal_id": "7"
}
```

`goal_id` optional — attach it to count toward that goal's quota, or leave it out for something standalone. `block_count` defaults to 1.

**201** — the created task. `rule_id` and `occurrence_date` are null; `period_start` is derived from `scheduled_date`; `end_time` from `start_time + duration_minutes`.

| Error | When |
|---|---|
| 404 `not_found` | no such goal |
| 422 `validation_error` | empty title, `duration_minutes` below 1, or `block_count` not a positive multiple of 0.5 |

#### PATCH /tasks/{id}

```json
{ "title": "...", "scheduled_date": "2026-09-24", "start_time": "20:00", "duration_minutes": 30, "block_count": 2 }
```

All fields optional. This is also how postpone works — send a new `scheduled_date`. Changing `block_count` updates only this task; its rule is unchanged.

**200** — the updated task. `occurrence_date` and `period_start` are unchanged whatever the new date is.

Moving a task also moves its reminder.

#### DELETE /tasks/{id}

**204**

Rule-generated (`occurrence_date` set) is soft-deleted to `status = DELETED`, so the next run doesn't add it back. Ad-hoc (`occurrence_date` null) is hard-deleted, since nothing would recreate it.

Either way the reminder is cancelled.

#### POST /tasks/{id}/complete

No body.

**200** — the task with `status: "DONE"` and `completed_at` set.

Completing a task already done is a no-op and returns the task unchanged.

#### DELETE /tasks/{id}/complete

**200** — the task back at `status: "PENDING"`, `completed_at` null.

---

### Views

These two take their shape from the screens. `/today` is settled by the today screen built in slice 2; `/week` stays a draft until the calendar is built.

Neither adds anything. Tasks are on screen because a goal or rule write created them, or because the daily job did. Both endpoints read what exists — except for a user returning after the daily job stopped running for them, whose window is added once before the first read.

#### GET /today

The today screen: a daily view with habits and the day's tasks, and a weekly view with weekly habits. One request returns all three lists; the client switches between the two views.

| Query | Default |
|---|---|
| `date` | today in the user's timezone |

**200**

```json
{
  "date": "2026-09-19",
  "week_start": "2026-09-14",
  "week_end": "2026-09-20",
  "daily_habits": [
    { "id": "12", "title": "Read", "area_id": "3", "done": true }
  ],
  "weekly_habits": [
    { "id": "15", "title": "Call home", "area_id": "5", "done": false }
  ],
  "tasks": [
    {
      "id": "481",
      "goal_id": "7",
      "title": "CS Block",
      "start_time": "19:00",
      "end_time": "20:00",
      "block_count": 2,
      "status": "PENDING",
      "scheduled_date": "2026-09-19",
      "occurrence_date": "2026-09-16",
      "period_start": "2026-09-14"
    }
  ]
}
```

`done` is derived: an entry exists for that period. `daily_habits` resolves against the date; `weekly_habits` against the week that date falls in.

`week_start` and `week_end` bound the week `date` falls in, using the user's `week_start_day`. The weekly view labels itself with them, so the client never computes a week boundary. To check off or undo a habit shown here, the client sends this response's `date`; the server resolves it to the habit's day or week.

**Open until slice 3:** the implemented endpoint always returns `tasks: []`, and its task shape has no `block_count` yet. Slice 3 (plan item 23) fills the list and adds the field; the example above already shows the slice 3 shape.

Tasks are ordered by `start_time`, `DELETED` excluded. Anything under an archived area is excluded.

#### GET /week

The calendar screen: seven days side by side.

| Query | Default |
|---|---|
| `start` | the current week's `period_start` |

Any date inside the week works — the server resolves it to `period_start`. Weeks beyond the generated window return empty days until the window reaches them.

**200**

```json
{
  "period_start": "2026-09-14",
  "days": [
    { "date": "2026-09-14", "tasks": [ ... ] },
    { "date": "2026-09-15", "tasks": [] }
  ]
}
```

`days` always holds seven entries in order, so the client draws columns without knowing `week_start_day`. Task objects are the same shape as in `/today`.

Habits are not in this response — the calendar shows scheduled work only.

---

### Results

#### GET /areas/{id}/results

Weekly history for one area — the pass/fail strip on the area screen.

| Query | Default |
|---|---|
| `weeks` | 8 |

Counts back from the current week.

**200**

```json
{
  "area_id": "3",
  "weeks": [
    {
      "period_start": "2026-09-14",
      "open": true,
      "passed": false,
      "requirements": [
        { "ref_type": "GOAL", "ref_id": "7", "title": "CS Block", "target": 3, "done": 1 },
        { "ref_type": "HABIT", "ref_id": "12", "title": "Read", "target": 7, "done": 5 }
      ]
    },
    {
      "period_start": "2026-09-07",
      "open": false,
      "passed": true,
      "requirements": [ ... ]
    }
  ]
}
```

Newest week first.

`open` marks the current week — computed live from raw rows, so it moves as the week goes. Closed weeks come from `period_results` and never change.

`passed` is derived: every requirement satisfies `done >= target`. On an open week it reflects where things stand right now.

For goals, `target` is `weekly_target` in blocks and `done` is `SUM(block_count)` across completed tasks in the period, not `COUNT(*)` — so `done` can be fractional, such as 2.5.

`title` is snapshotted alongside `target` and `done`, so a week still reads correctly after the habit or goal is renamed or deleted. `ref_id` is not a foreign key — it identifies the row for the unique constraint, nothing more.

A requirement appears for a week only if it was active for at least one day of it. Active days run from `max(period_start, created_at, area.unarchived_at)` to `min(week_end, area.archived_at)`. A `DAILY` habit's `target` is that day count, so one added mid-week is judged on the remaining days; `WEEKLY` habits stay 1. Goals with no `weekly_target` are left out; they have no quota to fail.

A habit or goal deleted mid-week leaves that week with no row for it — it is neither passed nor failed, it is simply not a requirement any more.

A week with no active day for a requirement carries no row for it, and the client draws those days as neither done nor missed.

Closed weeks are snapshotted by the scheduled rollup at the week turn in the user's timezone. Reads never write.

---

### Devices

Push registration. The token comes from FCM or APNs, not from this API — it's the address the scheduler sends notifications to.

#### POST /devices

```json
{ "platform": "IOS", "token": "fH9a2k7x..." }
```

Sent when the client obtains a token: on first launch, and whenever the SDK reports a new one. Upserted on `(user_id, token)`, and `last_seen_at` is refreshed on every call — that timestamp is how the scheduler knows the device is still alive.

`platform` is `IOS`, `ANDROID` or `WEB`.

**201**

```json
{ "id": "9", "platform": "IOS", "created_at": "...", "last_seen_at": "..." }
```

The token is not echoed back.

#### DELETE /devices/{id}

**204** — the device stops receiving notifications. Called on logout.

Devices are also pruned server-side when FCM or APNs reports the token as invalid.
