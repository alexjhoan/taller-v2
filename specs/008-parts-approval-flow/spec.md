# Spec 008 — Flujo de aprobación de repuestos (mecánico solicita → admin acepta)

Estado: implementada (frontend, T-1..T-15) — pendiente de RF-10/RF-11 en el backend
(PHP/MariaDB). Revisión de vocabulario cerrada (T-15): el repuesto aceptado por el admin
usa `"accepted"`. Esto NO afecta al valor `"approved"` del `OrderStatus` de la ORDEN,
que se mantiene igual.

## Contexto y objetivo

El cliente pide que el mecánico NO agregue repuestos "directamente" en la orden sin
oversight, pero que SÍ pueda solicitarlos: la solicitud queda en estado `pending` y el
admin la acepta o rechaza antes de que cuente como repuesto real del presupuesto.
Después, el cliente ya aprueba o rechaza en el portal como hasta hoy.

Además (decisión D1 del review QA): cualquier cambio del admin sobre los repuestos
persiste DE INMEDIATO y reinicia la aceptación del presupuesto
(`budget_accepted: 0`), de modo que el cliente SIEMPRE revisa el estado actual. Esto
elimina el problema de "presupuesto ya aceptado y llega un repuesto nuevo".

Estado actual del código (verificado):

- `parts` es un campo JSON/TEXT de `work_orders`, stringificado en el payload igual que
  `checklist` y `service_items`. No se crea ningún campo nuevo en la DB.
- El técnico YA tiene modal "Solicitar Repuesto" (`handleSubmitNewPart` en
  `TechnicianOrderDetail`) que crea repuestos con `approvalStatus: "pending"` y
  `requestedByTechnician: true`; envía `criticality` SIEMPRE con el valor fijo
  `"preventive"` (hoy no existe control del usuario para elegirlo).
- El admin YA puede agregar/editar/eliminar repuestos (`handleAddPart` en
  `AdminOrderDetail`), pero los que agrega nacen sin decisión del admin y **no tiene
  botones de Aceptar/Rechazar** — solo Editar/Eliminar. Ese es el hueco real.
- Hoy las acciones de repuestos del admin quedan **staged** hasta pulsar "Guardar
  Cambios"; con la decisión D1 pasan a persistir de inmediato (solo los repuestos; los
  datos de vehículo/cliente siguen staged).
- Ambas vistas YA muestran badge de estado (`getPartStatusBadge`), pero su `default`
  renderiza el valor crudo del `status` (basura para repuestos legacy/checkin).
- Existe vista de solo lectura para el historial del admin
  (`AdminOrderDetailReadOnly`, usada en `/admin/history`) con su propio
  `getPartStatusBadge` y sin botones de edición/aceptación.
- El portal YA renderiza `parts` con switches por repuesto y usa `budget_accepted`
  (flag a nivel de orden) al enviar.
- `budget_items` existe como endpoint pero es código muerto (el portal usa
  `order.parts`); NO se migra a `budget_items`.

Objetivo: cerrar el ciclo mecánico-solicita → admin-acepta/rechaza →
cliente-aprueba-siempre-actual, sin campos nuevos de DB y sin endpoints nuevos de
backend para el badge. **RF-10 y RF-11 son prerrequisitos del backend (implementados
por el usuario, lado PHP/MariaDB) sin los cuales el flujo NO es correcto
end-to-end** (ver Criterios de finalización).

## Usuarios

- Mecánico: solicita repuestos desde su vista de la orden, ve todos los repuestos de la
  orden (contexto) pero solo gestiona los suyos.
- Admin: acepta o rechaza solicitudes, completa el precio al aceptar y controla el
  listado de repuestos de la orden; todo cambio en repuestos se guarda de inmediato.
- Cliente: ve en el portal solo los repuestos aceptados por el admin y los aprueba o
  rechaza en su presupuesto; si el admin cambia repuestos después, su aceptación se
  reinicia y revisa de nuevo.

## Historias de usuario

- HU-1. Como mecánico, quiero solicitar un repuesto desde la orden para que el admin
  lo revise antes de que cuente en el presupuesto.
- HU-2. Como admin, quiero ver un contador de órdenes con solicitudes pendientes en el
  dashboard para no perder ninguna.
- HU-3. Como admin, quiero aceptar o rechazar cada solicitud con un clic, poder poner
  el precio unitario al aceptar si no lo trae, y poder deshacer la decisión después
  (aceptar un rechazado o rechazar un aceptado) sin perder nunca Editar/Eliminar; cada
  decisión se guarda de inmediato y reinicia la aceptación del cliente para que revise
  el estado actual.
