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

Rules are included on each goal. An empty list means the goal has no repeating schedule; it can still receive ad-hoc tasks.

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

A rule is a pre-fill for generation, not a contract. `byweekday` is required; `start_time`, `duration_minutes` and `block_count` are nullable templates. Editing a rule can replace untouched `PENDING` tasks, but never rewrites tasks the user completed or moved.

#### POST /goals/{id}/rules

```json
{ "byweekday": [1, 3, 5], "start_time": "19:00", "duration_minutes": 60, "block_count": 2 }
```

**201**

```json
{ "id": "21", "goal_id": "7", "byweekday": [1, 3, 5], "start_time": "19:00", "duration_minutes": 60, "block_count": 2 }
```

The rule adds its tasks from today through the current window in the same request, copying its nullable time, duration and block values. A reminder is written only for a timed task. A non-null `block_count` is independent of `duration_minutes` and must be a positive multiple of 0.5.

A goal can hold several rules at once — `{Mon, Wed, Fri} 19:00` alongside `{Mon, Tue} 07:00`. `block_count: 2` still generates one task per occurrence; two different times on the same day still use two rules.

In the shared Today/Week task form, Repeat requires a goal. With Repeat off the client calls `POST /tasks`; with it on the client calls this endpoint instead and includes the form date's weekday, so the rule supplies the occurrence rather than creating a duplicate ad-hoc task. The task form shows only weekdays in its schedule section; full schedule values remain editable from the goal. When editing an existing task, the form turns Repeat on and off through `POST` and `DELETE /tasks/{id}/repeat`.

| Error | When |
|---|---|
| 404 `not_found` | no such goal |
| 422 `validation_error` | empty or out-of-range `byweekday`, a non-null `duration_minutes` below 1, or a non-null `block_count` that is not a positive multiple of 0.5 |

#### PATCH /rules/{id}

```json
{ "byweekday": [1, 4], "start_time": "20:00", "duration_minutes": 90, "block_count": 2 }
```

All fields optional. Send null for `start_time`, `duration_minutes` or `block_count` to clear it; `byweekday` cannot be null or empty.

