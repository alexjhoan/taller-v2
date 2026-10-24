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

## Skills

Las skills viven en `.agents/skills/<id>/SKILL.md` y se cargan con la herramienta `skill`
usando el ID del directorio. Carga SOLO la que aplique a la tarea actual: no las cargues todas.

| Skill | Cuándo usarla |
|---|---|
| `sdd` | Flujo Spec-Driven Development del proyecto: spec → plan → tareas → implementación → validación. Obligatoria en cualquier trabajo bajo `specs/`. |
| `using-agent-skills` | Meta-skill: decide qué skill aplica antes de empezar. Empieza por aquí si dudas de cuál. |
| `find-skills` | Buscar e instalar nuevas skills cuando falta una para la tarea. |
| `ponytail` | Cualquier tarea de código: el cambio más pequeño que resuelve el problema completo (YAGNI). |
| `spec-driven-development` | Requisitos y criterios de aceptación antes de escribir código. |
| `planning-and-task-breakdown` | Descomponer una spec en tareas verificables. |
| `incremental-implementation` | Implementar por rebanadas delgadas y verificables. |
| `test-driven-development` | Escribir el test en rojo antes del código. |
| `browser-testing-with-devtools` | Verificar en navegador real (MCP Chrome DevTools), incluida vista móvil. |
| `debugging-and-error-recovery` | Algo falló: reproducir → localizar → corregir → guardar. |
| `code-review-and-quality` | Revisar código en varios ejes antes de cerrar. |
| `code-simplification` | Reducir complejidad conservando el comportamiento. |
| `doubt-driven-development` | Contrastar decisiones no triviales con contexto fresco. |
| `security-and-hardening` | Validación de entradas, permisos, secretos. |
| `performance-optimization` | Problemas de rendimiento medidos. |
| `frontend-design` | Dirección visual distintiva al crear o rediseñar una UI. |
| `frontend-ui-engineering` | UI de producción: accesibilidad y responsive. |
| `web-design-guidelines` | Auditar la UI contra las buenas prácticas de interfaces web. |
| `api-and-interface-design` | Contratos de API estables entre front y back. |
| `source-driven-development` | Verificar contra documentación oficial antes de implementar. |
| `context-engineering` | Cargar el contexto correcto en el momento correcto. |
| `documentation-and-adrs` | Documentar el porqué, no el qué. |
| `git-workflow-and-versioning` | Commits atómicos e historial limpio. |
| `ci-cd-and-automation` | Gates de calidad automáticos. |
| `shipping-and-launch` | Checklist de salida y plan de reversión. |
| `deprecation-and-migration` | Retirar lo viejo y migrar sin cortes. |
| `observability-and-instrumentation` | Logs, métricas y trazas útiles. |
| `interview-me` | Requisito ambiguo: preguntar antes de asumir. |
| `grill-me` | Someter un plan o decisión a presión: entrevista implacable hasta entendimiento compartido. |
| `idea-refine` | Idea vaga: refinar variantes antes de decidir. |
| `constraint-driven-development` | Fijar por escrito la barra de calidad del proyecto. |

Regla: si una skill aplica, cárgala ANTES de hacer el trabajo y sigue sus pasos.

Los prompts de los agentes viven en `.opencode/agents/` (esa es la ruta que usa el runtime).
`.agents/agents/` es un espejo documental: se mantiene byte-idéntico, pero no gobierna la ejecución.

## Reglas
- Lee `docs/constitution.md` y la spec activa (`specs/NNN-*/`) antes de tocar código.
- Carga la skill que aplique a la tarea (ver "## Skills") antes de empezar.