- HU-4. Como admin, quiero que los repuestos que agrego yo directamente ya queden
  aceptados, para que el cliente los vea de inmediato.
- HU-5. Como cliente, quiero ver en el portal solo los repuestos aceptados por el
  admin, para no confundirme con pedidos aún no autorizados ni con piezas rechazadas.
- HU-6. Como mecánico, quiero poder eliminar mis propias solicitudes mientras el admin
  no las acepte, para corregir pedidos equivocados sin esperar a que él las elimine.

## Definiciones

- **`approvalStatus` (decisión del ADMIN sobre el repuesto)**: vive dentro de cada
  objeto de `parts` y toma exactamente tres valores: `pending` (solicitud del mecánico
  sin decidir), `accepted` (aceptado por el admin) y `rejected` (rechazado por el
  admin). Nace `pending` cuando lo solicita el mecánico, y `accepted` cuando lo crea el
  admin o la recepción.
- **Aprobación del CLIENTE**: concepto DISTINTO. Se guarda en `budget_accepted` (flag a
  nivel de orden) y en las decisiones por repuesto de la sesión de revisión del portal
  (estado local). Nunca se escribe en `approvalStatus`.
- **`status` de la ORDEN (`OrderStatus`)**: `received`, `diagnosing`,
  `awaiting_approval`, `approved`, `in_progress`, `ready`, `delivered`, `cancelled`. Su
  valor `"approved"` no tiene relación con el vocabulario de los repuestos y NO cambia.
- **"aceptar" vs "aprobar"**: en esta spec *aceptar* es la acción del ADMIN sobre un
  repuesto; *aprobar* se reserva al CLIENTE sobre el presupuesto.

## Requisitos funcionales

- RF-1: MIENTRAS el técnico usa su vista de orden, EL SISTEMA conserva el modal
  "Solicitar Repuesto" tal como existe hoy: crea el repuesto con
  `approvalStatus: "pending"`, `requestedByTechnician: true`, `notes` opcional y
  `criticality` con el valor fijo `"preventive"` (hoy el modal no ofrece control al
  usuario sobre ese campo), y lo envía dentro de `parts` serializado en
  `PATCH /api/orders`.
- RF-2: CUANDO el admin abre el detalle **editable** de una orden, EL SISTEMA muestra
  por cada repuesto los botones **Editar** y **Eliminar** (nunca desaparecen, en ningún
  estado) más los botones de estado según `approvalStatus`: si está `pending`, muestra
  **Aceptar** y **Rechazar**; si está `accepted`, muestra solo **Rechazar** (deshacer
  la aceptación); si está `rejected`, muestra solo **Aceptar** (deshacer el rechazo).
  Es decir: Aceptar se muestra en `pending` y `rejected`; Rechazar, en `pending` y
  `accepted`. Los repuestos sin `approvalStatus` (legacy) muestran solo
  Editar/Eliminar. Los botones de aceptación y edición existen SOLO en el detalle
  editable: la vista de solo lectura del historial del admin no muestra ningún botón,
  solo el badge de estado.
- RF-3: CUANDO el admin acepta un repuesto `pending` sin `unit_price` o con
  `unit_price` igual a `0`, `null` o `undefined`, EL SISTEMA solicita el precio
  unitario antes de confirmar la aceptación (el precio es necesario para el total del
  portal); si el repuesto ya tiene precio, se acepta sin ese paso.
- RF-4: CUANDO el admin acepta un repuesto (`pending` o `rejected`), EL SISTEMA marca
  el repuesto `approvalStatus: "accepted"`; CUANDO lo rechaza (`pending` o `accepted`),
  lo marca `approvalStatus: "rejected"`. El deshacer usa el mismo mecanismo: aceptar un
  `rejected` lo pasa a `accepted` y rechazar un `accepted` lo pasa a `rejected`
  (incluido el paso de precio de RF-3 si falta `unit_price`). SI el admin cancela el
  paso de precio, EL SISTEMA deja el repuesto en su ESTADO ORIGINAL (si venía de
  `pending` queda `pending`; si venía de `rejected` queda `rejected`); cancelar nunca
  convierte un `rejected` en `pending`. En todos los casos el repuesto se CONSERVA en
  `parts` (trazabilidad) y el admin puede eliminarlo manualmente después si quiere.
