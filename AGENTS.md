# AGENTS.md

## Stack & Commands

- Next.js 14 (Pages Router — `pages/`, NOT App Router), React 18, TypeScript, Tailwind CSS
- Commands: `npm run dev` · `npm run build` · `npm start` · `npm run lint` · `npm run typecheck`
- Path alias: `@/*` → `src/*`
- No test suite; verify with `npm run lint && npm run typecheck`

## Architecture

- **Pages Router**: routes live in `pages/` (e.g. `pages/reception/checkin.tsx`, `pages/portal/index.tsx`). Do NOT create `src/app/`.
- **No dynamic routes**: avoid `[id].tsx` or `[token].tsx`. Use query params (`/order?token=xyz`).
- **Auth**: JWT in cookie via `react-cookie`. Protect pages with `withAuth` HOC from `src/components/withAuth.tsx`. Session state in `UserContext`.
- **API client**: single entrypoint `src/services/api.ts`. Base URL from env `NEXT_PUBLIC_API_BASE_URL` (fallback `NEXT_PUBLIC_API`). Token set via `setApiToken()`.
- **Offline-first**: failed requests return `{ status: 503, statusText: 'OfflineMode' }` and queue to LocalForage (`queue_offline`). Components must handle this shape.
- **Notifications**: use Notistack `enqueueSnackbar` for user feedback.
- **Contexts** (provider order in `pages/_app.tsx`): `UserProvider` → `DialogsProvider` → `WorkshopProvider`.

## Backend Integration

- **Field names must match MySQL columns exactly** (snake_case): `customer_name`, `vehicle_plate`, `unit_price`. Never camelCase.
- Generic CRUD: `GET/POST/PATCH/DELETE /{table}`. Specific routes under `/api/orders`, `/api/public/order/{token}`, etc.
- Full API contract: see `API_FRONTEND.md`.
- Roles: `admin`, `mechanic`. Public portal routes require no JWT.

## Component Conventions

- Reuse `src/components/ui/` for UI primitives (CustomDialog, CustomInput, CustomButton, CustomSwitch, CustomCard, CustomBadge, CustomStepper, CustomImage).
- Types/interfaces live inside the component file (self-contained). Use `[key: string]: any` for loose API payloads.
- Data-fetching components use `api` from `src/services/api.ts`; never raw `fetch` for standard CRUD.
- Notistack `enqueueSnackbar` for user feedback.

## Gotchas

- `reactStrictMode: false` in `next.config.mjs` — do not rely on double-invoke effects.
- App auto-reloads on version mismatch (`versionsApp` in localStorage + `apiGetVersionApp`).
- `out/` contains a static export — do not edit; it is build output.
- Cookie name is obfuscated (`bkBtM0NvMGsmMw` in `src/utils/const.ts`).

## Memory System (`MEMORY.md`)

- Read `MEMORY.md` at task start for context.
- Update `MEMORY.md` at task end with progress, decisions, and lessons.
- Keep it brief (~50 lines max).
- Never store sensitive data in `MEMORY.md`.

## Comandos
- Tests: `node --test`
## Reglas
- Lee `docs/constitution.md` y la spec activa (`specs/NNN-*/`) antes de tocar código. 
