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

## Slice 1 — Areas

11. `areas` migration, CRUD endpoints scoped to the token's user — DONE
12. Web: header domain selector with Goals & Habits active and Nutrition/Fitness disabled as coming soon; left-column page navigation for the selected domain with Areas active and future Today/Week pages disabled; area list, create, selection and rename in the Areas page content — DONE

- TODO: add area archive, restore and confirmed-delete UI before closing Slice 1.

13. **Done when:** areas created in the browser appear after a reload; another user's area returns 404

## Slice 2 — Habits

14. `habits` and `habit_entries` migration, CRUD
15. Check off and undo — a row on check, hard delete on undo
16. `GET /today?date=` returning daily habits, weekly habits and tasks (tasks empty for now)
17. Web: today screen with the daily/weekly switch, habit rows with checkboxes
18. **Done when:** a habit is checked off in the browser and survives a reload; checking twice in one period is rejected

## Slice 3 — Goals and task generation

19. `goals` and `goal_rules` migration, CRUD
20. Period math — timezone + `week_start_day` -> `period_start`. Standalone, no DB, tested.
21. `tasks` migration
22. `materialize` — expand rules into dates, insert idempotently, bounded to ~12 weeks back
23. `/today` now returns the day's tasks, ordered by `start_time`
24. Complete and uncomplete a task
25. Web: goal form with rules; tasks under the habits on the today screen
26. **Done when:** a goal created in the browser produces today's task, and completing it holds after a reload

## Slice 4 — Calendar

27. `GET /week?start=`
28. Postpone — `scheduled_date` moves, `occurrence_date` and `period_start` stay
29. Delete — soft for rule-generated, hard for ad-hoc
30. Ad-hoc task creation
31. Web: calendar view, move between weeks, drag or pick a new date
32. **Done when:** a task dragged across a week boundary still counts toward its original week

## Slice 5 — Weekly results

33. `period_results` migration
34. Live computation for the open week; freeze a closed week on first request
35. Area result — every row for that week satisfies `done >= target`
36. Web: area view showing weekly progress and past weeks
37. **Done when:** a closed week's outcome does not move after `weekly_target` is changed

## Slice 6 — Notifications

38. `reminders` and `devices` migration, token registration
39. Write a reminder on task create, update on move, cancel on delete
40. Background worker — materialize the next 24 hours every 5-15 minutes, per user timezone
41. Scheduler — scan due reminders every minute, fan out to the user's tokens, prune invalid ones
42. `apps/mobile`: Expo, the same generated client, push registration
43. **Done when:** a task an hour out produces a notification on a real device

---

## Notes

- Architectural work that doesn't fit one slice goes into the slice that needs it first, and the next slice reuses it. Watch for a slice swelling because it is carrying the infrastructure for the ones after it.
- Aggregate endpoints (`/today`, `/week`) take their shape from the screen. Sketch the screen before writing the endpoint.
- CRUD endpoints don't. Write them straight from the schema.
