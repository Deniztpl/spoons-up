# Plan — Spoons Up

Vertical slices. Each slice cuts through every layer — migration, service, endpoint, client, screen — and ends with something usable.

Slice 0 is a walking skeleton: the thinnest end-to-end path that links every architectural piece, built to validate the setup before any feature work.

One slice at a time. Finish it, use it by hand, commit, move on.

---

## Slice 0 — Walking skeleton — DONE

1. `apps/api`: uv, FastAPI, Postgres compose, Alembic
2. Error contract — one exception class per failure kind, rendered as `{ code, message }`
3. `users` and `refresh_tokens` migration
4. Auth helpers — password hashing, JWT issue and verify, refresh rotation, `current_user` dependency
5. `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
6. `openapi.json` export command
7. `spoons-up`: pnpm workspace, `apps/web`, `packages/api-client` generated from the contract
8. Web: login and register screens, token storage, refresh interceptor
9. Shell layout — header, left column, content area
10. **Done when:** register in the browser, reload the page, still signed in

## Slice 1 — Areas — DONE

- Docker setup: database, migrations, API and web start with one Compose command — DONE

11. `areas` migration, CRUD endpoints scoped to the token's user — DONE
12. Web: header domain selector with Goals & Habits active and Nutrition/Fitness disabled as coming soon; left-column page navigation for the selected domain with Areas active and future Today/Week pages disabled; area list, create, selection and rename in the Areas page content — DONE

- `unarchived_at`, archive and restore behaviour, and the archive, restore and confirmed-delete UI — DONE

13. **Done when:** areas created in the browser appear after a reload; another user's area returns 404

## Slice 2 — Habits — DONE

14. `habits` and `habit_entries` migration, CRUD — DONE
15. Check off and undo — a row on check, hard delete on undo — DONE
16. `GET /today?date=` returning daily habits, weekly habits and tasks (tasks empty for now), plus `week_start` and `week_end` for the weekly view's label — DONE
17. Web: today screen with the daily/weekly switch, habit rows with checkboxes — DONE
   - Today is the landing page after sign-in — DONE
   - Habits are added, edited and deleted from the area panel in a modal — DONE
   - An active area can be deleted from its menu after a strong warning; archive stays the reversible option — DONE
18. **Done when:** a habit is checked off in the browser and survives a reload; checking twice in one period is rejected — DONE

## Slice 3 — Goals and task generation — DONE

19. `goals` and `goal_rules` migration, CRUD; `weekly_target` is in whole blocks and each rule has `block_count` defaulting to 1. `block_count` is a positive multiple of 0.5 (`numeric(3,1)` with a check); the client offers 0.5, 1, 2 and 4 — DONE
20. Period math — timezone + `week_start_day` -> `period_start`. Standalone, no DB, tested. — DONE
21. `tasks` migration with `block_count` defaulting to 1, a positive multiple of 0.5 as on rules; `users.last_seen_at`, refreshed on each authenticated request, so the daily job skips users not seen for 30 days and their first request back adds the window — DONE
22. `add_tasks(user_id, from, to)` — expand rules into dates, copy each rule's `block_count` to its tasks, and insert idempotently. Called by rule writes for their own range, and by an hourly cron running the daily job that advances a rolling 14-day window per user timezone. Reads never call it. A rule change removes that rule's untouched `PENDING` tasks from the open week forward, including past days in that week, but adds the new tasks from today forward only — DONE
23. `/today` returns the day's tasks with `block_count`, ordered by `start_time` — DONE
24. Complete and uncomplete a task — DONE
25. Web: goal form with rules — weekdays, start time, duration and `block_count` (0.5, 1, 2, 4) — and task blocks on the today screen — DONE
   - Goals are added, edited and deleted from the area panel in a modal, listed above the habits — DONE
   - A save sends only what changed: a rule write redraws that rule's pending tasks, so an unchanged rule is never written. If one request fails, what was saved stays and a retry sends the rest — DONE
   - "Add goal" on the today screen opens the same form with an area choice — DONE
   - The day's tasks sit above the habits, as in the Today v2 design, each as tall as its `block_count`, with a progress rail beside them; they are completed and undone there — DONE
   - Changing a task's `block_count` from the today screen waits for `PATCH /tasks/{id}` in slice 4 and is marked `TODO(slice-4)`
26. **Done when:** a goal created in the browser produces today's task, and completing it holds after a reload — DONE

## Slice 3 fix — Tasks and schedules — DONE

- New goals start without a schedule; Repeat reveals one or more schedules. Rules require weekdays, while time, duration and `block_count` are nullable — DONE
- Today replaces "Add goal" with "Add task": choose `Area - Goal` from one goal field for goal work, or choose `No goal` and enter a standalone title. Time, duration and `block_count` are optional — DONE
- Add `tasks.duration_minutes`; make task time, end time and `block_count` nullable. Null blocks contribute zero to weekly progress — DONE
- Add, edit and delete tasks from Today. A task edit changes only that task; its linked schedule days are edited separately and keep the existing regeneration rules — DONE
- **Done when:** goal-linked, standalone, timed and untimed tasks can be created from Today and survive a reload — DONE

## Slice 4 — Calendar — DONE

### Block 1 — Task date rules — DONE

- `POST /tasks` rejects a `scheduled_date` before today in the user's timezone with 422
- `PATCH /tasks/{id}` does the same when `scheduled_date` is supplied
- Today and future dates are allowed; there is no upper date limit
- Moving a task changes only `scheduled_date`; `occurrence_date` and `period_start` stay fixed

### Block 2 — Week read API — DONE

- Add `GET /week?start=` with seven ordered day entries and their tasks
- Accept only the user's current week or following week; reject past weeks and the third week onward with 422
- Resolve week boundaries on the server from the user's timezone and `week_start_day`
- Return `later_tasks` in the same response, with both `count` and the complete date/time/title list for tasks after the following week
- Include ad-hoc tasks and rule-generated tasks the user moved; exclude untouched occurrences generated automatically by rules

### Block 3 — Shared task form — DONE

- Add `scheduled_date` to the form shared by Today and Week
- On Today, show today and disable the date field
- On Week, allow the date to change from today onward with no maximum
- Allow callers to open the form with a prefilled date and optional time, ready for Week's slot and header entry points
- Keep Repeat, goal selection, standalone title, time, duration and block behaviour shared with Today

### Block 4 — Week calendar interactions — DONE

- Add the Week route, page and active sidebar navigation
- Show the current week first and allow navigation only to the following week and back
- Keep elapsed slots in the current week visible but unavailable for task creation or moving
- Wire a today-or-future slot click to the shared form with the clicked date and time; wire the header add-task button with today's date
- Move tasks by drag or date selection through `PATCH /tasks/{id}`
- Edit tasks with the shared form and expose the existing delete behaviour: soft delete for rule-generated tasks, hard delete for ad-hoc tasks
- Show a small info button when `later_tasks.count > 0`; display the response's date, optional time and title items as a simple bullet list when opened; choosing an item opens the shared task form to edit or delete it

### Block 4b — Repeat while editing — DONE

- `POST /tasks/{id}/repeat` turns an ad-hoc goal task into the first occurrence of a new rule built from its time, duration and blocks; the task's own weekday is required, so no duplicate is generated
- `DELETE /tasks/{id}/repeat` ends a task's schedule: the task stays as an ad-hoc task and the rule goes, as `DELETE /rules/{id}` does
- The shared form shows Repeat when editing any goal task; weekday edits on an existing schedule still use `PATCH /rules/{id}`

### Block 5 — Verification — DONE

- API tests cover both allowed weeks, rejected week navigation, custom week starts and user timezones
- API tests cover past-date rejection and confirm that a patch without `scheduled_date` can still update another field
- API tests cover `later_tasks` count, ordering and inclusion/exclusion rules
- Web tests cover both form entry points, Today's disabled date, Week's minimum date, limited navigation, moving/deleting tasks and the later-task info list
- **Done when:** a task moved across a week boundary still counts toward its original week; past and third-week navigation are unavailable; a manually placed task after next week appears in the info count and list while an untouched generated occurrence does not

## Slice 5 — Weekly progress and Growth — DONE

The Areas screen and Today show the open week live; Growth shows closed weeks frozen in `period_results`. Both read the same per-area shape: requirements with `target` and `done`, a percent where every requirement counts equally, and seven day squares from `DAILY` habits.

### Block 1 — Live weekly progress — DONE

- `GET /progress` computes the open week for every active area with at least one requirement
- Requirements follow active days: a `DAILY` habit's target is its active days, a `WEEKLY` habit's is 1, a goal keeps its full `weekly_target`; goals with no `weekly_target` are left out
- A goal's `done` is the sum of `block_count` over its completed tasks counted by `period_start`, so it can be fractional
- Percent: each requirement contributes `min(done / target, 1)`; the area averages its requirements and the week averages its areas
- Day squares: a day is done when every `DAILY` habit active that day was checked
- API tests cover mid-week additions, archive and restore inside a week, fractional blocks, the 100% cap, goals without a target, the squares and custom week starts

### Block 2 — Frozen weeks and the Growth read — DONE

- `period_results` migration; `area_id` is nullable with `ON DELETE SET NULL`, so rows outlive their area
- The hourly job snapshots each user's closed week at the week turn in their timezone and writes any closed week it missed; repeated runs write nothing new
- `GET /growth` reads closed weeks from `period_results`, newest first, 12 at a time back to the signup week; day squares come from habit entries
- API tests cover timezones, custom week starts, repeated runs, a missed week turn and an area delete that keeps its rows

### Block 3 — Areas screen — DONE

- Area rows show the week's seven day dots and percent bar from `/progress`
- The area panel shows seven day bars, the percent, met/total, and the weekly done state on its goals and habits
- Progress refreshes after goals, habits and areas change

### Block 4 — Today week panel — DONE

- The right panel shows this week's met/total per area from `/progress`, as tiles (Today v2 design, variant B)
- It refreshes after tasks and habits are checked

### Block 5 — Growth screen — DONE

- The History tab becomes a Growth button at the top right of the Areas header; the tabs are Active and Archived
- Week cards from `/growth`, newest first, with the week label, the area count and the week's percent bar
- An open card lists each area with its day squares, goals met/total, habits met/total and percent; an area row opens a card listing each goal and habit with its done/target and its own percent
- Area filter chips narrow the cards to one area on the client
- A Show older weeks button loads the next 12 weeks until the signup week

### Block 6 — Verification — DONE

- Web tests cover the area rows and panel, Today's week panel and the Growth cards and filter
- **Done when:** a closed week's outcome does not move after `weekly_target` is changed, and the same week reads the same percent on the Areas screen before it closes and on Growth after

## Slice 6 — Journal — DONE

Goal tasks keep their existing rules and area progress. Every goal-less task is Journal work, whether it was created in Journal, Today or Week. The visual reference is the Journal portion of the design files, adapted to the current web shell and the newer Today and Week implementations; Areas and Growth do not change.

### Block 0 — Canonical documentation — DONE

- Merge `journal-context.md` into `design.md`, `api-contract.md` and this plan before application code
- Settle `GET /journal`, keep Left behind inside `/today`, and settle active, undated, completed and left-behind ordering
- Move Notifications to slice 7

### Block 1 — Task data model and domain rules — DONE

- Add nullable `tasks.due_date` and self-FK `parent_id ON DELETE CASCADE`; make `scheduled_date` and `period_start` nullable together
- Add database checks for goal schedules, schedule/period nullability, time requiring a schedule, top-level-only due dates and goal-less steps; index `parent_id`
- Extend task create and update for unscheduled Journal items, due-date synchronization and title-only step creation; validate parent ownership and one-level nesting
- Derive `period_start` the first time Journal work is scheduled, preserve it while moved, and clear it when unscheduled
- Completing a top-level item with open steps leaves them pending but clears their schedule, period and time in the same transaction; deleting the item cascades to its steps
- API tests cover every field combination, timezone-aware past-date rejection, due changes, step nesting, completion cleanup, deletion and existing goal-task regressions

### Block 2 — Journal read API — DONE

- Add `GET /journal` with the user's local today, complete active and completed top-level lists, nested steps and step progress
- Read parents and steps without per-item queries and scope every row by the authenticated user
- Active ordering is due date, non-null time, creation and id, then undated creation order; completed ordering is newest completion first; steps keep creation order
- Regenerate `apps/api/openapi.json` and `packages/api-client/src/generated/schema.d.ts`

### Block 3 — Journal page — DONE

- Add the Journal route and sidebar destination without changing the Areas screen
- Build the ungrouped Active / Completed list with counts, due-date emphasis, time and step progress in the current app's visual and responsive system
- Reuse one detail component for existing and new items: title, optional due date and time, inline step create/check/delete, complete or reopen, and confirmed delete
- Confirm completion when steps remain open; show saved partial results and retryable errors rather than discarding successful writes
- Web tests cover loading, errors, empty states, ordering, keyboard step entry, progress, CRUD, completion confirmation, reopening and focus behavior

### Block 4 — Separate Goal and Journal task entry — DONE

- Replace the shared `No goal` task form with separate Goal and Journal components used by both Today and Week; Today switches to them in block 5 and Week in block 7, which removes the `No goal` choice
- Editing a task already on a day keeps one form for both kinds, as goal tasks are edited: a Journal task shows its title instead of a goal and has no Repeat
- Goal requires `Area - Goal`, keeps the goal title, schedule and Repeat behavior
- Journal starts with `+ New task`, then the first five open-item rows with `Show all (N)` when needed; an item with steps drills into only its open steps and is not itself selectable
- Journal has no search or combined New / Journal tabs; its plan section owns optional time, duration and blocks
- Load Journal choices when the component opens and keep independent reads parallel; add no client state or query dependency

### Block 5 — Today integration — DONE

- Put `+ Goal` and `+ Journal` in the Today header and remove the old combined add-task entry
- Creating a Journal task writes one goal-less task for today; choosing an item or step patches that existing row
- Extend scheduled task responses with a top-level item's progress and a step's parent id, title and progress
- Render steps as normal full-width cards ordered with other tasks, with their parent and progress as secondary text
- Ask before completing a top-level item with open steps; keep the Daily, Weekly, habits and right-side progress panel behavior unchanged

### Block 6 — Left behind — DONE

- Add `left_behind` to `/today`: every past scheduled pending Journal task, plus pending goal tasks from past days whose `period_start` is the current open week
- Order rows oldest first and include original date, time and a `Journal` or area source label
- Add the count-bearing Today view only while non-empty; each row has only `Move to today`
- Moving changes `scheduled_date` alone, so Journal due dates and goal week identity stay fixed; tests cover the week turn

### Block 7 — Week integration — DONE

- Ask Goal or Journal before opening a component from the header or a today-or-future slot
- Keep the Journal date editable from today onward and patch selected items or steps instead of duplicating them
- Show step parent context and use the shared open-step completion confirmation
- Allow pending work on an elapsed day of the current week to move to today or later while past drop targets remain blocked
- Keep unscheduled Journal work out of the calendar and include manually scheduled or due-dated Journal work in `later_tasks`

### Block 8 — Verification — DONE

- Run API migration, pytest and Ruff checks; run web lint, typecheck, Vitest and build; verify OpenAPI and generated-client sync
- Manually cover undated items, due add/change/clear, a future-due item planned today, step planning, parent completion with open steps, Left behind, current-week goal identity and cascade delete
- **Done when:** the same Journal task can move between Journal, Today and Week without duplication or due-date drift; steps retain one parent level; Areas, quotas and closed Growth results remain unchanged

## Slice 6 follow-up — Journal priority and sorting — DONE

- Add nullable `tasks.priority` (`HIGH`, `MEDIUM`, `LOW`), allowed only on top-level Journal items by database checks; steps and goal tasks are refused with 422
- Accept it on `POST /tasks`, edit or clear it with `PATCH /tasks/{id}`, and return it on tasks and Journal items
- Show it as a red, amber or green tag in its own column at the end of each Journal row, after the due date, and set it in the item detail when creating or editing
- Return `created_at` on Journal items and let the active list be sorted by due date (default), date added (newest first) or priority (High to Low, then none); Completed stays newest-completed first
- **Done when:** an item created with a priority shows its tag, changing or clearing it in the detail holds after a reload, and the active list reorders by date added or priority on demand

## Slice 7 — Deployment ($0) — DONE

Deploy the existing web application before adding notifications. Production is a
Vercel-hosted static web build that reaches a Render-hosted API through a same-origin
rewrite. Supabase supplies Postgres only, and cron-job.org invokes the existing hourly
maintenance job. Local Compose, including its scheduler, keeps working as it does now.

### Block 0 — Canonical documentation — DONE

38. Make deployment part of the canonical domain documentation before application code:
    - Record the Vercel, Render, Supabase and cron-job.org topology and the local/production job triggers in `design.md`
    - Add the operational endpoints and new auth errors to `api-contract.md`
    - Add `deployment.md` with provider settings, environment variable names, cron jobs and first-run order, and link it from the repository README
    - Keep the shared web/mobile auth response for this slice and defer its split until Slice 8 introduces the mobile client
    - Move Notifications to Slice 8 and renumber its work

### Block 1 — Production configuration and container startup — DONE

39. Make production startup environment-driven while preserving local Compose:
    - Add `CRON_SECRET` and `REGISTRATION_ENABLED`; require production database and JWT values from the environment and enable the Secure refresh cookie in production
    - Remove production localhost assumptions; local values stay explicit in Compose and the development env examples
    - Add a root `.env.example` with names and placeholders only, and keep the existing app-specific examples aligned
    - Start the Render container by applying Alembic migrations and then serving on `0.0.0.0:$PORT`; the local scheduler continues to run system cron
    - Add configuration tests and commit no secret, password or connection string

### Block 2 — Operational endpoints and shared hourly job — DONE

40. Expose deployment health and the existing maintenance job without adding them to the public client:
    - Add `GET /health`, unauthenticated and independent of the database
    - Refactor the cron entrypoint and `POST /internal/jobs/hourly` to call the same hourly orchestration function
    - Compare `X-Cron-Secret` with `CRON_SECRET` using `hmac.compare_digest`, return errors through the application error contract, and return 204 after a successful run
    - Exclude both routes from OpenAPI; test an unavailable database for health, missing and wrong secrets, a correct secret, and a repeated idempotent run

### Block 3 — Registration switch — DONE

41. Keep first-run registration available but close it after the owner account exists:
    - Default `REGISTRATION_ENABLED` to true; when false, `POST /auth/register` returns 403 `registration_closed`
    - Preserve registration behaviour when enabled and show the closed-registration message in the web auth form
    - Cover both settings in API tests and the error state in the web tests

### Block 4 — Login throttling — DONE

42. Limit password guessing per normalised email without a new dependency:
    - After five failed logins within 15 minutes, reject later attempts for that email for 15 minutes with 429 `too_many_attempts`, including a correct password
    - A successful login before the limit clears the count; other emails remain independent
    - Keep the counters in process memory with concurrency-safe access and lazy expiry, and cover the limit, reset, isolation and expiry in tests

### Block 5 — Production web build and Vercel routing — DONE

43. Build the pnpm workspace on Vercel and keep the refresh cookie first-party:
    - Use a relative API base URL in production while retaining the current localhost API for local development
    - Add `apps/web/vercel.json`: rewrite `/api/:path*` to a placeholder Render URL and every other path to `/index.html`
    - Document Vercel's root directory, outside-root workspace access, install command, build command and output directory
    - Regenerate OpenAPI and the shared client for the auth contract changes, and test relative requests, refresh and the production build

### Block 6 — Provider rollout and first user — DONE

44. Provision in the order Supabase → Render → Vercel → cron-job.org:
    - Use only Supabase Postgres through the SSL Session pooler; do not enable Supabase Auth, API or Storage
    - Deploy Render from the API Dockerfile, set its environment in the dashboard and do not deploy the Compose scheduler
    - Replace the Vercel rewrite placeholder with the real Render URL and deploy the static web app
    - Register the owner, set `REGISTRATION_ENABLED=false`, and confirm the `users` table contains exactly one row
    - Configure cron-job.org to call Render directly: `GET /health` every 10 minutes and authenticated `POST /internal/jobs/hourly` every hour

### Block 7 — Verification — DONE

45. Run API pytest and Ruff; run web lint, typecheck, Vitest and build; verify OpenAPI/client sync, local Compose and that tracked files contain no production secrets.
    - **Local verification complete (2026-10-02):** 147 API tests passed against PostgreSQL; 88 web tests, Ruff, ESLint, both TypeScript workspaces, production build and OpenAPI/client sync passed. API/web Docker images built and the local Compose stack started successfully. The production Docker command applied migrations and served on a custom `PORT`; health, closed registration and authenticated repeated hourly calls passed.
    - **Live verification complete:** Supabase, Render, Vercel and cron-job.org are configured. Registration returns `registration_closed` and the `users` table contains exactly one row. cron-job.org health and hourly requests return 200 and 204. Phone over mobile data and PC over the home network can log in, and checked tasks survive a reload on both.
    - **Done when:** phone and PC can open the Vercel URL from different networks, login and a checked task survive a reload, registration is closed after the one owner account, and cron-job.org runs the hourly job successfully and idempotently

## Slice 8 — Hours and a faster Week

Hours replace blocks as the one measure of work: a task's duration is its size, a goal's weekly target is hours, and progress is the hours of completed tasks. Week becomes a calendar edited in place — drag, resize, draw, copy, paste and delete without opening a form — with a panel showing what each goal has planned and done for the shown week. Notifications move to Slice 9.

### Block 0 — Canonical documentation — DONE

- Record hours as the unit, Week editing, selection and shortcuts, Only this / All repeating and the hours panel in `design.md`
- Update `api-contract.md`: durations replace `block_count`, goal targets and progress in hours, `goals` on `GET /week`, `PATCH /tasks/{id}/repeat` and `DELETE /tasks/{id}?scope=repeat`
- Move Notifications to Slice 9

### Block 1 — Hours model API

- Migration: give goal tasks and rules without a duration `block_count × 60` minutes, or 60 when that is null too; round every other duration up to the next 15 minutes; drop `block_count` from `tasks` and `goal_rules`; require a duration on goal tasks and rules; check durations are 15-minute steps from 15 to 1440; widen `period_results.done` to `numeric(6,2)`. Goal targets and closed weeks keep their numbers, read as hours
- Goal `done` becomes completed hours by `period_start` in `/progress` and the week freeze
- Remove `block_count` from requests and responses, validate durations, and drop blocks from the redraw's untouched match
- Regenerate `apps/api/openapi.json` and `packages/api-client/src/generated/schema.d.ts`; update the API tests

### Block 2 — Hours in the web client

- One duration control for the task, Journal and schedule forms: a 15-minute stepper up to 24 hours with 30 min, 1 h, 2 h and 4 h shortcuts; a new goal task starts at one hour; the block picker goes
- Goal form: weekly target in hours / week; goal rows read `20h / week`
- Today: cards as tall as their duration, one unit per hour from half a unit to four, a Journal task without duration taking one unit; the rail counts hours; the block-label `TODO(slice-4)` goes
- Week: the `×N` badge becomes the duration (`4h`, `1h 30m`) beside the repeat mark
- Areas and Growth: goal amounts in hours (`12h 15m / 20h`)

### Block 3 — Week hours panel

- API: `goals` on `GET /week` with `target`, `planned` and `done` hours for the shown week; tests cover elapsed pending work leaving `planned`, a task moved into the following week, the following week and goals without a target
- Web: a right-hand panel toggled from a top-right button, open state remembered on the device; Planned and Done bars against the target per goal, grouped by area in its colour; refreshed after every Week write; on a phone the button opens the rows above the day list

### Block 4 — Editing on the calendar

- Replace HTML drag-and-drop with one pointer interaction for moving, resizing and drawing, snapped to 15 minutes, with a live time-range and duration label
- Move across days, times and the untimed row; resize from the bottom edge; draw a range on an empty slot → Goal or Journal → the component with date, time and duration; double-click an empty slot for one hour
- Show each change at once and save it in the background; put the task back and show the error on failure
- Keep the elapsed-slot rules; a done task on an elapsed day can still change its duration

### Block 5 — Selection, copy, paste and delete

- A click selects, a double-click or Enter opens the form, Escape clears; a click on an empty slot places the paste cursor
- Ctrl/Cmd+C and Ctrl/Cmd+V through `POST /tasks`: a goal task copies as an ad-hoc task of its goal, a Journal task as a new item with its title and duration; steps are not copied
- Delete or Backspace opens a new confirmation component: Enter deletes, Escape cancels
- Shortcuts stay quiet while a dialog or text field has focus

### Block 6 — Only this or All repeating

- API: `PATCH /tasks/{id}/repeat` and `DELETE /tasks/{id}?scope=repeat`, each one transaction; tests cover the weekday wrap, gaps in both directions, a time-only change, the dragged task's `occurrence_date`, no duplicate generation, a date another task of the rule holds, done and retimed tasks staying, and closed weeks
- Web: the question after moving, resizing or deleting a task that repeats; Enter picks Only this; the task shows at its new place while the question is open and Escape puts it back; a resize on an elapsed day skips the question

### Block 7 — Hours panel shortcut (optional)

- Each panel row hands out a block: pick its hours from the row's menu and drag it onto a today-or-future slot to create an ad-hoc task of that goal there, without a form

### Block 8 — Verification

- Run API migration up and down, pytest and Ruff; run web lint, typecheck, Vitest and build; verify OpenAPI and client sync
- Manually plan a 20h goal as 4h × 5 with timed and untimed tasks, leave one undone on a past day and watch it leave Planned, copy a task onto two days, delete one with the key, and move a repeating task two days later with All repeating so a Sunday lands on Tuesday
- **Done when:** a goal's target and progress read in hours on Week, Areas and Growth; a task is moved, resized, drawn, copied, pasted and deleted on Week without opening its form; and All repeating shifts every weekday of the schedule by the drag's gap

## Slice 9 — Notifications

46. `reminders` and `devices` migration, token registration
47. Write a reminder on timed scheduled task create, update it when timing changes, and cancel it on time or schedule removal or delete
48. Reminders for timed tasks the slice 3 job generated before this slice existed — backfill once, then generation writes them itself
49. Scheduler — scan due reminders every minute, fan out to the user's tokens, prune invalid ones
50. `apps/mobile`: Expo, the same generated client, push registration
51. **Done when:** a task an hour out produces a notification on a real device

---

## Notes

- Architectural work that doesn't fit one slice goes into the slice that needs it first, and the next slice reuses it. Watch for a slice swelling because it is carrying the infrastructure for the ones after it.
- Aggregate endpoints (`/journal`, `/today`, `/week`) take their shape from the screen. Sketch the screen before writing the endpoint.
- CRUD endpoints don't. Write them straight from the schema.
