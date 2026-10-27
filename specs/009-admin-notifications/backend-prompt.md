# Prompt para el agente de backend — Alertas del administrador (Spec 009)

> Copia este archivo completo y pásalo al agente que implementa el backend. Es
> autocontenido: no necesita acceso a la conversación donde se redactó.

---

## 0. Contexto

Proyecto **Mecaflow Workshop OS**: frontend Next.js 14 (Pages Router) que consume una
API **PHP + MariaDB**. El frontend **ya está (o estará) implementado** contra el
contrato de este documento; por eso el contrato HTTP, los nombres de campos y la forma
de las respuestas **deben respetarse exactamente**. Si algo no encaja, no lo renombres:
avisa.

Necesitamos una bandeja de notificaciones **solo para administradores**: una campana en
la barra superior con contador de pendientes y un modal que lista únicamente las no
leídas. Al hacer clic en una, el frontend la marca leída y navega a la orden.

**Restricción principal: NO crear tablas nuevas y NO duplicar datos.** La tabla `alerts`
ya existe y ya está en uso; esta feature se construye encima de ella. Lo que falta es
(a) filtrar pendientes, (b) marcar leídas y (c) emitir tipos de alerta más específicos
que el `customer_decision` genérico actual.

Estado real verificado hoy:

- `GET /api/alerts` responde `200` y devuelve 6 filas, todas pendientes
  (`read_at: null`), con esta forma:

  ```json
  {"id":"7","order_id":"31","type":"customer_decision","message":"El cliente actualizo la decision del presupuesto","read_at":null,"created_at":"2026-10-17 14:08:01"}
  ```

- `POST /api/public/order/{token}/decision` **ya inserta** una alerta con
  `type: "customer_decision"`. Ese comportamiento se mantiene (crear alerta), pero el
  tipo pasa a ser específico (`budget_accepted` / `budget_rejected`).
- Esas 6 filas deben aparecer de inmediato en la campana nueva, sin migración.

Datos del sistema que ya existen:

- Tabla `users` (`id`, `first_name`, `last_name`, `email`, `role`, `active`). Roles:
  `admin`, `mechanic`.
- Tabla `work_orders` (`id`, `public_token`, `customer_name`, `customer_phone`,
  `vehicle_plate`, `status`, `created_by`, `budget_accepted`, `parts`, `created_at`,
  `updated_at`).
- `parts` es JSON/TEXT con un array de repuestos; dentro de cada objeto los campos van en
  **camelCase** (`id`, `name`, `quantity`, `unit_price`, `notes`, `criticality`,
  `approvalStatus`, `requestedByTechnician`). Es una excepción aprobada a la regla
  snake_case porque es estructura interna del JSON, no columnas MySQL. `approvalStatus`
  vale `pending` / `accepted` / `rejected`.
- Autenticación: JWT en `Authorization: Bearer <token>`.
- Formato de respuesta habitual:
  `{ "status": 200, "statusText": "success", "body": <datos> }`.
  Errores: `401` token ausente/inválido, `403` rol sin permiso, `404` no encontrado,
  `422` payload inválido, `500` error interno.
- Endpoints donde hay que enganchar la generación:
  - `POST /api/orders` — crea una orden.
  - `PATCH /api/orders` — actualiza una orden (puede traer `status`, `parts`,
    `budget_accepted`, datos del vehículo/cliente).
  - `POST /api/public/order/{token}/decision` — decisiones del cliente por ítem:
    `{ "items": [{ "id": 36, "decision": "accepted" | "rejected" }] }`.

## 1. Esquema de `alerts` (ya existe — no crear ni alterar columnas)