- RF-5: EL SISTEMA guarda los repuestos que agrega el admin directamente (tanto en el
  detalle de la orden como en la recepción/checkin) con `approvalStatus: "accepted"` y
  `requestedByTechnician: false` (cambio respecto a hoy, que los deja sin decisión),
  persistiendo el cambio de inmediato (RF-12). Un repuesto creado por el admin espera
  únicamente la aprobación del cliente, no una segunda revisión del admin.
- RF-6: EL SISTEMA crea los repuestos dados de alta en recepción/checkin con
  `approvalStatus: "accepted"` explícito (son parte de la cotización inicial y deben
  ser visibles al cliente sin esperar a nadie). SI un repuesto guardado con
  anterioridad carece de `approvalStatus` (dato legacy), ENTONCES EL SISTEMA lo trata
  igualmente como aceptado; ese soporte de `undefined` es solo tolerancia para datos
  viejos y ningún flujo nuevo escribe repuestos sin `approvalStatus`.
- RF-7: EL SISTEMA aplica esta regla de visibilidad en el portal del cliente: un
  repuesto es visible SI `approvalStatus` es `undefined` (legacy) O
  `"accepted"`; se ocultan `"pending"` y `"rejected"`. La decisión del cliente por
  repuesto gating el TOTAL: sobre los visibles, solo los que el cliente aprueba en su
  sesión de revisión cuentan en el total aceptado y los no aprobados quedan como
  pendientes.
- RF-8: EL SISTEMA muestra en el dashboard admin, en la pestaña Órdenes y junto a la
  lista de órdenes, un badge/contador con el número de órdenes que tienen al menos un
  repuesto en `pending`; el cálculo se hace en frontend con las órdenes ya cargadas
  (sin endpoint de notificación) y se deduce parseando `parts` de cada orden de la
  lista; el contador se recalcula al refrescar la lista (por ejemplo, al volver del
  detalle tras aceptar una solicitud).
- RF-9: EL SISTEMA identifica visualmente en la vista del admin los repuestos con
  `requestedByTechnician: true` mostrándoles una etiqueta/badge "Solicitud del
  técnico" junto al badge de estado, de modo que se distingan de los repuestos
  ingresados por el admin o en checkin. (Aclaración: el badge de RF-8 es un contador
  de Órdenes del dashboard, no identifica repuestos; son cosas distintas.)
- RF-10 (contrato backend — PRERREQUISITO, ver Criterios de finalización): el backend
  garantiza que `PATCH /api/orders` guarda `parts` verbatim (string opaco, sin tocar
  los objetos de adentro), y que `GET /api/orders` (lista y detalle) devuelve `parts`
  con TODOS los campos de cada repuesto, incluidos `id`, `approvalStatus`,
  `requestedByTechnician` y `criticality` (hoy reconstruye cada repuesto y se queda solo
  con `name`, `quantity`, `unit_price`, `notes`); hasta que eso cambie, el frontend
  debe tolerar repuestos sin `approvalStatus` y generar `id` de respaldo.
- RF-11 (contrato backend — PRERREQUISITO, ver Criterios de finalización): el backend
  filtra server-side en `GET /api/public/order/{token}` los repuestos a solo los
  aceptados por el admin (`accepted`, más los legacy sin `approvalStatus`), de modo que
  el cliente no vea `pending` ni `rejected` ni siquiera en el JSON de la respuesta.
- RF-12: CUANDO el admin realiza cualquier cambio sobre los repuestos de una orden
  (agregar, aceptar, rechazar, editar, eliminar), EL SISTEMA persiste el cambio de
  INMEDIATO mediante `PATCH /api/orders` (mismo patrón que el modal del técnico y el
  auto-guardado del checklist; no se espera a "Guardar Cambios") Y envía en ese mismo
  envío `budget_accepted: 0`, reiniciando la aceptación del cliente para que revise el
  estado actual. Los datos de vehículo/cliente del formulario siguen quedando staged
  hasta "Guardar Cambios"; solo los repuestos pasan a persistencia inmediata. SI el
  usuario pierde la navegación sin guardar, ENTONCES la decisión de aceptación NO se
  pierde (ya está persistida).
- RF-13: EL SISTEMA permite al técnico ver todos los repuestos de la orden (contexto),
  pero solo puede ELIMINAR un repuesto SI `requestedByTechnician` es `true` Y
  `approvalStatus` NO es `"accepted"`; es decir, solo sus propias solicitudes y solo
  mientras no estén aceptadas. El técnico nunca acepta ni rechaza repuestos, ni
  elimina repuestos aceptados ni los agregados por el admin/recepción.
