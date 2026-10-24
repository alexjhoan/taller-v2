# Plan: Flujo de aprobación de repuestos (Spec 008)

## Objetivo

Cerrar el ciclo mecánico-solicita → admin acepta/rechaza → cliente aprueba/rechaza
siempre sobre el estado actual, **sin campos nuevos de DB y sin endpoints nuevos**:
todo vive dentro del JSON de la columna `parts`. Además (D1), cualquier cambio del
admin sobre repuestos pasa a **persistir de inmediato** vía `PATCH /api/orders`
enviando `budget_accepted: 0`.

**Vocabulario (revisión T-15)**: el estado del repuesto que representa "aceptado por el
admin" es `approvalStatus: "accepted"` (antes `"approved"`). `approvalStatus` solo
admite `pending` / `accepted` / `rejected`. El valor `"approved"` del `OrderStatus` de
la ORDEN (`src/utils/const.ts`, `OrderStatus` en `src/types/index.ts`,
`src/utils/orderFilters.ts`, `status: "approved"` del portal al aceptar presupuesto)
**no se toca**.

**Todo el trabajo de esta spec es FRONTEND.** RF-10 (backend guarda/devuelve `parts`
verbatim con todos los campos) y RF-11 (filtrado server-side del portal) son
prerrequisitos que implementa el **usuario** lado PHP/MariaDB. El frontend se ordena
para quedar **verusable en el interim**: tolera repuestos sin `approvalStatus` y sin
`id`, y el filtrado del portal se hace además client-side (RF-7) de modo que el
comportamiento correcto se verifica aunque el backend aún no filtre.

## Decisiones de implementación (derivadas de las decisiones de diseño de la spec)

1. **Helpers puros en `src/utils/parts.ts`** con tests `node --test`: la regla de
   visibilidad (RF-7), el permiso de borrado del técnico (RF-13/D2), el esquema de
   botones por estado (RF-2), la necesidad de precio al aceptar (RF-3) y el contador
   de pendientes del dashboard (RF-8) son lógica de negocio pura → fuera de los
   componentes, testeable sin backend. Alternativa descartada: lógica inline en cada
   componente (ya hay 3 copias de `getPartStatusBadge` y 2 de `serializeParts`).
2. **`serializeParts` se unifica en `src/utils/parts.ts`**: hoy está duplicado en
   `AdminOrderDetail` y `TechnicianOrderDetail`; se mueve al helper y ambos importan.
   (Recepción serializa a mano `id`/`name`/`quantity`/`unit_price`/`approvalStatus` a
   propósito: checkin nace `accepted` — RF-5/RF-6 — y por eso NO usa `serializeParts`
   del admin, que arrastra más campos mutables.)
3. **Persistencia inmediata de repuestos (RF-12/D1)** con el mismo patrón que el
   guardado automático del checklist (`toggleCheckItem`): estado local optimista +
   `PATCH { id, parts, budget_accepted: 0 }` + rollback si falla + snackbar vía
   `apiClient`. Los handlers de agregar/editar/eliminar pasan de solo `setParts` a
   este patrón. `handleSave` (vehículo/cliente) sigue staged y **conserva** `parts`
   en el payload: con persistencia inmediata el estado local ya es el último
   persistido, así que reenviarlo es un no-op. Alternativa descartada: quitar `parts`
   de `handleSave` (no ahorra nada y rompería el caso en que un PATCH de repuestos
   haya quedado offline encolado con posterioridad).
4. **Aceptar/Rechazar como transición de estado, no como mutación del array**:
   `handleApprovePart(part)` / `handleRejectPart(part)` solo cambian
   `approvalStatus` y persisten. El repuesto **nunca se elimina** por rechazo
   (trazabilidad, decisión 3). Se conservan los nombres internos
   `handleApprovePart`/`confirmApprovePart` (renombrarlos no aporta y añade ruido);
   el TEXTO visible es "Aceptar".
5. **Paso de precio al aceptar (RF-3)**: si `unit_price` es `0`/`null`/`undefined`
   se abre un `CustomDialog` con `NumericInput`; **confirmar** →
   `approvalStatus: "accepted"` + `unit_price`; **cancelar** → no se muta nada (el
   repuesto queda en su estado original: `pending` o `rejected`). Alternativa
   descartada: aceptar sin precio y pedirlo después (el portal sumaría 0).
6. **Visibilidad en el portal (RF-7) client-side**: `orderParts` se filtra con
   `isPartVisibleInPortal` (visible si `approvalStatus` es `undefined` —solo legacy—
   o `"accepted"`) antes del render y de **todos** los cálculos de totales. Es
   redundante con RF-11 (server-side) pero lo hace el frontend a propósito:
   verificable en el interim y defensa en profundidad. Los totales gating la
   decisión del cliente por repuesto (sesión local), manteniendo el atajo actual
   `budget_accepted === 1` → todo aprobado.
