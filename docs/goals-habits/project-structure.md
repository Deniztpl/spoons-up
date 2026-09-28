# Project structure

This document defines the web client's directory structure. It is a placement
rule, not a scaffold: create a directory only when real code belongs in it.

## Web client

```text
apps/web/src/
|-- app/
|   |-- App.tsx
|   |-- App.test.tsx
|   `-- router.tsx
|-- components/
|   |-- layout/
|   |   |-- AppLayout.tsx
|   |   |-- AppHeader.tsx
|   |   `-- AppSidebar.tsx
|   `-- ui/
|       |-- CheckIcon.tsx
|       |-- CloseIcon.tsx
|       `-- ModalDialog.tsx
|-- pages/
|   |-- AuthPage/
|   |   `-- AuthPage.tsx
|   |-- AreasPage/
|   |   |-- AreasPage.tsx
|   |   `-- AreasPage.test.tsx
|   `-- TodayPage/
|       |-- TodayPage.tsx
|       `-- TodayPage.test.tsx
|-- features/
|   |-- auth/
|   |   |-- api/
|   |   |   `-- authApi.ts
|   |   |-- components/
|   |   |   `-- AuthForm.tsx
|   |   |-- hooks/
|   |   |   `-- useAuth.ts
|   |   |-- AuthContext.ts
|   |   |-- AuthProvider.tsx
|   |   `-- session.ts
|   |-- areas/
|   |   |-- api/
|   |   |   `-- areasApi.ts
|   |   |-- components/
|   |   |   |-- AreaDetails/
|   |   |   |   |-- ActiveAreaDeleteConfirmation.tsx
|   |   |   |   |-- ArchivedAreaDeleteConfirmation.tsx
|   |   |   |   |-- ArchivedAreaSection.tsx
|   |   |   |   |-- AreaDetails.tsx
|   |   |   |   |-- AreaRenameForm.tsx
|   |   |   |   `-- AreaSettingsMenu.tsx
|   |   |   |-- AreaList/
|   |   |   |   |-- AreaCreateForm.tsx
|   |   |   |   `-- AreaList.tsx
|   |   |   `-- AreaIcon.tsx
|   |   `-- hooks/
|   |       `-- useAreas.ts
|   |-- goals/
|   |   |-- api/
|   |   |   `-- goalsApi.ts
|   |   |-- components/
|   |   |   |-- AreaGoalList.tsx
|   |   |   |-- GoalDeleteConfirmation.tsx
|   |   |   |-- GoalFormDialog.tsx
|   |   |   `-- GoalRuleFields.tsx
|   |   `-- hooks/
|   |       |-- useAreaGoals.ts
|   |       `-- useGoalForm.ts
|   |-- habits/
|   |   |-- api/
|   |   |   `-- habitsApi.ts
|   |   |-- components/
|   |   |   |-- AreaHabitList.tsx
|   |   |   |-- HabitDeleteConfirmation.tsx
|   |   |   `-- HabitFormDialog.tsx
|   |   `-- hooks/
|   |       `-- useAreaHabits.ts
|   |-- tasks/
|   |   `-- api/
|   |       `-- tasksApi.ts
|   `-- today/
|       |-- api/
|       |   `-- todayApi.ts
|       |-- components/
|       |   |-- TodayHabitList.tsx
|       |   |-- TodayTaskList.tsx
|       |   `-- TodayViewSelector.tsx
|       `-- hooks/
|           `-- useToday.ts
|-- lib/
|   |-- api.ts
|   `-- api.test.ts
|-- test/
|   `-- setup.ts
|-- main.tsx
`-- styles.css
```

## Placement rules

- `app/` contains only application bootstrap, provider composition, and routing.
- `components/layout/` contains the web application's page-shared frame and
  navigation. Add `components/ui/` only when reusable UI primitives exist.
- `pages/` contains components rendered directly by routes. Pages compose
  features and layout; reusable domain behavior does not live in pages.
- `features/` owns product behavior. Keep feature API calls, hooks, and UI with
  the feature that uses them.
- `lib/` contains cross-feature infrastructure such as the configured API
  client and serialized 401 refresh handling.
- Tests stay beside the behavior they verify. `test/` is only for shared test
  setup and test-only helpers.
- Import directly from source files. Do not add barrel `index.ts` files.
- Do not create empty `components/ui`, `stores`, `storage`, `types`, `utils`,
  `constants`, or `providers` directories in anticipation of future work.

## Current decisions

- The persistent frame is named `AppLayout`, not `AppShell`.
- `AppHeader` and `AppSidebar` are parts of that layout.
- `AppHeader` owns domain selection. `AppSidebar` contains only the selected
  domain's page navigation; feature CRUD never lives in the sidebar.
- Responsive navigation is a layout detail. There is no separate mobile
  navigation feature; desktop and narrow layouts render the same navigation.
- `AreaList`, `AreaDetails`, and area state belong to `features/areas`.
- The today screen is the landing page after sign-in.
- Habit API calls, the area details' habit list and the habit form belong to
  `features/habits`; goal API calls, the area details' goal list, the goal form
  and its rule fields belong to `features/goals`. The Areas page composes both
  lists into the details, with their shared empty state and add buttons:
  `AreaDetails` renders its children for an active area, so `features/areas`
  depends on neither, and goals and habits do not depend on each other.
- `useGoalForm` owns the goal form and its save flow. `useAreaGoals` uses it in
  the area panel. A save sends only what changed, because a rule write redraws
  that rule's untouched pending tasks.
- Task API calls belong to `features/tasks`, for the today screen now and the
  calendar later. `useTaskForm` owns task create, edit and delete flows; the
  today screen's view state, check-off flow, task blocks and their progress
  rail belong to `features/today`.
- `ModalDialog` in `components/ui/` is the shared modal shell: backdrop, focus
  trap, Escape and focus return. Form content stays in its feature.
- Parts of a design that wait for a later slice are marked with
  `TODO(slice-N)` comments at the place they plug in, and disabled "Soon"
  controls where the design shows them. No mock data is rendered in their place.
- The generated API schema remains in `packages/api-client`; feature folders do
  not duplicate generated request or response types.
- The web client uses React Router, direct calls through the generated API
  client, Vitest, and React Testing Library. Do not add a query or state library
  until an implemented slice requires one.
- Access tokens remain in memory and refresh tokens remain in httpOnly cookies.
  Do not add token storage helpers.
