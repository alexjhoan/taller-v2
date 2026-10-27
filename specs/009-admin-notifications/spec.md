# Spec 009 — Notificaciones del administrador (campana en la barra superior)

Estado: planificada

## Contexto y objetivo

Hoy el admin no se entera de lo que pasa en sus órdenes sin refrescar la lista y abrir
las órdenes una por una. Cuando un mecánico solicita un repuesto, cuando el cliente
acepta el presupuesto, cuando rechaza ítems, cuando entra una orden nueva o cuando
alguien cambia el estado de una orden, el admin solo lo descubre si está mirando la
pantalla correcta en el momento correcto.

Objetivo: dar al admin un punto único de aviso —una campana en la barra superior, junto
al reloj, con contador de pendientes— que abra un modal con las alertas **no leídas** y
que, al hacer clic en una, la marque como leída y lleve al admin directo a la orden que
la originó.

Estado actual del código y del backend (verificado):

- La barra superior es única (sticky). El reloj vive a la derecha; el avatar+nombre+rol
  de escritorio a la izquierda; en móvil (<425px) el avatar es un desplegable a la
  derecha. No hay hueco reservado para la campana: hay que insertarla junto al reloj.
- El detalle de orden del admin **no es una ruta propia**: se abre inline en
  `/admin/dashboard?selectedOrderId={id}` y la página restaura la selección desde el
  query param. Ese es el destino del clic.
- El cliente API ya declara `alerts: '/api/alerts'` en `endpoints`. Las respuestas van
  envueltas en `{ status, body, statusText }`; los errores se normalizan como
  `[ApiError STATUS] detalle` y el modo offline devuelve
  `{ status: 503, statusText: 'OfflineMode' }`.
- **La tabla `alerts` YA existe y está en uso.** `GET /api/alerts` responde `200` con 6
  filas reales, todas pendientes (`read_at: null`), con esta forma:

  ```json
  {"id":"7","order_id":"31","type":"customer_decision","message":"El cliente actualizo la decision del presupuesto","read_at":null,"created_at":"2026-10-17 14:08:01"}
  ```

  Columnas reales: `id`, `order_id`, `type`, `message`, `read_at`, `created_at`. No hay
  `user_id`, ni `is_read`, ni `title`, ni clave de deduplicación.
- `POST /api/public/order/{token}/decision` ya inserta una alerta
  (`type: "customer_decision"`) cuando el cliente decide sobre el presupuesto. Esas 6
  filas existentes deben aparecer de inmediato en la campana nueva.
- El portal del cliente **no tiene** un "rechazar presupuesto" global: tiene "Aceptar
  Presupuesto" (`PATCH /api/public/order/{token}` con
  `{ budget_accepted: 1, status: "approved" }`) y decisiones por ítem
  (`POST /api/public/order/{token}/decision` con
  `{ items: [{ id, decision: "accepted" | "rejected" }] }`).

Alcance: **solo administradores**. Los mecánicos no ven la campana. El backend genera
las alertas (no el frontend) y las guarda para que sobrevivan a recargas y a sesiones
cerradas.

**Decisión de alcance técnica:** esta feature se construye **sobre la tabla `alerts`
existente**, sin crear tablas nuevas ni duplicar datos. Lo que falta es filtrar por no
leídas, marcar leídas y emitir tipos de alerta más específicos que el
`customer_decision` genérico actual.

## Usuarios

- Admin: recibe las alertas, ve el contador, abre el modal y salta a la orden.
- Mecánico: no ve la campana y no recibe alertas; con sus acciones (solicitar repuesto,
  crear orden) **genera** alertas para el admin.
- Cliente (portal): con sus decisiones (aceptar presupuesto, rechazar ítems) genera
  alertas para el admin, sin ver nada de esto.

## Historias de usuario

- HU-1. Como admin, quiero ver una campana con el número de alertas pendientes en la
  barra superior para enterarme de lo que pasa sin refrescar ni abrir órdenes.
- HU-2. Como admin, quiero abrir un modal y ver solo lo pendiente para atenderlo sin
  ruido de cosas ya vistas.
- HU-3. Como admin, quiero que al hacer clic en una alerta me lleve a la orden concreta
  y la marque leída para no volver a verla.
- HU-4. Como admin, quiero poder marcar todas como leídas de una vez para limpiar la
  bandeja cuando ya las revisé.
- HU-5. Como admin, quiero que el contador se actualice solo para no estar recargando
  la página.