7. **Contador de pendientes (RF-8)**: función pura `countOrdersWithPendingParts`
   que parsea `parts` de cada orden (tolera array, JSON string y JSON corrupto → 0)
   y cuenta órdenes con ≥1 repuesto `pending`. Se calcula en `WorkOrderList` desde
   el prop `orders` (ya normalizadas por `parseWorkOrder`), por lo que se recalcula
   solo al refrescar la lista (React Query). Se muestra tras un prop
   `showPendingPartsCounter` que solo pasa `true` `pages/admin/dashboard.tsx` (la
   lista es compartida con el técnico, que no debe ver el contador).
8. **Badge neutro "Ingresado"** para repuestos sin `approvalStatus`
   (legacy, decisión 12) reemplazando el `default` crudo de
   `getPartStatusBadge` en las **tres** vistas (admin, técnico, solo-lectura).
9. **`AdminOrderDetailReadOnly` no recibe botones**: ya hoy no tiene ninguno; solo
   se actualiza su badge. De paso se quita el `Ref: {part.reference}` (el campo
   `reference` ya no viaja nunca — limpieza justificada, regla de "si no se usa,
   se quita").
10. **Tipo `PartItem` de `useWorkOrders`**: `approvalStatus` y
    `requestedByTechnician` pasan a opcionales (la realidad: legacy no los trae) y se
    elimina `reference` (obsoleto, `serializeParts` lo descarta). El tipo del valor
    (`PartApprovalStatus` en `src/types/index.ts`) es
    `'accepted' | 'pending' | 'rejected'`.
11. **`budget_items` / `ApiBudgetItem` en `src/services/api.ts`**: se dejan intactos
    (código muerto declarado fuera de alcance en la spec; tocarlos no aporta).
12. **Renombre del vocabulario (T-15)**: un único cambio mecánico de cadena en el
    ámbito del repuesto, más los textos visibles ("Aceptar"/"Aceptado"). Riesgo
    principal: confundir el `"approved"` del repuesto con el del `OrderStatus` de la
    orden → por eso el rename se hace archivo por archivo con la lista exacta de T-15
    y se comprueba con `npm run typecheck` (el tipo `PartApprovalStatus` hace que
    cualquier `"approved"` restante en `approvalStatus` falle en compilación).
    Alternativa descartada: aceptar ambos valores (`"approved" | "accepted"`) como
    alias de compatibilidad — perpetúa la ambigüedad que el usuario quiere eliminar y
    deja dos fuentes de verdad.

## Arquitectura de la solución

### Fase 1 — Helpers puros + tests (RF-2, RF-3, RF-6, RF-7, RF-8, RF-13)

`src/utils/parts.ts`:

- `isPartVisibleInPortal(part)` → `approvalStatus === undefined || === "accepted"` (RF-7/RF-6).
- `canTechnicianDeletePart(part)` → `requestedByTechnician === true && approvalStatus !== "accepted"` (RF-13/D2).
- `getPartActions(approvalStatus)` → `{ canApprove, canReject }`:
  `pending` → ambos; `accepted` → solo rechazar; `rejected` → solo aceptar;
  `undefined` → ninguno (RF-2).
- `partNeedsPrice(part)` → `unit_price` es `0`/`null`/`undefined` (RF-3).
- `countOrdersWithPendingParts(orders)` → nº de órdenes con ≥1 repuesto `pending`;
  `parts` tolerado como array, JSON string o corrupto → sin contar (RF-8).
- `serializeParts(items)` → JSON string descartando `reference` (ya existente, se
  muda aquí desde Admin/Technician).

`tests/parts.test.mjs` (node:test, importa `.ts` directo como en la 007):
casos por estado (`pending`/`accepted`/`rejected`/`undefined`), legacy sin
`approvalStatus`, repuestos de checkin, JSON corrupto y regresiones.

### Fase 2 — Datos (RF-5, RF-12)

`src/components/AdminOrderDetail.tsx`:

- `handleAddPart`: `approvalStatus: "accepted"` + `requestedByTechnician: false`
  (RF-5, decisión 8) y **persiste de inmediato** (RF-12).
- `handleUpdatePart` / `handleDeletePart`: mismo patrón optimista+PATCH+rollback con
  `budget_accepted: 0` (RF-12). En error, rollback + error
  `[ApiError STATUS] detalle` (ya lo gestiona `apiClient`).
- `handleSave` sin cambios funcionales.

### Fase 3 — UI del admin (RF-2, RF-3, RF-4, RF-9)

`src/components/AdminOrderDetail.tsx`, sección "Repuestos Solicitados":

- Por repuesto: **Editar/Eliminar siempre** + Aceptar/Rechazar según
  `getPartActions` (RF-2). Sin `approvalStatus` → solo Editar/Eliminar.
- `handleApprovePart` (texto del botón **Aceptar**): si `partNeedsPrice` → diálogo de
  precio con título/textos en "Aceptar"; confirmar acepta (RF-3), cancelar no muta
  (RF-4). `handleRejectPart`: marca `rejected` y persiste (RF-4). Ambos reutilizan la
  persistencia inmediata.
- Badge "Solicitud del técnico" (`CustomBadge`) junto al de estado cuando
  `requestedByTechnician` (RF-9).
- `getPartStatusBadge`: caso `accepted` → badge verde/tal como hoy con el texto
  **"Aceptado"**; caso `undefined` → neutral "Ingresado".

### Fase 4 — Vista del técnico (RF-1, RF-13)

`src/components/TechnicianOrderDetail.tsx`:

- Modal "Solicitar Repuesto" **sin cambios** (RF-1; solo se verifica).
- Botón eliminar por repuesto **solo si** `canTechnicianDeletePart` (RF-13).
- `getPartStatusBadge`: caso `accepted` → "Aceptado"; `undefined` → "Ingresado".

### Fase 5 — Portal del cliente (RF-7)

`src/components/ClientQuotationPortal.tsx`:

- `orderParts` (ya con fallback de `id`) se filtra con `isPartVisibleInPortal`;
  el filtrado ocurre ANTES del render y de los totales (los `useMemo` de totales y
  el bloque inline del "Presupuesto Detallado" usan la lista ya filtrada).
- El total aceptado gating `decisions[id] === "accepted"` sobre los visibles
  (RF-7); se conserva el atajo `budget_accepted === 1`. Ojo: ese `"accepted"` es la
  decisión del CLIENTE en la sesión del portal, no `approvalStatus`; no se toca.

### Fase 6 — Dashboard (RF-8)

- `src/components/WorkOrderList.tsx`: badge junto al título con
  `countOrdersWithPendingParts(orders)` cuando `showPendingPartsCounter`.
- `pages/admin/dashboard.tsx`: pasa `showPendingPartsCounter`.

### Fase 7 — Solo lectura + tipos + documentación (RF-2, RF-14)

- `src/components/AdminOrderDetailReadOnly.tsx`: badge `accepted` → "Aceptado" y
  `undefined` → "Ingresado"; sin `Ref: {part.reference}`; sin botones (verificación
  de RF-2).
- `src/components/ReceptionCheckinForm.tsx`: `addPart` crea el repuesto con
  `approvalStatus: "accepted"` explícito (RF-5/RF-6).
- `src/hooks/useWorkOrders.ts` / `src/types/index.ts`: `PartItem` con
  `approvalStatus?`/`requestedByTechnician?` opcionales y sin `reference`;
  `PartApprovalStatus = 'accepted' | 'pending' | 'rejected'`.
- `API_FRONTEND.md`: contrato de `parts` con campos internos camelCase
  (`id`, `approvalStatus` con `pending`/`accepted`/`rejected`, `requestedByTechnician`,
  `criticality`), filtrado server-side del portal (RF-11) y envío de
  `budget_accepted: 0` ante cualquier cambio de repuestos (RF-12). Regla
  constitución #2.

### Fase 8 — Renombre de vocabulario del repuesto (T-15)

Cambio mecánico `"approved"` → `"accepted"` **solo** donde habla del repuesto:

| Archivo | Puntos |
|---|---|
| `src/utils/parts.ts` | `isPartVisibleInPortal`, `canTechnicianDeletePart`, `getPartActions` y sus comentarios |
| `src/types/index.ts` | `PartApprovalStatus` (NO `OrderStatus`) |
| `src/components/AdminOrderDetail.tsx` | `handleAddPart`, `confirmApprovePart`, `getPartStatusBadge`; textos "Aprobar"/"Aprobado" → "Aceptar"/"Aceptado" |
| `src/components/AdminOrderDetailReadOnly.tsx` | `getPartStatusBadge` |
| `src/components/TechnicianOrderDetail.tsx` | `getPartStatusBadge` |
| `tests/parts.test.mjs` | casos y títulos de test |
| `API_FRONTEND.md` | tabla y ejemplos de `parts` |

Sin migración de datos: los repuestos guardados con `"approved"` se corrigen a mano en
la BD si aparecen (caso conocido: orden 30, ya corregida).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/utils/parts.ts` | helpers puros + `serializeParts` unificado; vocabulario `accepted` |
| `tests/parts.test.mjs` | tests node:test de los helpers con `accepted` |
| `src/types/index.ts` | `PartApprovalStatus = 'accepted' \| 'pending' \| 'rejected'` (`OrderStatus` intacto) |
| `src/hooks/useWorkOrders.ts` | `PartItem` opcional, sin `reference` |
| `src/components/AdminOrderDetail.tsx` | persistencia inmediata, Aceptar/Rechazar, paso de precio, badge "Solicitud del técnico", "Ingresado"/"Aceptado" |
| `src/components/TechnicianOrderDetail.tsx` | borrado condicionado (RF-13), "Ingresado"/"Aceptado", importa `serializeParts` |
| `src/components/ClientQuotationPortal.tsx` | filtrado de visibilidad + totales gating decisión del cliente |
| `src/components/WorkOrderList.tsx` | contador de pendientes (prop) |
| `pages/admin/dashboard.tsx` | pasa `showPendingPartsCounter` |
| `src/components/AdminOrderDetailReadOnly.tsx` | "Ingresado"/"Aceptado", quitar `Ref:` |
| `src/components/ReceptionCheckinForm.tsx` | `addPart` con `approvalStatus: "accepted"` (RF-5/RF-6) |
| `API_FRONTEND.md` | contrato de `parts` (RF-14) con `pending`/`accepted`/`rejected` |

Sin tocar: `src/utils/const.ts`, el `OrderStatus` de `src/types/index.ts`,
`src/utils/orderFilters.ts` y el `status: "approved"` que envía el portal al aceptar el
presupuesto (son estado de la ORDEN, no del repuesto). Tampoco `src/services/api.ts`
(`budgetItems`/`ApiBudgetItem` es código muerto declarado fuera de alcance).

## Orden de las tareas y por qué

1. Helpers + tests primero: son la base pura que consumen todas las fases y se
   verifican con `node --test` **sin backend**.
2. Tipos (`PartItem`/`PartApprovalStatus`) antes de la UI: evita casts y hace que el
   rename del vocabulario falle en compilación si queda algún `"approved"` de repuesto.
3. Admin (datos → UI): primero la persistencia inmediata (RF-12), luego los
   botones de estado encima; si no, cada botón tendría que inventar su propio PATCH.
4. Técnico después del admin: comparte badge y helper ya creados.
5. Portal después: consume `isPartVisibleInPortal` ya testeado.
6. Dashboard al final de la UI: depende solo del helper del fase 1.
7. Documentación y limpieza al cierre (RF-14).
8. T-15 (rename de vocabulario) al final, sobre código y tests ya estables: es un
   cambio mecánico cuyo valor es que el diff no se mezcle con lógica nueva, y su
   verificación (`typecheck` + `node --test` + `build`) cubre todo lo anterior.

## Verificación

- `node --test` en verde (`tests/parts.test.mjs` con 44 tests + `tests/ids.test.mjs`).
- `npm run typecheck` sin errores (el tipo `PartApprovalStatus` bloquea `"approved"`
  en `approvalStatus`).
- `npm run build` sin errores.
- `npm run lint` no ejecutable (preexistente: el repo no tiene configuración de ESLint;
  `next lint` abre el asistente interactivo).
- Regla de limpieza: sin imports/variables huérfanos (`reference`, copias locales de
  `serializeParts`, `parts` staged, etc.).
- Grep de control: ningún `approvalStatus` con `"approved"` y ningún `"accepted"`
  colado en el `OrderStatus`/filtros de orden.

### Qué queda pendiente hasta que el usuario cumpla RF-10/RF-11 (backend)

- **RF-10** (PATCH guarda `parts` verbatim; GET devuelve `id`,
  `approvalStatus`, `requestedByTechnician`, `criticality`): mientras no esté, el
  backend elimina esos campos al devolver y todos los repuestos aparecen como
  legacy ("Ingresado", sin botones de aceptación, visibles en el portal). El
  frontend ya es correcto en ese escenario (fallbacks tolerados) y **no hay nada
  que cambiar cuando llegue RF-10**: simplemente empezarán a llegar los campos.
- **RF-11** (portal filtra server-side): el filtrado client-side de RF-7 del fase 5
  garantiza el comportamiento correcto aun sin el filtro del backend.
- La spec **no se da por implementada end-to-end** sin RF-10/RF-11 (Criterios de
  finalización): esto solo deja el frontend completo y verificable.