- RF-14: EL SISTEMA exige actualizar `API_FRONTEND.md` con el contrato nuevo de
  `parts`: los campos internos `id`, `approvalStatus` (`pending`/`accepted`/`rejected`),
  `requestedByTechnician` y `criticality` (camelCase dentro del JSON, ver excepción en
  Decisiones de diseño 7), el filtrado server-side del portal (RF-11) y el envío de
  `budget_accepted: 0` ante cualquier cambio de repuestos (RF-12). Regla de la
  constitución #2: la funcionalidad nace documentada en `API_FRONTEND.md`.

## Casos límite

- Repuesto viejo guardado sin `approvalStatus` (datos anteriores a esta revisión) →
  visible en el portal y cuenta en los totales; en el admin muestra badge neutro
  "Ingresado" (sin color de estado) y solo Editar/Eliminar en el detalle editable (no
  es una solicitud pendiente); en la vista de solo lectura del historial, solo el
  badge. Un repuesto creado hoy por admin o recepción YA NO cae en este caso: nace
  `accepted` (RF-5/RF-6).
- `unit_price` vacío, `0`, `null` o `undefined` al aceptar → el admin debe
  introducirlo; cancelar el paso deja el repuesto en su ESTADO ORIGINAL (de `pending`
  queda `pending`; de `rejected` queda `rejected`); nunca lo convierte en `pending`.
- Presupuesto ya aceptado y el admin agrega/acepta/rechaza/edita/elimina un repuesto
  → RESUELTO por RF-12: el cambio envía `budget_accepted: 0`, la aceptación del
  cliente se reinicia y este revisa de nuevo el estado actual; no se auto-acepta nada.
- Orden con repuestos en `pending` cuando el cliente abre el portal → el cliente no los
  ve ni en su suma; si después el admin los acepta, aparecen al refrescar.
- El admin rechaza un repuesto que ya había sido visto → desaparece del portal pero
  sigue en la orden (admin lo ve con badge `rejected`, puede deshacerlo con **Aceptar**
  o eliminarlo). Lo simétrico: rechazar un `accepted` lo oculta del portal de nuevo.
- Un repuesto conserva `approvalStatus: "approved"` por haber sido escrito con el
  vocabulario viejo → el sistema NO lo interpreta como aceptado (el valor válido es
  `accepted`); el admin lo ve con badge de estado desconocido y puede seguir
  gestionándolo con Editar/Eliminar. Nota: la orden 30 se corrigió en la BD a
  `accepted` a mano; el renombre de T-15 es lo que alinea el código.
- El backend aún no devuelve `approvalStatus` (mientras no esté RF-10) → el portal
  trata el repuesto como visible (fallback `undefined`), y el admin ve los badge en
  estado desconocido sin botones de aceptación.
- JSON corrupto en `parts` → degradar a lista vacía sin tumbar la vista (igual criterio
  que la normalización de spec 007).
- Modo offline → el `PATCH` con el cambio de estado (o con la persistencia inmediata de
  RF-12) se encola igual que el resto.

### Limitaciones conocidas (declaradas, fuera de alcance de corrección en esta spec)

- Escrituras concurrentes sobre el array `parts`: si el técnico solicita un repuesto
  con el detalle del admin abierto, un "Guardar Cambios" del admin (que serializa su
  copia del array) pisaría la solicitud. Es un last-write-wins preexistente de todo el
  guardado de orden. RF-12 (persistencia inmediata de repuestos) reduce bastante el
  riesgo, pero el caso queda declarado.
- Tolerancia a repuestos sin `id`: RESUELTO con T-14 (ya NO es un riesgo de pérdida
  de datos). Mientras el backend no devuelva `id` (RF-10), admin y técnico asignan un
  `id` de respaldo al cargar (helper `assignFallbackPartIds`, ejecutado una sola vez al
  montar) y el portal ya tenía el suyo, de modo que las acciones por repuesto
  (editar/eliminar/aceptar/rechazar) aciertan SIEMPRE al repuesto correcto y nunca
  afectan a todos a la vez. Lo único que sigue pendiente es lo persistente: los `id`
  de respaldo los genera el frontend y, hasta RF-10, el backend no los devuelve, así
  que no son estables entre sesiones/vistas.
- El portal solo envía `budget_accepted` a nivel de orden; las decisiones por repuesto
  son estado local de la sesión de revisión (el backend las ignora).