- HU-6. Como admin en el móvil, quiero que campana, reloj y avatar convivan sin
  romperse ni solaparse.
- HU-7. Como admin, quiero que las alertas las genere el sistema ante hechos reales
  (repuesto solicitado, presupuesto aceptado o rechazado, orden creada, estado
  cambiado) para no depender de tener la app abierta.
- HU-8. Como admin, quiero que el mensaje de cada alerta se entienda solo (quién, qué
  orden, qué pasó) para poder actuar sin abrirla primero.

## Definiciones

- **Alerta**: fila de la tabla `alerts`. Aviso con `type`, `message`, `order_id`
  opcional, `read_at` (NULL = pendiente) y `created_at`.
- **Pendiente**: alerta con `read_at IS NULL`. El modal muestra solo pendientes.
- **Tipos nuevos** (valores exactos de `type` que el backend debe emitir desde ahora):
  `order_created`, `order_status_changed`, `part_requested`, `budget_accepted`,
  `budget_rejected`.
- **Tipo legacy**: `customer_decision`, ya presente en la BD. Se tolera en la UI con
  etiqueta genérica "Decisión del cliente"; no se migra ni se vuelve a emitir.
- **Creador de la orden**: valor de `work_orders.created_by`.
- **Repuesto solicitado por el mecánico**: ítem de `parts` con
  `requestedByTechnician === true` y `approvalStatus === "pending"` (vocabulario de
  spec 008).
- **Lectura compartida**: al no existir `user_id`, el estado leído es global: cualquier
  admin que marque una alerta la marca leída para todos.

## Requisitos funcionales

### Campana y contador

- RF-1: SI el usuario autenticado tiene rol `admin`, ENTONCES EL SISTEMA muestra en la
  barra superior un botón de campana junto al reloj; SI el rol es `mechanic` (o no hay
  sesión), ENTONCES EL SISTEMA no renderiza la campana ni consulta las alertas.
- RF-2: EL SISTEMA muestra sobre la campana un contador con el número de alertas
  pendientes devueltas por el listado (`GET /api/alerts?unread=1`), y lo oculta cuando
  el valor es `0`. El contador se actualiza sin recargar la página.
- RF-3: SI el número de pendientes alcanza el tope de 50, ENTONCES EL SISTEMA muestra
  "50+" en el contador en lugar de "50", para no afirmar un total que no conoce.
- RF-4: CUANDO el contador cambia de valor, EL SISTEMA actualiza el texto accesible de
  la campana en el mismo render (no solo el número visible).

### Modal de pendientes (acceso rápido)

- RF-5: CUANDO el admin hace clic en la campana, EL SISTEMA abre un modal con la lista
  de alertas **pendientes** (`read_at IS NULL`) ordenadas de la más reciente a la más
  antigua. El modal no muestra alertas ya leídas ni un historial completo.
- RF-6: EL SISTEMA cierra el modal con el botón de cerrar, con clic en el fondo y con
  la tecla Escape, y devuelve el foco a la campana al cerrarse.
- RF-7: CUANDO el admin hace clic en una alerta, EL SISTEMA (a) la marca como leída,
  (b) la quita de la lista y descuenta el contador, y (c) navega a
  `/admin/dashboard?selectedOrderId={order_id}`. El orden es: marcar leída primero,
  navegar después. SI el marcado falla, ENTONCES EL SISTEMA navega igual y muestra
  feedback de error; la alerta reaparecerá en el siguiente refresco si el marcado no
  llegó a persistir.
- RF-8: SI una alerta no tiene `order_id`, ENTONCES EL SISTEMA solo la marca como leída
  y no navega.
- RF-9: SI hay al menos una alerta pendiente, ENTONCES EL SISTEMA muestra en el modal el
  botón "Marcar todas como leídas"; CUANDO el admin lo pulsa, EL SISTEMA marca todas las
  pendientes como leídas, vacía la lista y deja el contador en `0`. SI no hay
  pendientes, el botón no se muestra.
- **RF-9b: SI hay alertas (pendientes o leídas), EL SISTEMA muestra en el modal el botón
  "Ver todas" que navega a la página `/notifications` (nueva ruta) para ver el historial
  completo con pestañas.**
- RF-10: EL SISTEMA muestra en cada alerta una etiqueta de tipo, el `message` y la fecha
  de creación en formato legible (`dd/mm/aaaa hh:mm` o equivalente local). No existe
  columna de título: la etiqueta de tipo hace de encabezado. Los mensajes largos se
  muestran hasta un máximo de 2 líneas con elipsis, sin romper el ancho del modal ni
  generar scroll horizontal.