**200** — the updated rule. Its untouched `PENDING` tasks are removed from the open week forward, including days before today. New tasks are added from today forward only and carry the updated `block_count`, so a newly selected weekday earlier in the open week stays empty. `DONE` tasks and tasks the user moved are kept unchanged; closed weeks are untouched.

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
  "duration_minutes": 60,
  "end_time": "20:00",
  "block_count": 2,
  "period_start": "2026-09-14",
  "status": "PENDING",
  "completed_at": null
}
```

The three dates mean different things and only one of them moves:

- `occurrence_date` — the date the rule produced. Never changes while the task belongs to its rule. Null for ad-hoc tasks. Only `POST` and `DELETE /tasks/{id}/repeat` set or clear it.
- `scheduled_date` — where the task sits now. This is what the calendar draws.
- `period_start` — the week the task counts toward. Fixed at generation, so postponing across a week boundary doesn't move the quota.
- `start_time`, `duration_minutes` and `block_count` — independent and nullable. `end_time` is present only when both time and duration exist. A null block value contributes zero when completed; otherwise it must be a positive multiple of 0.5.

There is no `GET /tasks`. Tasks are read through `/today` and `/week`.

#### POST /tasks

Ad-hoc task, created by the user rather than a rule.

```json
{
  "title": "Dentist",
  "scheduled_date": "2026-09-22",
  "start_time": "14:00",
  "duration_minutes": 45,
  "block_count": null,
  "goal_id": null
}
```

`goal_id` is optional. When present, `title` must be omitted; the server verifies the goal through its active area and copies its title. Without a goal, `title` is required and the task is standalone. `start_time`, `duration_minutes` and `block_count` are independently optional.

`scheduled_date` cannot be earlier than today in the user's timezone. There is no upper bound.

**201** — the created task. `rule_id` and `occurrence_date` are null; `period_start` is derived from `scheduled_date`. `end_time` is derived only when both `start_time` and `duration_minutes` are present.

| Error | When |
|---|---|
| 404 `not_found` | no such goal |
| 422 `validation_error` | `scheduled_date` is before today in the user's timezone, missing standalone title, a title supplied for a goal-linked task, a non-null `duration_minutes` below 1, or a non-null `block_count` that is not a positive multiple of 0.5 |

#### PATCH /tasks/{id}

```json
{ "title": "...", "scheduled_date": "2026-09-24", "start_time": "20:00", "duration_minutes": 30, "block_count": 2 }
```

All fields optional. Send null for `start_time`, `duration_minutes` or `block_count` to clear it. `title` is editable only on a standalone task. This is also how postpone works — send a new `scheduled_date`. A task update never changes its rule; the client patches the linked rule separately when schedule days are edited.

When supplied, `scheduled_date` cannot be earlier than today in the user's timezone. There is no upper bound.

**200** — the updated task. `occurrence_date` and `period_start` are unchanged whatever the new date is.

Changing a timed task updates its reminder. Clearing its time cancels the reminder; adding a time creates one.

| Error | When |
|---|---|
| 422 `validation_error` | the supplied `scheduled_date` is before today in the user's timezone, a non-null `duration_minutes` is below 1, or a non-null `block_count` is not a positive multiple of 0.5 |

#### DELETE /tasks/{id}

**204**

Rule-generated (`occurrence_date` set) is soft-deleted to `status = DELETED`, so the next run doesn't add it back. Ad-hoc (`occurrence_date` null) is hard-deleted, since nothing would recreate it.

Either way its reminder, if any, is cancelled.

#### POST /tasks/{id}/check

No body.

**200** — the task with `status: "DONE"` and `completed_at` set.

Completing a task already done is a no-op and returns the task unchanged.

#### DELETE /tasks/{id}/check

**200** — the task back at `status: "PENDING"`, `completed_at` null.

#### POST /tasks/{id}/repeat

Repeat on, from the edit form of a goal task that has no schedule.

```json
{ "byweekday": [4, 6] }
```

**200** — the task, now with `rule_id` set and `occurrence_date` equal to its current `scheduled_date`. A new rule on the task's goal copies the task's `start_time`, `duration_minutes` and `block_count`, then adds its tasks from today through the current window like `POST /goals/{id}/rules`. The task stands in for the rule's occurrence on its own date, so no duplicate is generated there.

| Error | When |
|---|---|
| 404 `not_found` | no such task, or it sits under an archived area |
| 422 `validation_error` | the task is standalone (`goal_id`), already repeats (`rule_id`), or `byweekday` is empty, out of range or misses the task's own weekday |

#### DELETE /tasks/{id}/repeat

Repeat off, from the edit form of a repeating task.

**200** — the task, kept as an ad-hoc task with `rule_id` and `occurrence_date` null. Its rule is deleted as `DELETE /rules/{id}` does: the rule's untouched pending tasks from the open week forward go with it, while tasks already done, tasks the user moved and closed weeks stay.

| Error | When |
|---|---|
| 404 `not_found` | no such task, or it sits under an archived area |
| 422 `validation_error` | the task does not repeat (`rule_id`) |

---

### Views

These two take their shape from the screens. `/today` is settled by the today screen built in slice 2; `/week` stays a draft until the calendar is built.

Neither adds anything. Tasks are on screen because a rule write created them, or because the daily job did. Both endpoints read what exists — except for a user returning after the daily job stopped running for them, whose window is added once before the first read.

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
      "rule_id": "21",
      "title": "CS Block",
      "start_time": "19:00",
      "duration_minutes": 60,
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

Timed tasks are ordered by `start_time`, followed by untimed tasks; `DELETED` is excluded. Anything under an archived area is excluded.

#### GET /week

The calendar screen: seven days side by side. It can show only the user's current week and the following week; the client offers no navigation before the current week or beyond the following week.

| Query | Default |
|---|---|
| `start` | the current week's `period_start` |

Any date inside the current or following week works — the server resolves it to `period_start`. A past week or a week after the following week is rejected. The boundary uses today and `week_start_day` in the user's timezone.

**200**

```json
{
  "period_start": "2026-09-14",
  "days": [
    { "date": "2026-09-14", "tasks": [ ... ] },
    { "date": "2026-09-15", "tasks": [] }
  ],
  "later_tasks": {
    "count": 2,
    "items": [
      { "scheduled_date": "2026-09-28", "start_time": "14:00", "title": "Dentist" },
      { "scheduled_date": "2026-10-03", "start_time": null, "title": "CS Block" }
    ]
  }
}
```

`days` always holds seven entries in order, so the client draws columns without knowing `week_start_day`. Task objects are the same shape as in `/today`.

`later_tasks` makes tasks after the following week's end visible without letting the calendar navigate there. `count` and `items` come from this one read, and `count` always equals the number of items. Items are ordered by `scheduled_date`, then timed tasks by `start_time`, then untimed tasks. They contain only the date, nullable time and title needed by the simple bullet list.

The list includes non-deleted ad-hoc tasks (`occurrence_date` is null) and rule-generated tasks the user moved there (`scheduled_date != occurrence_date`). Untouched occurrences generated automatically by rules are excluded. The normal visibility rule still applies: tasks under an archived area are excluded.

The shared task form always includes `scheduled_date`. On Today it displays today and is disabled. On Week it is editable with today as its minimum and no maximum. Clicking a today-or-future calendar slot opens the form with that slot's date and time; elapsed slots in the current week remain visible but do not create tasks. The header add-task button opens the form with today's date.

Habits are not in this response — the calendar shows scheduled work only.

| Error | When |
|---|---|
| 422 `validation_error` | `start` resolves to a past week or a week after the following week |

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

For goals, `target` is `weekly_target` in blocks and `done` is `COALESCE(SUM(block_count), 0)` across completed tasks in the period, not `COUNT(*)` — so null blocks contribute zero and `done` can be fractional, such as 2.5.

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
