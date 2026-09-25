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

## Component conventions

- Split components by responsibility, not line count. Long Tailwind classes or
  local SVGs alone are not reasons to extract a component.
- Extract a component when it owns behavior or state, is reused, represents a
  meaningful UI mode, or makes a parent's mode switching clearly easier to
  follow. A delete confirmation is one example.
- Keep small static fragments and pass-through markup inline. Do not create a
  component only to shorten JSX or in anticipation of future reuse.
- Keep state in the lowest component that needs it.
- Use names that describe the component's domain role, such as
  `AreaRenameForm` or `AreaSettingsMenu`, instead of vague names like
  `Options` or `Controls`.
- Keep feature components flat by default. Create a folder such as
  `AreaDetails/` only when a real group of closely related child components has
  formed. Keep domain components in their feature and move genuinely shared UI
  primitives to `components/ui/`.