- RF-11: EL SISTEMA tolera tipos desconocidos o legacy: `customer_decision` se muestra
  con la etiqueta "Decisión del cliente"; cualquier otro `type` no mapeado se muestra
  con la etiqueta genérica "Notificación". En ambos casos se usa un icono por defecto y
  la UI no se rompe ni descarta la alerta.

### Página de notificaciones (`/notifications`) — Historial completo

- **RF-26: EL SISTEMA expone la ruta `/notifications` (protegida por `withAuth`, solo `admin`)
  que renderiza una página completa con dos pestañas: "No leídas" y "Leídas".**
- **RF-27: La pestaña "No leídas" consulta `GET /api/alerts?unread=1` y muestra la lista
  con las mismas tarjetas que el modal (etiqueta tipo, mensaje, fecha), ordenadas por
  `created_at DESC`. Incluye botón "Marcar todas como leídas" y botón de refresh.**
- **RF-28: La pestaña "Leídas" consulta `GET /api/alerts?read=1` (nuevo parámetro) y
  muestra la lista de alertas con `read_at IS NOT NULL`, ordenadas por `read_at DESC`
  (más reciente leída primero). No incluye botones de acción (solo lectura).**
- **RF-29: Ambas pestañas comparten el mismo componente de lista reutilizable; el estado
  activo se refleja en la URL (`/notifications?tab=unread` / `?tab=read`) para permitir
  enlaces directos y navegación con botones del navegador.**
- **RF-30: La página incluye header con título "Notificaciones", badge con contador total
  (pendientes + leídas), y breadcrumb/nav para volver al dashboard.**
- **RF-31: Estados de carga, vacío ("No hay notificaciones no leídas" / "No hay notificaciones leídas"),
  error con "Reintentar", y offline 503 idénticos al modal.**
- **RF-32: Accesibilidad completa: tabs con `role="tablist"`, `aria-selected`, `aria-controls`,
  foco visible, navegación con teclado (←/→ entre tabs, Tab dentro de lista).**

### Actualización automática

- RF-12: MIENTRAS la sesión es de un admin, EL SISTEMA consulta las alertas pendientes
  cada **120 segundos** y también al recuperar el foco de la ventana, sin recargar la página
  y sin perder el estado del modal abierto.
- RF-13: SI una consulta automática falla, ENTONCES EL SISTEMA conserva el último estado
  conocido (contador y lista) y no muestra un error global ni cierra el modal; el
  siguiente ciclo puede recuperarse solo.

### Estados de la interfaz

- RF-14: MIENTRAS la primera consulta está en curso, EL SISTEMA muestra la campana sin
  contador y, si el modal está abierto, un indicador de carga en lugar de la lista.
- RF-15: SI no hay alertas pendientes, ENTONCES EL SISTEMA muestra en el modal el texto
  exacto "No tienes notificaciones pendientes" y el contador permanece oculto.
- RF-16: SI la consulta falla con un error distinto de offline, ENTONCES EL SISTEMA
  muestra en el modal un mensaje de error con un botón "Reintentar" que vuelve a
  consultar; la campana sigue visible y conserva el último contador conocido (o sin
  contador si nunca hubo datos).
- RF-17: SI la consulta devuelve `503` / `OfflineMode`, ENTONCES EL SISTEMA no rompe la
  barra ni la página: mantiene el último estado conocido y, en el modal, muestra un
  aviso de sin conexión con "Reintentar". Si nunca hubo datos, el contador queda en `0`
  (oculto) y el modal informa que no se pudieron cargar las alertas.

### Accesibilidad y responsive

- RF-18: EL SISTEMA expone la campana como botón con `aria-label` dinámico
  ("Notificaciones, N sin leer" cuando N > 0; "Notificaciones" cuando N = 0),
  `aria-haspopup="dialog"` y `aria-expanded` según el estado del modal. El modal usa
  `role="dialog"`, `aria-modal="true"` y un título asociado; el botón de cerrar tiene
  `aria-label="Cerrar"`.
- RF-19: EL SISTEMA permite operar la campana, el modal y cada alerta solo con teclado:
  Tab alcanza la campana y cada ítem, Enter/Espacio activan, Escape cierra y el foco
  visible nunca se pierde. El número del contador no es la única señal: el texto
  accesible de RF-18 lo comunica.
