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

## Slice 6 — Notifications

38. `reminders` and `devices` migration, token registration
39. Write a reminder on timed task create, update or create it when timing changes, cancel on time removal or delete
40. Reminders for timed tasks the slice 3 job generated before this slice existed — backfill once, then generation writes them itself
41. Scheduler — scan due reminders every minute, fan out to the user's tokens, prune invalid ones
42. `apps/mobile`: Expo, the same generated client, push registration
43. **Done when:** a task an hour out produces a notification on a real device

---

## Notes

- Architectural work that doesn't fit one slice goes into the slice that needs it first, and the next slice reuses it. Watch for a slice swelling because it is carrying the infrastructure for the ones after it.
- Aggregate endpoints (`/today`, `/week`) take their shape from the screen. Sketch the screen before writing the endpoint.
- CRUD endpoints don't. Write them straight from the schema.