- Datos guardados con el vocabulario viejo (`approvalStatus: "approved"`) no se migran
  automáticamente: se corrigen a mano en la BD si aparecen. No hay script de migración
  porque `parts` es un JSON gestionado por el backend y el único caso conocido se
  corrigió manualmente.

## Fuera de alcance

- Notificaciones push/email al admin o al mecánico (el badge es cálculo local).
- Notificar al cliente cuando el admin acepta un repuesto nuevo.
- Migración a `budget_items` (código muerto; se sigue con `parts`).
- Campos nuevos en la DB o cambios de schema.
- Aceptación masiva de solicitudes.
- Historial/auditoría con fechas y autor de la decisión (solo queda el estado).
- Permisos granulares (se asume que quien accede a la vista admin es admin); RF-13 es
  la única regla de rol sobre repuestos.
- Corregir el last-write-wins de escrituras concurrentes sobre `parts` (limitación
  conocida preexistente).
- Enviar las decisiones por repuesto del portal al backend (siguen siendo estado local
  de la sesión de revisión).

## Criterios de finalización

- **Condicional al backend**: la aceptación end-to-end del flujo depende de que el
  backend cumpla RF-10 y RF-11 (prerrequisitos implementados por el usuario lado
  PHP/MariaDB). Hasta entonces, `pending`/`rejected` llegarían al portal como
  `undefined` y se mostrarían; en el interim solo se verifica: (a) el filtrado
  client-side de RF-7 en el portal sobre los campos que sí lleguen, (b) la tolerancia
  del frontend a repuestos sin `approvalStatus` y sin `id` (fallbacks de casos
  límite), y (c) que el admin/técnico persistan los cambios correctamente vía PATCH.
  La spec NO se da por implementada end-to-end sin RF-10/RF-11.
- Las acciones por repuesto (editar, eliminar, aceptar, rechazar) aciertan al repuesto
  CORRECTO aunque el backend no devuelva `id` (RF-10 pendiente): admin y técnico
  asignan `id` de respaldo al cargar y el portal ya lo hace con el suyo, de modo que
  ninguna acción afecta a todos los repuestos a la vez (sin riesgo de pérdida de
  datos; cerrado con T-14).
- El técnico solicita un repuesto y queda `pending`; el admin lo ve con Aceptar/Rechazar
  y siempre con Editar/Eliminar (en ningún estado desaparecen), y con el badge "Solicitud
  del técnico" si `requestedByTechnician: true`.
- El admin puede deshacer una decisión: aceptar un `rejected` lo deja `accepted` y
  rechazar un `accepted` lo deja `rejected`, con el mismo mecanismo (incluido el paso
  de precio, cuyo cancelar respeta el estado original) que desde `pending`.
- Aceptar sin precio (o con `unit_price` `0`/`null`/`undefined`) pide `unit_price`;
  con precio acepta directo.
- Repuestos del admin quedan `accepted`; los de checkin también nacen `accepted`; los
  legacy sin `approvalStatus` son visibles en el portal; `pending`/`rejected` no
  aparecen en el portal ni en sus totales.
- En todo el flujo de repuestos el único valor que significa "aceptado por el admin"
  es `"accepted"`: no queda ningún `"approved"` dentro de `approvalStatus`, y el valor
  `"approved"` del `OrderStatus` de la ORDEN sigue intacto (no se confunde ni se
  renombra).
- Toda acción del admin sobre repuestos (agregar, aceptar, rechazar, editar, eliminar)
  persiste de inmediato vía PATCH con `budget_accepted: 0`; perder la navegación sin
  guardar no pierde la decisión.
- El técnico solo puede eliminar sus propias solicitudes no aceptadas (RF-13).
- El dashboard admin muestra el contador de órdenes con pendientes junto a la lista de
  la pestaña Órdenes y se recalcula al refrescar.
- Repuestos legacy sin `approvalStatus` muestran badge neutro "Ingresado" y sin botones
  de aceptación en el admin.
- `API_FRONTEND.md` actualizado con el contrato nuevo (RF-14) usando
  `pending`/`accepted`/`rejected`.
- `npm run lint && npm run typecheck` sin errores.
- `node --test` en verde con los helpers puros (regla de visibilidad de repuestos).

## Decisiones de diseño (contrato, aprobadas por el usuario)

1. El ciclo es mecánico-solicita (`pending`) → admin acepta/rechaza → cliente
   aprueba/rechaza (ya existente). El mecánico nunca deja el repuesto "directo".
