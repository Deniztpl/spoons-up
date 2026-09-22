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
|   `-- layout/
|       |-- AppLayout.tsx
|       |-- AppHeader.tsx
|       `-- AppSidebar.tsx
|-- pages/
|   |-- AuthPage/
|   |   `-- AuthPage.tsx
|   `-- AreasPage/
|       |-- AreasPage.tsx
|       `-- AreasPage.test.tsx
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
|   `-- areas/
|       |-- api/
|       |   `-- areasApi.ts
|       |-- components/
|       |   |-- AreaCreateForm.tsx
|       |   |-- AreaIcon.tsx
|       |   |-- AreaList.tsx
|       |   |-- AreaPanel.tsx
|       |   `-- AreaRenameForm.tsx
|       `-- hooks/
|           `-- useAreas.ts
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
- `AreaList`, `AreaPanel`, and area state belong to `features/areas`.
- The generated API schema remains in `packages/api-client`; feature folders do
  not duplicate generated request or response types.
- The web client uses React Router, direct calls through the generated API
  client, Vitest, and React Testing Library. Do not add a query or state library
  until an implemented slice requires one.
- Access tokens remain in memory and refresh tokens remain in httpOnly cookies.
  Do not add token storage helpers.