```sql
-- REFERENCIA del contrato. NO ejecutar un CREATE nuevo: la tabla ya está desplegada.
-- Confirma el DDL real con: SHOW CREATE TABLE alerts;
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

Reglas:

- **No añadir `user_id`, `is_read`, `title` ni `dedupe_key` EN ESTA SPEC (009).** La feature admin funciona con las columnas actuales; el estado leído es compartido entre admins.
- **No cambiar tipos ni renombrar columnas.**
- Índice **opcional y aditivo**, solo si el volumen lo justifica:

```sql
CREATE INDEX idx_alerts_read_created ON alerts (read_at, created_at);
```

- Si tu motor ya tiene un índice equivalente, no lo dupliques.

---

### 1.1 Preparación para Spec 010 — Notificaciones a mecánicos (futura)

> **NO implementes esto hoy.** Es una guía para que, cuando llegue la Spec 010, el cambio sea mínimamente invasivo y no rompa lo que se entrega ahora.

La Spec 010 requerirá que los mecánicos reciban notificaciones **solo de sus órdenes** (cuando cambia el estado de una orden donde están asignados). Para ello hará falta:

1. **Añadir columna `user_id` nullable** a `alerts` (FK a `users.id`):
   ```sql
   ALTER TABLE `alerts` ADD COLUMN `user_id` INT NULL DEFAULT NULL AFTER `order_id`,
   ADD INDEX `idx_alerts_user_read` (`user_id`, `read_at`);
   ```
   - `user_id = NULL` → alerta para **todos los admins** (comportamiento actual Spec 009).
   - `user_id = <id_mecanico>` → alerta **solo para ese mecánico**.
   - El estado leído pasa a ser **por usuario**: ya no basta con `read_at`; hace falta tabla `alert_reads` o columna `read_at` por usuario. Recomendación: tabla aparte:
     ```sql
     CREATE TABLE `alert_reads` (
       `alert_id` INT NOT NULL,
       `user_id`  INT NOT NULL,
       `read_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (`alert_id`, `user_id`),
       FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON DELETE CASCADE,
       FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
     );
     ```
     Así una alerta puede estar leída por un admin y pendiente para un mecánico (o viceversa).

2. **Nuevos tipos de alerta** (añadir a los existentes):
   - `order_status_changed_mechanic` — la orden cambió de estado y el mecánico está asignado.
   - `part_approved` — el admin aceptó un repuesto que el mecánico pidió.
   - `part_rejected` — el admin rechazó un repuesto que el mecánico pidió.

3. **Reglas de generación adicionales (solo en Spec 010):**
   - En `PATCH /api/orders` cuando cambia `status`: si la orden tiene `assigned_user_id` con mecánicos, insertar una alerta `order_status_changed_mechanic` por cada mecánico asignado (`user_id` del mecánico).
   - En `PATCH /api/orders` cuando un repuesto pasa de `pending` a `accepted`/`rejected` y `requestedByTechnician === true`: insertar `part_approved` / `part_rejected` con `user_id` del mecánico que lo pidió.
   - La generación sigue siendo idempotente comparando estado anterior/nuevo.

4. **Endpoints para mecánicos (Spec 010):**
   - `GET /api/alerts?unread=1&role=mechanic` → filtra por `user_id = <id_mecanico_actual>` (o join con `alert_reads`).
   - `PATCH /api/alerts` con `{ "id": 7 }` → inserta en `alert_reads (alert_id, user_id)` en lugar de (o además de) tocar `alerts.read_at`.
   - `POST /api/alerts/read-all` → marca todas las del usuario actual como leídas.

5. **Compatibilidad hacia atrás (clave):**
   - Las alertas con `user_id = NULL` siguen funcionando exactamente igual que hoy para los admins (leídas compartidas, `read_at` en `alerts`).
   - El frontend de Spec 009 **no cambia**: seguirá leyendo `GET /api/alerts?unread=1` (que filtrará `read_at IS NULL AND user_id IS NULL` para admins).
   - Cuando se implemente Spec 010, el backend solo añade lógica; no rompe endpoints ni esquema de Spec 009.

## 2. Objeto `Alert` (forma exacta que consume el frontend)

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

- `id` y `order_id` pueden serializarse como string (hoy lo hacen: `"7"`, `"31"`); el
  frontend los tolera. No cambies el formato existente.
- `type` nuevos: `order_created`, `order_status_changed`, `part_requested`,
  `budget_accepted`, `budget_rejected`. Legacy tolerado en la UI: `customer_decision`.
- `read_at` es `null` (pendiente) o `"YYYY-MM-DD HH:MM:SS"`.
- `order_id` puede ser `null`, pero los 5 eventos de esta feature siempre lo traen.
- No añadas campos con otros nombres; el frontend lee estos.

## 3. Endpoints

### 3.1 `GET /api/alerts` — Parámetros de consulta

| Parámetro | Valor | Qué devuelve |
|---|---|---|
| `unread=1` | (actual) | Solo `read_at IS NULL`, orden `created_at DESC, id DESC`, máx. 50 |
| `read=1` | **(nuevo)** | Solo `read_at IS NOT NULL`, orden `read_at DESC, id DESC`, máx. 50 |
| (ninguno) | legacy | Todas las alertas, orden `created_at DESC`, sin límite estricto |

- Auth: JWT obligatorio. Rol: **solo `admin`**.
- La respuesta mantiene el sobre actual y `body` sigue siendo un **array**.
- `401` sin token/inválido; `403` si rol ≠ `admin`.

Respuesta `200` (ejemplo con `?unread=1`):

```json
{
  "status": 200,
  "statusText": "success",
  "body": [
    {
      "id": "12",
      "order_id": "47",
      "type": "part_requested",
      "message": "Carlos pidió \"Filtro de aceite\" en la orden HD668JF (Juan Pérez).",
      "read_at": null,
      "created_at": "2026-10-23 09:41:00"
    }
  ]
}
```

`401` sin token o token inválido; `403` si el rol no es `admin`.

### 3.2 `PATCH /api/alerts`

- Auth: JWT obligatorio. Rol: **solo `admin`**.
- Payload:

```json
{ "id": 7 }
```

- El backend fija `read_at = NOW()` en esa fila y devuelve `200` con la fila
  actualizada. **El frontend nunca envía `read_at` ni ningún timestamp**; si llega un
  `read_at` en el payload, ignóralo.
- Idempotente: si ya estaba leída, responde `200` con la fila actual y **no** cambia
  `read_at`.
- `404` si el `id` no existe. `422` si falta `id` o no es numérico.
- **Importante**: si ya existe un `PATCH /api/alerts` genérico (CRUD), haz que este
  payload (`{ id }` sin otros campos) sea el que fija `read_at`, sin romper otros
  payloads que hoy funcionen.

Respuesta `200`:

```json
{
  "status": 200,
  "statusText": "success",
  "body": {
    "id": "7",
    "order_id": "31",
    "type": "customer_decision",
    "message": "El cliente actualizo la decision del presupuesto",
    "read_at": "2026-10-23 09:55:12",
    "created_at": "2026-10-17 14:08:01"
  }
}
```

### 3.3 `POST /api/alerts/read-all`

- Auth: JWT obligatorio. Rol: **solo `admin`**.
- Sin payload (cuerpo vacío o `{}`).
- Fija `read_at = NOW()` en **todas** las alertas con `read_at IS NULL`.
- Devuelve cuántas filas cambió. Sin pendientes → `200` con `updated: 0`.

Respuesta `200`:

```json
{
  "status": 200,
  "statusText": "success",
  "body": { "updated": 3 }
}
```

## 4. Generación de alertas (server-side)

Reglas generales:

- Se escribe en `alerts` con `INSERT INTO alerts (order_id, type, message) VALUES (...)`;
  `read_at` nace `NULL` y `created_at` lo pone la DB.
- **Sin destinatario por fila**: no hay `user_id`. El estado leído es compartido entre
  admins (decisión consciente del usuario).
- La generación ocurre junto al cambio que la origina; un fallo al insertar la alerta
  **no** debe revertir la operación de negocio (registra el error en el log y continúa).
- `message` en español, accionable y autocontenido (cliente, placa y dato clave),
  truncado a 255 caracteres. **No hay columna `title`.**

### 4.1 `order_created` — en `POST /api/orders`

```php
// tras insertar la orden con éxito, con $orderId, $createdBy, $customerName, $vehiclePlate
if (!userIsAdmin($createdBy)) {          // si el creador es admin, NO se alerta
    $pdo->prepare(
        "INSERT INTO alerts (order_id, type, message) VALUES (?, 'order_created', ?)"
    )->execute([
        $orderId,
        "Nueva orden de {$customerName} ({$vehiclePlate}).",
    ]);
}
```

Un mecánico o la recepción que crea una orden sí genera la alerta.

### 4.2 `part_requested` — en `PATCH /api/orders` (diff de `parts`)

```php
$before = json_decode($prev['parts'] ?? '[]', true) ?: [];
$after  = json_decode($new['parts']  ?? '[]', true) ?: [];

$wasPending = [];   // repuestos que YA estaban pending antes del PATCH
foreach ($before as $p) {
    if (($p['requestedByTechnician'] ?? false) === true
        && ($p['approvalStatus'] ?? null) === 'pending') {
        $wasPending[partKey($p)] = true;
    }
}

foreach ($after as $p) {
    $isPending = (($p['requestedByTechnician'] ?? false) === true)
              && (($p['approvalStatus'] ?? null) === 'pending');
    if (!$isPending) continue;

    $key = partKey($p);
    if (isset($wasPending[$key])) continue;      // ya estaba pending → no alertar

    $pdo->prepare(
        "INSERT INTO alerts (order_id, type, message) VALUES (?, 'part_requested', ?)"
    )->execute([
        $orderId,
        "{$mechanicName} pidió \"{$p['name']}\" en la orden {$vehiclePlate} ({$customerName}).",
    ]);
}

function partKey(array $p): string {
    if (!empty($p['id'])) return (string) $p['id'];
    return sha1(($p['name'] ?? '') . '|' . ($p['quantity'] ?? ''));
}
```

Si no tienes el nombre del mecánico en el `PATCH`, usa "El mecánico" (no inventes datos).
Un repuesto que ya estaba `pending` **no** vuelve a alertar cuando el admin edita otro
campo de la orden.

### 4.3 `budget_accepted` — en `PATCH /api/orders`

```php
$wasAccepted = (int) ($prev['budget_accepted'] ?? 0);
$isAccepted  = (int) ($new['budget_accepted']  ?? 0);

if ($wasAccepted === 0 && $isAccepted === 1) {
    // guarda anti-duplicado: si ya hay una alerta de aceptación pendiente para la orden,
    // no insertar otra (el portal puede haberla creado un segundo antes).
    $exists = $pdo->prepare(
        "SELECT 1 FROM alerts
          WHERE order_id = ? AND type = 'budget_accepted' AND read_at IS NULL
          LIMIT 1"
    );
    $exists->execute([$orderId]);

    if (!$exists->fetchColumn()) {
        $monto = number_format((float) $orderTotal, 0, ',', '.');
        $pdo->prepare(
            "INSERT INTO alerts (order_id, type, message) VALUES (?, 'budget_accepted', ?)"
        )->execute([
            $orderId,
            "El cliente aceptó el presupuesto de la orden {$vehiclePlate} (\$ {$monto}).",
        ]);
    }
}
```

Sin clave de deduplicación: la condición `0 → 1` ya evita repetir en reintentos. Spec 008
reinicia `budget_accepted` a `0` cuando el admin cambia repuestos, así que una aceptación
posterior vuelve a ser `0 → 1` y **debe** alertar de nuevo.

### 4.4 `order_status_changed` — en `PATCH /api/orders`

```php
if (($prev['status'] ?? null) !== ($new['status'] ?? null)) {
    $pdo->prepare(
        "INSERT INTO alerts (order_id, type, message) VALUES (?, 'order_status_changed', ?)"
    )->execute([
        $orderId,
        "La orden {$vehiclePlate} pasó a \"{$statusLabel}\".",
    ]);
}
```

`$statusLabel`: `received` → "Recibido", `diagnosing` → "En diagnóstico",
`awaiting_approval` → "Esperando aprobación", `approved` → "Aprobado",
`in_progress` → "En reparación", `ready` → "Listo", `delivered` → "Entregado",
`cancelled` → "Cancelado".

### 4.5 `budget_rejected` / `budget_accepted` — en `POST /api/public/order/{token}/decision`

Sustituye el `customer_decision` genérico actual (el endpoint **sigue creando alerta**,
pero con tipo específico):

```php
$rejected = 0;
$total    = 0;
foreach ($items as $item) {
    // ... guardar la decisión como ya se hace ...
    $total++;
    if (($item['decision'] ?? null) === 'rejected') $rejected++;
}

if ($rejected > 0) {
    $pdo->prepare(
        "INSERT INTO alerts (order_id, type, message) VALUES (?, 'budget_rejected', ?)"
    )->execute([
        $orderId,
        "{$customerName} rechazó {$rejected} ítem(s) del presupuesto de la orden {$vehiclePlate}.",
    ]);
} elseif ($total > 0) {          // todos accepted
    $monto = number_format((float) $orderTotal, 0, ',', '.');
    $pdo->prepare(
        "INSERT INTO alerts (order_id, type, message) VALUES (?, 'budget_accepted', ?)"
    )->execute([
        $orderId,
        "El cliente aceptó el presupuesto de la orden {$vehiclePlate} (\$ {$monto}).",
    ]);
}
```

No existe un "rechazar presupuesto" global: el evento nace de las decisiones por ítem.
Aplica la misma guarda anti-duplicado del punto 4.3 antes de insertar
`budget_accepted`, porque el portal suele enviar después el `PATCH` con
`budget_accepted: 1`.

### 4.6 Mensajes por tipo (referencia)

| `type` | `message` |
|---|---|
| `order_created` | `Nueva orden de {customer_name} ({vehicle_plate}).` |
| `order_status_changed` | `La orden {vehicle_plate} pasó a "{estado legible}".` |
| `part_requested` | `{mecánico} pidió "{repuesto}" en la orden {vehicle_plate} ({customer_name}).` |
| `budget_accepted` | `El cliente aceptó el presupuesto de la orden {vehicle_plate} ({monto}).` |
| `budget_rejected` | `{customer_name} rechazó {n} ítem(s) del presupuesto de la orden {vehicle_plate}.` |

## 5. Criterios de aceptación (verificables)

1. **Compatibilidad**: `GET /api/alerts` sin parámetros devuelve las mismas filas que
   antes (incluidas las 6 legacy), con la misma forma de respuesta.
2. **Filtro**: `GET /api/alerts?unread=1` devuelve solo `read_at IS NULL`, ordenadas por
   `created_at DESC, id DESC`; con 60 pendientes devuelve 50.
3. **Auth**: sin token → `401`; con token de mecánico → `403` en los 3 endpoints.
4. **`PATCH`**: `{ "id": 7 }` fija `read_at` y la fila desaparece del `GET ?unread=1`.
   Repetir el mismo `PATCH` → `200` y `read_at` **no** cambia. `id` inexistente → `404`.
   Payload sin `id` → `422`. Un `read_at` enviado por el cliente se ignora.
5. **`read-all`**: con 3 pendientes devuelve `{ "updated": 3 }`; el `GET ?unread=1`
   posterior devuelve `[]`. Segunda llamada → `{ "updated": 0 }`.
6. **`order_created`**: un admin crea una orden → **0** alertas nuevas. Un mecánico crea
   una orden → **1** alerta `order_created` con placa y cliente en el mensaje.
7. **`part_requested`**: el mecánico agrega un repuesto `pending` → **1** alerta. Un
   `PATCH` posterior que solo cambia `mileage` → **0** alertas nuevas. Repetir el mismo
   `PATCH` del repuesto → **0** nuevas.
8. **`budget_accepted`**: `PATCH` con `budget_accepted: 1` desde `0` → **1** alerta;
   repetirlo → **0** nuevas; resetear a `0` y volver a `1` → **1** nueva.
9. **`order_status_changed`**: `received` → `diagnosing` → **1** alerta con "En
   diagnóstico"; `PATCH` con el mismo `status` → **0**.
10. **Decisión del portal**: un ítem `rejected` → **1** `budget_rejected`; todos
    `accepted` → **1** `budget_accepted`; repetir el mismo payload → **0** nuevas.
    **Ninguna** alerta nueva con `type = 'customer_decision'`.
11. **Sin doble aceptación**: decisión con todos `accepted` seguida del `PATCH` con
    `budget_accepted: 1` → **1 sola** alerta `budget_accepted` pendiente para esa orden.
12. **Sin tabla nueva**: `SHOW TABLES` no incluye `notifications`; `alerts` conserva sus
    6 columnas.
13. **Contrato**: respuestas con el sobre `{ status, statusText, body }`; `body` de
    `GET` es un array; `PATCH` devuelve la fila; `read-all` devuelve `{ updated }`.
14. **Legacy intacto**: las 6 filas `customer_decision` siguen en la BD y se pueden
    marcar leídas con los endpoints nuevos.

## 6. Entregable esperado

- Filtro `unread=1` en `GET /api/alerts` (sin romper el comportamiento sin parámetro).
- `PATCH /api/alerts` con `{ id }` → `read_at = NOW()`.
- `POST /api/alerts/read-all`.
- Los 5 enganches de generación (crear orden, actualizar orden, decisión del portal),
  sustituyendo `customer_decision` por tipos específicos.
- Índice opcional solo si se justifica.
- Colección de ejemplos `curl` para probar los 14 criterios de aceptación.
- Nota final indicando cualquier desviación del contrato (idealmente, ninguna).

**Recordatorio**: el frontend ya consume `GET /api/alerts?unread=1`, `PATCH /api/alerts`
y `POST /api/alerts/read-all` tal como se describen aquí. Un cambio de ruta, de nombre de
campo o de forma del sobre rompe la campana y el modal.