2. El admin acepta/rechaza con botones; al aceptar puede (y si falta, debe) poner el
   `unit_price`. Esquema de botones por estado: Editar y Eliminar SIEMPRE visibles;
   Aceptar se muestra en `pending` y `rejected` (en `rejected` funciona como deshacer
   del rechazo); Rechazar se muestra en `pending` y `accepted` (en `accepted` funciona
   como deshacer de la aceptación). Los repuestos sin `approvalStatus` muestran solo
   Editar/Eliminar. Los botones existen solo en el detalle editable, no en el
   historial de solo lectura.
3. Rechazado = `rejected`, oculto al cliente, conservado en la orden; el admin puede
   eliminarlo manualmente.
4. El aviso al admin es un badge/contador en el dashboard (pestaña Órdenes, junto a la
   lista), calculado en frontend.
5. El cliente ve solo repuestos aceptados por el admin (o legacy sin estado).
6. Sin campos nuevos de DB: todo vive en la columna `parts` (JSON/TEXT), tratada por el
   backend como string opaco.
7. Convención de nombres: camelCase DENTRO de los objetos de `parts`
   (`approvalStatus`, `requestedByTechnician`); snake_case en claves de nivel superior
   del payload (columnas MySQL). No se renombra nada del frontend actual.
   **Excepción declarada a la constitución #6** ("API en snake_case"): el usuario
   aprobó explícitamente el camelCase dentro de `parts` porque esos campos son
   estructura interna del JSON de la columna, no columnas MySQL; no es un descuido.
8. Los repuestos que agrega el admin nacen `approvalStatus: "accepted"` y los de
   recepción/checkin también (antes: los del admin `"pending"` y los de recepción sin
   el campo). El repuesto del admin no necesita revisión del admin: solo la aprobación
   del cliente.
9. Regla de filtrado del portal: visible si `approvalStatus` es `undefined` (solo
   legacy) o `"accepted"`; el total del portal lo gating la decisión del cliente por
   repuesto dentro de su sesión de revisión.
10. **D1 — Reinicio del presupuesto**: cualquier cambio del admin sobre los repuestos
    (agregar, aceptar, rechazar, editar, eliminar) se PERSISTE DE INMEDIATO vía PATCH
    (como el modal del técnico y el checklist, no "staged" hasta "Guardar Cambios") y
    envía `budget_accepted: 0`. Así `approvalStatus` gating SOLO la VISIBILIDAD en el
    portal y la decisión del cliente gating el TOTAL; el cliente SIEMPRE revisa el
    estado actual y no hace falta auto-aceptar nada. Los datos de vehículo/cliente
    siguen staged hasta "Guardar Cambios".
11. **D2 — Permisos del técnico**: el técnico puede ver todos los repuestos de la
    orden (contexto) pero solo puede eliminar un repuesto si
    `requestedByTechnician: true` Y `approvalStatus !== "accepted"`; nunca borra
    repuestos aceptados ni los que agregó el admin.
12. Repuestos legacy/sin `approvalStatus` en el admin: badge neutro "Ingresado" (sin
    color de estado, a elección de implementación texto equivalente) en lugar del
    `default` actual de `getPartStatusBadge`, que renderiza basura; y sin botones de
    aceptación.
13. **Vocabulario (revisión T-15)**: `approvalStatus` representa la decisión del
    ADMIN y sus valores son `pending` / `accepted` / `rejected`; `"approved"` queda
    prohibido en `approvalStatus` porque colisiona con el lenguaje de "aprobado por el
    cliente". La aprobación del cliente vive en `budget_accepted` y en las decisiones
    por repuesto de la sesión del portal. El valor `"approved"` del `OrderStatus` de la
    ORDEN no se toca. Consecuencia de UI: botón **Aceptar**, badge **Aceptado** y
    textos del diálogo de precio en "Aceptar"; los nombres internos de handlers
    (`handleApprovePart`, `confirmApprovePart`) pueden quedarse como están si
    renombrarlos añade riesgo.

## Dudas abiertas

- Ninguna bloqueante: las decisiones de flujo, estados, visibilidad, badge y contrato
  backend fueron acordadas con el usuario; D1 (reinicio inmediato del presupuesto), D2
  (permisos del técnico) y la decisión 13 (vocabulario `accepted`) cerraron los huecos
  del review QA, y RF-10/RF-11 quedan como prerrequisito de backend a implementar del
  lado PHP/MariaDB por el usuario.
- Confirmación menor (no bloqueante, cosmética): el texto exacto del badge neutro de
  repuestos legacy ("Ingresado" es la propuesta de la decisión 12).