- RF-20: EL SISTEMA mantiene campana, reloj y avatar en la misma barra sin solaparse ni
  provocar scroll horizontal desde 320px de ancho. SI a 320px no cabe la hora completa,
  ENTONCES EL SISTEMA oculta el texto de la hora y conserva el icono del reloj con la
  hora en su texto accesible.
- RF-21: EL SISTEMA cumple contraste mínimo AA (4.5:1) en el contador, la etiqueta de
  tipo, el mensaje y la fecha, y no comunica el estado solo por color.

### Contrato de backend (lo implementa el usuario, lado PHP/MariaDB)

- RF-22: EL SISTEMA (backend) expone `GET /api/alerts` con parámetros de consulta:
  - `unread=1` → devuelve **solo alertas con `read_at IS NULL`**, ordenadas por `created_at DESC, id DESC`, máx. 50 filas.
  - `read=1` → devuelve **solo alertas con `read_at IS NOT NULL`**, ordenadas por `read_at DESC, id DESC`, máx. 50 filas.
  - Sin parámetros (o `unread=0&read=0`) → comportamiento actual (todas las alertas, mismo orden).
  - Auth: JWT, solo rol `admin`. Respuesta: `{ status, statusText, body: Alert[] }`.
  - `401` sin token/inválido; `403` si rol ≠ `admin`.
- RF-23: EL SISTEMA (backend) expone `PATCH /api/alerts` que recibe `{ "id": 7 }`, fija
  `read_at = NOW()` en esa alerta y devuelve `200` con la fila actualizada. El frontend
  **nunca** envía `read_at` ni ningún timestamp. SI el `id` no existe, `404`; SI falta
  `id`, `422`. Marcar una alerta ya leída es idempotente y responde `200` sin cambiar
  `read_at`.
- RF-24: EL SISTEMA (backend) expone `POST /api/alerts/read-all` que fija
  `read_at = NOW()` en todas las alertas pendientes y devuelve `{ "updated": n }`. SI no
  había pendientes, responde `200` con `{ "updated": 0 }`.
- RF-25: EL SISTEMA trata el estado leído como **compartido entre admins**: al no existir
  `user_id`, la alerta marcada por un admin deja de estar pendiente para todos. La UI no
  distingue autores de lectura.
- RF-26: EL SISTEMA (backend) genera la alerta `order_created` CUANDO se crea una orden
  (`POST /api/orders`), con `order_id` de la orden nueva. SI el creador (`created_by`)
  es un admin, ENTONCES esa alerta no se genera para evitar que el admin se notifique a
  sí mismo; si la crea un mecánico o la recepción, sí se genera.
- RF-27: EL SISTEMA (backend) genera la alerta `part_requested` CUANDO un `PATCH
  /api/orders` introduce un repuesto nuevo en `parts` con
  `requestedByTechnician === true` y `approvalStatus === "pending"` que no existía con
  ese estado antes del cambio. Compara el `parts` anterior con el nuevo por `id` de
  repuesto. Un repuesto que ya estaba `pending` antes del PATCH no vuelve a alertar.
- RF-28: EL SISTEMA (backend) genera la alerta `budget_accepted` CUANDO un `PATCH
  /api/orders` cambia `budget_accepted` de `0` a `1` (transición real). SI
  `budget_accepted` ya era `1`, ENTONCES no alerta. Como spec 008 reinicia
  `budget_accepted` a `0` ante cambios de repuestos, una aceptación posterior vuelve a
  ser una transición `0 → 1` y sí alerta.
- RF-29: EL SISTEMA (backend) genera la alerta `order_status_changed` CUANDO un `PATCH
  /api/orders` cambia el `status` de la orden respecto al valor anterior. SI el `status`
  recibido es igual al anterior, ENTONCES no alerta. El mensaje incluye el estado nuevo
  legible.
- RF-30: EL SISTEMA (backend) genera alertas en `POST /api/public/order/{token}/decision`
  en lugar del `customer_decision` genérico actual: SI al menos un ítem queda
  `rejected`, ENTONCES genera `budget_rejected`; SI todos los ítems quedan `accepted`,
  ENTONCES genera `budget_accepted`. No existe un "rechazo global": el rechazo se
  detecta por ítem.
- RF-31: EL SISTEMA (backend) es idempotente en la generación **sin clave de
  deduplicación**: solo inserta cuando hay un cambio real respecto al estado anterior.
  Repetir el mismo `PATCH` (mismos valores) no crea alertas nuevas. Además, para
  `budget_accepted` evita la doble alerta cuando la decisión del portal y el `PATCH` de
  aceptación llegan seguidos: SI ya existe una alerta `budget_accepted` con
  `read_at IS NULL` para la misma orden, ENTONCES no inserta otra.
