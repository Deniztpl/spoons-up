# Web client

- Use Vite, React, TypeScript, and Tailwind CSS. This is a client-rendered app; do not introduce Next.js or SSR.
- Use React Router for routing. Make API calls through `@spoons-up/api-client`, which uses `openapi-fetch`.
- Test with Vitest in jsdom, React Testing Library, `user-event`, and `jest-dom`.
- `packages/api-client/src/generated/schema.d.ts` is generated from `apps/api/openapi.json`; never edit it by hand. Regenerate it whenever the API contract changes.
- Keep the access token in memory only. The refresh token belongs in an httpOnly cookie. Never write either token to `localStorage` or `sessionStorage`.
- Serialize concurrent 401 recovery behind one in-flight refresh promise.
- API errors have the shape `{ code, message, fields? }`. Branch on `code`, never on `message`.
- JSON IDs are strings. Instants are UTC ISO-8601 values ending in `Z`; local dates and times have no timezone.
- Do not calculate week boundaries in the client. Render weeks from the `/week` response's ordered `days` array.
- Call `/me` only from the profile screen, not during app startup.
- Do not modify `apps/api` from this workspace.

## Component boundaries

- Reuse is not required for extraction. Extract a feature-local component when
  a JSX block has its own form submission or interaction lifecycle, loading or
  error states, or makes its parent coordinate several distinct UI modes.
- Use domain-specific names such as `AreaRenameForm`, not generic names such as
  `RenameForm`.
- Keep small static fragments inline. Do not create components solely to reduce
  line count or to anticipate reuse.