- RF-32: EL SISTEMA (backend) redacta `message` en español, accionable y autocontenido
  (cliente, placa y el dato clave: repuesto, monto o estado nuevo), truncado a 255
  caracteres. No hay columna `title`: el mensaje debe entenderse solo.
- RF-33: EL SISTEMA exige actualizar `API_FRONTEND.md` con el contrato de `alerts`
  (esquema real, tipos, los 3 endpoints y las reglas de generación). Regla de la
  constitución #2: la funcionalidad nace documentada.

## Contrato de backend (detalle)

> Esta sección es el contrato que el backend PHP/MariaDB debe cumplir. El frontend se
> implementa contra ella; cualquier desviación rompe la integración. El prompt
> autocontenido para el agente de backend está en `backend-prompt.md`.

### Esquema real de `alerts` (ya existe — no se crea ni se altera)

```sql
-- Esquema de referencia (ya desplegado en producción; NO ejecutar un CREATE nuevo)
CREATE TABLE `alerts` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `order_id`   INT NULL DEFAULT NULL,
  `type`       VARCHAR(50) NOT NULL,
  `message`    VARCHAR(255) NOT NULL,
  `read_at`    DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Notas:

- Los nombres y tipos exactos deben confirmarse con `SHOW CREATE TABLE alerts` antes de
  tocar nada; el bloque de arriba es la referencia del contrato, no una migración.
- **Sin `user_id`, sin `is_read`, sin `title`, sin `dedupe_key`.** No se añaden.
- Índice **opcional y aditivo** (solo si el volumen lo justifica, no cambia columnas):
  `CREATE INDEX idx_alerts_read_created ON alerts (read_at, created_at);`
- `id` y `order_id` pueden llegar al frontend como string (`"7"`, `"31"`); la UI los
  tolera y navega igual.

### Objeto `Alert`

```json
{
  "id": "12",
  "order_id": "47",
  "type": "part_requested",
  "message": "Carlos pidió \"Filtro de aceite\" en la orden HD668JF (Juan Pérez).",
  "read_at": null,
  "created_at": "2026-10-23 09:41:00"
}
```

- `type` nuevos: `order_created`, `order_status_changed`, `part_requested`,
  `budget_accepted`, `budget_rejected`. Legacy tolerado: `customer_decision`.
- `read_at` es `null` (pendiente) o `"YYYY-MM-DD HH:MM:SS"`.
- `order_id` puede ser `null`, pero los 5 eventos de esta feature siempre lo traen.

### Etiquetas e iconos por tipo (UI)

| `type` | Etiqueta visible | Icono |
|---|---|---|
| `order_created` | Orden nueva | documento |
| `order_status_changed` | Orden actualizada | refrescar |
| `part_requested` | Repuesto solicitado | llave/herramienta |
| `budget_accepted` | Presupuesto aceptado | check |
| `budget_rejected` | Ítems rechazados | equis/alerta |
| `customer_decision` (legacy) | Decisión del cliente | campana (por defecto) |
| desconocido | Notificación | campana (por defecto) |

### Endpoints

| Método | Ruta | Auth | Payload | Respuesta `200` |
|---|---|---|---|---|
| GET | `/api/alerts?unread=1` | JWT, rol `admin` | — | `{ status, statusText, body: Alert[] }` (solo `read_at IS NULL`, máx. 50, DESC) |
| PATCH | `/api/alerts` | JWT, rol `admin` | `{ "id": 7 }` | `{ status, statusText, body: Alert }` (fila con `read_at` seteado) |
| POST | `/api/alerts/read-all` | JWT, rol `admin` | — (cuerpo vacío) | `{ status, statusText, body: { "updated": 3 } }` |

Errores: `401` token ausente/inválido, `403` rol distinto de `admin`, `404` id
inexistente, `422` payload inválido, `500` error de base de datos.

`GET /api/alerts` sin `unread=1` mantiene el comportamiento actual (todas las alertas)
para no romper otros consumidores.

### Mensajes por tipo (propuesta)

| `type` | `message` |
|---|---|
| `order_created` | `Nueva orden de {customer_name} ({vehicle_plate}).` |
| `order_status_changed` | `La orden {vehicle_plate} pasó a "{estado legible}".` |
| `part_requested` | `{mecánico} pidió "{repuesto}" en la orden {vehicle_plate} ({customer_name}).` |
| `budget_accepted` | `El cliente aceptó el presupuesto de la orden {vehicle_plate} ({monto}).` |
| `budget_rejected` | `{customer_name} rechazó {n} ítem(s) del presupuesto de la orden {vehicle_plate}.` |

Sin `title`: el mensaje debe incluir siempre el dato clave (repuesto, monto o estado) y
la referencia de la orden (placa o `#id`).

### Reglas de generación (server-side, escriben en `alerts`)

1. **`order_created`** — al insertar la orden con éxito, `INSERT INTO alerts
   (order_id, type, message)`. Si `created_by` es un admin, no se inserta.
2. **`part_requested`** — al actualizar la orden, comparar el `parts` anterior con el
   nuevo; alertar cada repuesto que ahora está
   `requestedByTechnician === true && approvalStatus === "pending"` y antes no lo estaba.
3. **`budget_accepted`** — al actualizar la orden, solo si `anterior == 0 && nuevo == 1`,
   y solo si no existe ya una alerta `budget_accepted` pendiente para esa orden.
4. **`order_status_changed`** — al actualizar la orden, solo si `anterior != nuevo`.
5. **`budget_rejected`** — al guardar decisiones del portal, si al menos un ítem quedó
   `rejected`. Si todos quedaron `accepted`, se emite `budget_accepted` (en lugar del
   `customer_decision` genérico).

La idempotencia se apoya en comparar estado anterior vs. nuevo (no hay `dedupe_key`):
un reintento del mismo `PATCH` ve los mismos valores y no vuelve a insertar.

## Casos límite

- **Las 6 alertas legacy `customer_decision` existentes**: aparecen de inmediato en la
  campana (están pendientes), con etiqueta "Decisión del cliente" e icono por defecto.
  No se migran ni se vuelven a emitir.
- **Orden borrada o inexistente al hacer clic**: la alerta guarda un `order_id` que ya
  no existe. Al navegar, el dashboard no encuentra la orden y se queda en la lista sin
  romperse; la alerta ya quedó leída. No se muestra un error técnico.
- **Alerta ya leída en otra pestaña o dispositivo**: el `PATCH` responde `200`
  (idempotente) o `404` si fue borrada; en ambos casos desaparece de la lista y el
  contador se corrige en el siguiente refresco.
- **Dos admins**: el estado leído es compartido. Que uno lea una alerta la hace
  desaparecer para el otro también. Es el comportamiento aceptado hoy (un solo admin
  operativo); la contrapartida es que un admin puede "consumir" avisos del otro.
- **Duplicados por reintentos**: repetir el mismo `PATCH`/`POST` no crea filas nuevas
  porque no hay cambio de estado respecto al anterior.
- **Doble alerta de aceptación**: el portal envía decisiones por ítem (todas
  `accepted`) y además el `PATCH` con `budget_accepted: 1`. La guarda de RF-31 evita la
  segunda alerta si la primera sigue pendiente.
- **Admin que crea la orden**: no genera `order_created`; si la crea un mecánico, sí.
- **PATCH que no cambia nada relevante** (solo datos del vehículo/cliente, mismo
  `status`, `budget_accepted` ya en `1`, repuestos ya `pending`): no genera alertas.
- **Presupuesto aceptado, luego repuestos cambiados (spec 008)**: el reinicio a
  `budget_accepted: 0` permite que una nueva aceptación vuelva a alertar. No es
  duplicado.
- **Rechazo de un solo ítem y aceptación del resto**: se emite `budget_rejected`; si el
  cliente además pulsa "Aceptar Presupuesto", se emite también `budget_accepted`. Son
  dos hechos distintos y ambas alertas son válidas.
- **Offline**: `GET` devuelve `503 / OfflineMode`; la barra y el modal no se rompen, se
  conserva el último estado conocido y se ofrece "Reintentar".
- **Más de 50 pendientes**: el `GET` devuelve 50 y el contador muestra "50+"; el modal
  lista las 50 más recientes.
- **Textos largos**: mensajes de más de 2 líneas se truncan visualmente con elipsis; el
  backend trunca a 255 caracteres al guardar.
- **Admin sin alertas**: contador oculto y modal con "No tienes notificaciones
  pendientes"; "Marcar todas" no aparece.
- **Sesión expirada durante el polling**: el `401` no rompe la barra; el flujo de sesión
  existente redirige al login y la campana desaparece al perder el rol.
- **Campana abierta y llega una alerta nueva**: el modal se refresca en el siguiente
  ciclo de 30 s sin cerrarse ni perder el scroll.
- **`id`/`order_id` como string en el JSON**: se toleran; el `PATCH` envía el `id` tal
  como llegó y la navegación usa `order_id` sin comparaciones estrictas de tipo.
- **Tipo desconocido** (otro consumidor inserta un `type` nuevo): etiqueta
  "Notificación", icono por defecto, la alerta se muestra y se puede marcar leída.

## Fuera de alcance

- Notificaciones push, email, SMS o WhatsApp.
- WebSockets, SSE o cualquier canal en tiempo real (se usa polling).
- Preferencias por usuario (silenciar tipos, horarios, sonidos).
- Historial de alertas leídas en la interfaz (solo se muestran pendientes).
- Campana o notificaciones para mecánicos, recepción o clientes.
- Retención, purga o archivado automático de alertas antiguas.
- Badges por tipo, agrupación por orden o contadores por sección.
- Añadir `user_id` o estado leído por admin (camino futuro documentado, no ahora).
- Migrar o eliminar las alertas `customer_decision` históricas.
- Crear una tabla `notifications` nueva o duplicar los datos de `alerts`.
- Notificar al cliente sobre cambios internos de la orden.
- Marcar como leída una alerta desde fuera de la campana (por ejemplo al abrir la orden
  desde la lista).

## Criterios de finalización

- Un admin ve la campana junto al reloj con el número de pendientes; un mecánico no la
  ve y no se hace ninguna petición de alertas en su sesión.
- Las 6 alertas `customer_decision` existentes aparecen en el modal al abrirlo, con
  etiqueta "Decisión del cliente", sin tocar la BD.
- El contador se oculta en `0`, muestra "50+" en el tope y se actualiza sin recargar en
  menos de 30 s tras un hecho nuevo (o al recuperar el foco).
- El modal lista solo pendientes (`read_at IS NULL`), de la más reciente a la más
  antigua, con etiqueta de tipo, mensaje y fecha.
- Clic en una alerta: desaparece de la lista, el contador baja en 1 y se abre la orden
  correcta en `/admin/dashboard?selectedOrderId={id}`.
- "Marcar todas como leídas" vacía la lista y deja el contador en `0`; el botón no
  aparece si no hay pendientes.
- Estados verificados: carga, vacío ("No tienes notificaciones pendientes"), error con
  "Reintentar" y offline (`503`) sin romper la barra.
- Accesibilidad verificada con teclado: campana alcanzable, modal con `role="dialog"`,
  Escape cierra, foco devuelto a la campana, `aria-label` con el número de pendientes.
- Responsive verificado a 320px, 375px, 768px y escritorio: campana, reloj y avatar sin
  solaparse ni scroll horizontal.
- Backend cumple RF-22 a RF-32: `GET ?unread=1` filtra y ordena, `PATCH` fija `read_at`
  sin aceptar timestamps del cliente, `read-all` funciona, y las 5 reglas de generación
  producen una única alerta por hecho real (verificado repitiendo los `PATCH`).
- `GET /api/alerts` sin `unread=1` sigue devolviendo todas las alertas como hasta hoy, y
  `POST /api/public/order/{token}/decision` sigue creando alerta (ahora con tipo
  específico).
- No se crea ninguna tabla nueva; `alerts` conserva sus columnas.
- `API_FRONTEND.md` actualizado con el esquema de `alerts`, los tipos y los 3 endpoints.
- `npm run typecheck` y `npm run build` sin errores; `node --test` en verde con los
  helpers puros de alertas (etiqueta por tipo, conteo y formateo de fecha).

## Decisiones de diseño

1. **Se reutiliza `alerts`; no se crea `notifications`.** La tabla ya existe, ya está en
   uso por el portal y contiene 6 alertas reales pendientes; crear otra tabla obligaría
   a migrar datos y a mantener dos fuentes de verdad. Alternativa descartada: crear
   `notifications` con `user_id`, `is_read`, `title` y `dedupe_key` (más trabajo de
   backend y datos duplicados).
2. **Polling cada 120 s con React Query, no WebSockets.** El backend es PHP sin proceso
   persistente; montar WebSockets exigiría infraestructura nueva para un aviso que no es
   crítico al segundo. 120 s reduce carga en el backend frente a 30 s y sigue siendo
   aceptable para notificaciones no críticas. Alternativa descartada: SSE o WebSocket por
   coste de infraestructura y mantenimiento.
3. **El backend genera y persiste; el frontend solo lee y marca.** Si el frontend
   generara alertas, solo existirían mientras un admin tuviera la app abierta, y cada
   cliente tendría que duplicar reglas de negocio (diff de `parts`, transición de
   `budget_accepted`). El backend es el único que ve todos los cambios, incluidos los
   del portal público. Alternativa descartada: derivar alertas en el frontend comparando
   listas de órdenes.
4. **Estado de lectura compartido, sin `user_id`.** Es la consecuencia de reutilizar
   `alerts`: cualquier admin que marque una alerta la oculta para todos. Se acepta porque
   hoy opera un solo admin; la contrapartida es que un admin puede consumir avisos del
   otro. Camino futuro si hay varios admins: añadir `user_id` (o una tabla
   `alert_reads`) e índice, sin rehacer la UI: el frontend seguiría leyendo el mismo
   listado. Alternativa descartada: posponer la feature hasta tener lectura por usuario.
5. **El contador sale del propio listado, con tope 50 y "50+" visible.** Sin `user_id`
   ni endpoint de conteo, el listado es la única fuente; el tope acota el payload y el
   "50+" evita mentir sobre el total. Alternativa descartada: pedir todas las pendientes
   sin límite.
6. **El modal muestra solo pendientes.** El objetivo es "qué tengo que atender ahora";
   mezclar leídas convierte la campana en un log. Alternativa descartada: lista con
   historial y pestañas.
7. **Marcar leída al hacer clic en la alerta, no al abrir el modal.** Abrir el modal no
   implica haber atendido nada; marcar al abrir vaciaría la bandeja sin que el admin
   leyera. Alternativa descartada: marcar todas al abrir.
8. **`PATCH` recibe solo `{ id }`; el backend pone `read_at = NOW()`.** El cliente no
   debe poder falsificar la fecha de lectura ni depender del reloj del dispositivo.
   Alternativa descartada: enviar `read_at` desde el frontend.
9. **Idempotencia por comparación de estado anterior/nuevo, sin `dedupe_key`.** La
   columna no existe y añadirla sería cambiar el esquema; el diff ya evita duplicados en
   reintentos. Para el único caso con dos caminos (`budget_accepted`) se añade una guarda
   de "ya hay una pendiente para esta orden". Alternativa descartada: añadir
   `dedupe_key` + índice único.
10. **La etiqueta de tipo sustituye al título.** `alerts` no tiene `title`; se deriva del
    `type` en la UI y el `message` carga todo el contexto. Alternativa descartada: añadir
    columna `title` a `alerts`.
11. **Se reutiliza el endpoint ya declarado `alerts: '/api/alerts'`.** Solo se añaden las
    variantes para marcar leída y read-all; no se crea un módulo de endpoints de
    notificaciones paralelo. Alternativa descartada: `/api/notifications`.
12. **Navegación a `/admin/dashboard?selectedOrderId={id}`.** Es el mecanismo que ya usa
    el dashboard para restaurar el detalle inline; no hay ruta de orden propia y crear
    una sería un cambio de arquitectura ajeno a esta spec. Alternativa descartada: nueva
    ruta `/admin/orders/{id}`.
13. **El modal reutiliza el diálogo existente del sistema de UI (`CustomDialog`).** Ya
    resuelve backdrop, Escape y bloqueo de scroll, y en móvil se comporta como hoja
    inferior. Alternativa descartada: popover anclado a la campana (más frágil en 320px
    y sin foco gestionado).
14. **`customer_decision` se tolera como legacy.** Las 6 filas existentes deben verse sin
    migración; se etiquetan "Decisión del cliente" y el backend deja de emitir ese tipo
    genérico. Alternativa descartada: migrar las filas a los tipos nuevos (imposible
    saber si fueron aceptación o rechazo).

## Dudas abiertas

- [NO BLOQUEANTE] Redacción exacta de los mensajes: la tabla de "Mensajes por tipo" es
  una propuesta; el contrato HTTP no cambia si se ajusta el texto.
- [NO BLOQUEANTE] Tope de 50 alertas en `GET ?unread=1`: valor propuesto para acotar el
  payload; si se prefiere otro, solo cambia la constante.
- [NO BLOQUEANTE] La guarda anti-duplicado de `budget_accepted` (RF-31) es una
  recomendación de implementación sin cambio de esquema; si el backend prefiere no
  aplicarla, el riesgo es una alerta duplicada cuando el portal envía decisión y
  aceptación seguidas.
