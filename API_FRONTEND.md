# API REST del Taller Mecánico

Documento de integración para frontend.

## 1. Configuración

```text
Content-Type: application/json
Base URL: http://localhost/taller-apis
```

Las rutas que empiezan por `/api` conservan ese prefijo. Por ejemplo:

```text
http://localhost/taller-apis/api/orders
```

Las rutas públicas no requieren autenticación. Las rutas internas requieren:

```http
Authorization: Bearer JWT_TOKEN
```

Roles disponibles en la base de datos:

- `admin`
- `mechanic`

Todas las respuestas JSON siguen esta estructura general:

```json
{
  "status": 200,
  "body": {},
  "statusText": "success"
}
```

Los errores mantienen la misma estructura:

```json
{
  "status": 422,
  "body": [],
  "statusText": "Mensaje del error"
}
```

## 2. Autenticación

### POST `/login-user`

Ruta pública para administrador y mecánico.

#### Payload

```json
{
  "email": "admin@example.com",
  "password": "ContraseñaSegura123"
}
```

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "id": 1,
    "token": "JWT_TOKEN",
    "first_name": "Admin"
  },
  "statusText": "Bienvenido Admin"
}
```

Guardar `body.token` y enviarlo en el header `Authorization` para las rutas internas.

## 3. CRUD dinámico por tabla

El backend conserva un CRUD genérico. Las claves del payload deben tener exactamente el mismo nombre que las columnas MySQL.

### GET `/{table}`

Ejemplos:

```text
GET /users
GET /work_orders
GET /budget_items
GET /order_evidence
```

Requiere JWT cuando se consulta información interna.

#### Respuesta de colección

```json
{
  "status": 200,
  "body": [
    {
      "id": 1,
      "customer_name": "Juan Perez",
      "vehicle_plate": "ABC123",
      "status": "received"
    }
  ],
  "statusText": "success",
  "total": 1
}
```

### GET `/{table}?id={id}`

Ejemplo:

```text
GET /work_orders?id=1
```

#### Respuesta individual

```json
{
  "status": 200,
  "body": {
    "id": 1,
    "public_token": "TOKEN_PUBLICO",
    "customer_name": "Juan Perez",
    "vehicle_plate": "ABC123",
    "status": "received"
  },
  "statusText": "success",
  "total": 1
}
```

### POST `/{table}`

El payload se recorre dinámicamente. Las claves deben coincidir con las columnas de la tabla.

Ejemplo para `work_orders`:

```json
{
  "public_token": "TOKEN_GENERADO_POR_EL_FRONT_SOLO_SI_USA_CRUD_DIRECTO",
  "customer_name": "Juan Perez",
  "customer_phone": "+573001112233",
  "customer_email": "juan@example.com",
  "vehicle_plate": "ABC123",
  "vehicle_make": "Toyota",
  "vehicle_model": "Corolla",
  "vehicle_year": 2020,
  "mileage": 85000,
  "fuel_level": "1/2",
  "failure_description": "El vehículo vibra al frenar",
  "status": "received",
  "created_by": 1,
  "parts": "[{\"id\":\"a1b2c3\",\"name\":\"Pastillas de freno\",\"quantity\":1,\"unit_price\":50000,\"criticality\":\"preventive\",\"approvalStatus\":\"accepted\",\"requestedByTechnician\":false}]",
  "service_items": "[{\"description\":\"Cambio de aceite\",\"price\":30000}]",
  "assigned_user_id": "[3, 5]"
}
```

> Para la recepción normal se recomienda usar `POST /api/orders`, porque genera `public_token` automáticamente y valida los campos requeridos.
>
> **Campos JSON string**: `parts` (repuestos), `service_items` (mano de obra) y `assigned_user_id` (mecánicos asignados) se envían como strings JSON. `service_items` es un array de objetos `{ "description": "...", "price": 123 }`. `parts` es un string JSON opaco con un array de repuestos; su contrato completo (incluidos los campos internos en camelCase) se documenta en [§4 — Contrato de `parts`](#contrato-de-parts-repuestos).
>
> **`assigned_user_id`** es ahora un JSON string con array de IDs de mecánicos (ej. `"[3, 5]"`); lista vacía = `"[]"` = sin asignar. El backend lo guarda como array de números. Al recibirlo el frontend lo normaliza a `number[]` (también acepta el formato legacy `3`/`"3"`/`null`).

> El CRUD genérico está pensado para operaciones simples de tablas. Para órdenes, evidencias, presupuestos, decisiones y configuraciones se deben usar las rutas explícitas documentadas en las siguientes secciones.

### PATCH `/{table}`

El campo `id` identifica el registro. Los demás campos se actualizan dinámicamente.

Ejemplo:

```json
{
  "id": 1,
  "status": "diagnosing",
  "failure_description": "Se detecta desgaste en pastillas delanteras"
}
```

> `assigned_user_id` se envía igual que en el POST: JSON string con array de IDs de mecánicos (ej. `"[3, 5]"`); lista vacía = `"[]"` = sin asignar.

### DELETE `/{table}?column={column}&id={value}`

Ejemplo:

```text
DELETE /budget_items?column=id&id=5
```

## 4. Órdenes de trabajo

Tabla principal: `work_orders`.

### POST `/api/orders`

Roles: `admin`, `mechanic`.

Genera automáticamente `public_token` de 48 caracteres hexadecimales.

#### Payload

```json
{
  "customer_name": "Juan Perez",
  "customer_phone": "+573001112233",
  "customer_email": "juan@example.com",
  "vehicle_plate": "ABC123",
  "vehicle_make": "Toyota",
  "vehicle_model": "Corolla",
  "vehicle_year": 2020,
  "mileage": 85000,
  "fuel_level": "1/2",
  "failure_description": "El vehículo vibra al frenar"
}
```

Campos obligatorios:

```text
customer_name
customer_phone
vehicle_plate
vehicle_make
vehicle_model
mileage
fuel_level
failure_description
```

> **`assigned_user_id`** (opcional) se envía como JSON string con array de IDs de mecánicos: `"[3, 5]"`; lista vacía = `"[]"` = sin asignar.

#### Respuesta `201`

```json
{
  "status": 201,
  "body": {
    "id": 25,
    "token": "a3f5...TOKEN_DE_48_CARACTERES"
  },
  "statusText": "Order created"
}
```

El valor `body.token` corresponde a la columna `work_orders.public_token`.

### Contrato de `parts` (repuestos)

`parts` es una columna JSON/TEXT de `work_orders` que se guarda y se devuelve como **string JSON opaco**: el backend no la interpreta ni valida su contenido; solo la almacena y la devuelve verbatim (mismo tratamiento que `service_items`). Cada objeto del array puede traer estos campos:

| Campo | Tipo | Req. | Valores | Quién lo pone |
|-------|------|------|---------|---------------|
| `id` | string | sí | único por repuesto | frontend |
| `name` | string | sí | texto | quien crea el repuesto |
| `quantity` | number | sí | ≥ 1 | quien crea el repuesto |
| `unit_price` | number \| null | no | COP | solo admin (al aprobar o agregar) |
| `criticality` | string | no | `critical` \| `preventive` | frontend |
| `approvalStatus` | string | no | `pending` / `accepted` / `rejected` | admin |
| `requestedByTechnician` | boolean | no | `true` si lo pidió un mecánico | frontend |
| `notes` | string | no | texto | quien crea el repuesto |

> **Excepción de nombres (aprobada)**: los campos DENTRO del JSON de `parts` van en **camelCase** (`approvalStatus`, `requestedByTechnician`) porque son estructura interna del string JSON, no columnas MySQL. Las claves de nivel superior del payload siguen en snake_case (columnas reales). Esta es una excepción explícita y aprobada a la regla general "API en snake_case" documentada en §12.

Ejemplo de `parts` con un repuesto aceptado por el admin, una solicitud del técnico `pending` y un repuesto legacy/sin `approvalStatus` (checkin o anterior al flujo de aprobación):

```json
[
  {
    "id": "pt_a1b2c3",
    "name": "Pastillas de freno delanteras",
    "quantity": 1,
    "unit_price": 180000,
    "criticality": "preventive",
    "approvalStatus": "accepted",
    "requestedByTechnician": false
  },
  {
    "id": "pt_d4e5f6",
    "name": "Filtro de aceite",
    "quantity": 1,
    "unit_price": null,
    "criticality": "preventive",
    "approvalStatus": "pending",
    "requestedByTechnician": true,
    "notes": "Solicitado por desgaste observado"
  },
  {
    "id": "pt_g7h8i9",
    "name": "Línea de freno derecha",
    "quantity": 1,
    "unit_price": 95000,
    "notes": "Ingresado en recepción"
  }
]
```

Reglas de negocio asociadas:

- `approvalStatus` gating la **visibilidad** en el portal del cliente: `accepted` (aceptado por el admin) y los repuestos **sin** `approvalStatus` (legacy/checkin) son visibles; `pending` y `rejected` están ocultos. La decisión del cliente gating el **total** aceptado (ver §7).
- Un repuesto **sin** `approvalStatus` se trata como aceptado (es parte de la cotización inicial) y en el admin muestra el badge neutro "Ingresado".
- El admin puede deshacer decisiones: aceptar un `rejected` o rechazar un `accepted` con el mismo mecanismo. Aceptar un repuesto sin `unit_price` (o con `0`/`null`) pide el precio antes de confirmar.
- El admin agrega repuestos directamente con `approvalStatus: "accepted"` y `requestedByTechnician: false`; los repuestos dados de alta en recepción/checkin también nacen `accepted`.
- El técnico solo puede eliminar repuestos con `requestedByTechnician: true` y `approvalStatus` distinto de `accepted`; nunca acepta ni rechaza.

#### Cambios de repuestos: persistencia inmediata y reinicio del presupuesto

Cualquier cambio sobre los repuestos (agregar, aceptar, rechazar, editar, eliminar) se persiste **de inmediato** mediante `PATCH /api/orders`, sin esperar a "Guardar Cambios", y **debe** enviar `budget_accepted: 0` para reiniciar la aceptación del cliente y que revise el estado actual:

```json
{
  "id": 25,
  "parts": "[{\"id\":\"pt_a1b2c3\",\"name\":\"Pastillas de freno delanteras\",\"quantity\":1,\"unit_price\":180000,\"criticality\":\"preventive\",\"approvalStatus\":\"accepted\",\"requestedByTechnician\":false},{\"id\":\"pt_d4e5f6\",\"name\":\"Filtro de aceite\",\"quantity\":1,\"unit_price\":null,\"criticality\":\"preventive\",\"approvalStatus\":\"pending\",\"requestedByTechnician\":true}]",
  "budget_accepted": 0
}
```

> **Regla**: todo PATCH que incluya un cambio de `parts` debe llevar `budget_accepted: 0`. Sin ese reinicio, el cliente vería un presupuesto "aceptado" que ya no refleja los repuestos actuales. Los datos de vehículo/cliente del formulario siguen quedando "staged" hasta pulsar "Guardar Cambios"; solo los repuestos persisten de inmediato.

> **Requisito pendiente del backend**: `PATCH /api/orders` debe guardar `parts` verbatim (string opaco, sin reconstruir los objetos de adentro) y `GET /api/orders` debe devolver `parts` con **todos** los campos de cada repuesto, incluidos `id`, `approvalStatus`, `requestedByTechnician` y `criticality` (hoy el backend reconstruye cada repuesto y se queda solo con `name`, `quantity`, `unit_price` y `notes`). Hasta que esto se cumpla, el frontend tolera repuestos sin `approvalStatus` (tratados como visibles, fallback legacy) y genera `id` de respaldo.

### GET `/api/orders/{id}`

Roles: `admin`, `mechanic`.

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "order": {
      "id": 25,
      "public_token": "a3f5...",
      "customer_name": "Juan Perez",
      "customer_phone": "+573001112233",
      "customer_email": "juan@example.com",
      "vehicle_plate": "ABC123",
      "vehicle_make": "Toyota",
      "vehicle_model": "Corolla",
      "vehicle_year": 2020,
      "mileage": 85000,
      "fuel_level": "1/2",
      "failure_description": "El vehículo vibra al frenar",
      "status": "received",
      "started_at": null,
      "finished_at": null,
      "withdrawal_comment": null,
      "created_by": 1,
      "created_at": "2026-09-22 10:00:00",
      "updated_at": "2026-09-22 10:00:00"
    },
    "budget": []
  },
  "statusText": "success"
}
```

Cuando el usuario es `mechanic` y `mechanic_cost_visibility` vale `0`, el backend omite `unit_price` y `supplier_cost` de cada ítem.

### PATCH `/api/orders/{id}/status`

Roles: `admin`, `mechanic`.

#### Payload

```json
{
  "status": "in_progress"
}
```

Valores válidos para `work_orders.status`:

```text
received
diagnosing
awaiting_approval
approved
in_progress
ready
delivered
cancelled
```

Al usar `in_progress`, se registra automáticamente `started_at` si todavía está vacío. Al usar `ready` o `delivered`, se registra `finished_at`.

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "updated": true
  },
  "statusText": "Order status updated"
}
```

### POST `/api/orders/{id}/withdrawal-comment`

Roles: `admin`, `mechanic`.

Marca la orden como `delivered`, registra `finished_at` si está vacío y guarda el comentario en `withdrawal_comment`.

#### Payload

```json
{
  "comment": "Vehículo retirado por el cliente. Se explicaron las reparaciones realizadas."
}
```

#### Respuesta `200`

```json
{
  "status": 200,
  "body": [],
  "statusText": "Withdrawal registered"
}
```

## 5. Evidencias

Tabla: `order_evidence`.

### POST `/api/orders/{id}/evidence`

Roles: `admin`, `mechanic`.

Usar `multipart/form-data`, no JSON.

Campo requerido:

```text
file
```

Tipos permitidos:

```text
image/jpeg
image/png
image/webp
video/mp4
video/quicktime
```

Tamaño máximo: `50 MB`.

#### Respuesta `201`

```json
{
  "status": 201,
  "body": {
    "id": 10,
    "url": "assets/evidence/4f2c...mp4"
  },
  "statusText": "Evidence uploaded"
}
```

Campos relacionados de `order_evidence`:

```text
id
order_id
type
file_url
uploaded_by
created_at
```

## 6. Presupuestos

Tabla: `budget_items`.

### POST `/api/orders/{id}/budget-items`

Rol: `admin`.

#### Payload

```json
{
  "type": "part",
  "description": "Pastillas de freno delanteras",
  "quantity": 1,
  "unit_price": 180000,
  "supplier_cost": 120000
}
```

Valores válidos para `type`:

```text
labor
part
```

#### Respuesta `201`

```json
{
  "status": 201,
  "body": {
    "id": 35
  },
  "statusText": "Budget item created"
}
```

Campos de `budget_items`:

```text
id
order_id
type
description
quantity
unit_price
supplier_cost
customer_decision
created_at
```

`customer_decision` comienza como `pending` y puede cambiar a `accepted` o `rejected` desde el portal público.

### PATCH `/api/settings/cost-visibility`

Rol: `admin`.

Actualiza `app_settings.setting_key = mechanic_cost_visibility`.

#### Payload

```json
{
  "visible": true
}
```

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "visible": true
  },
  "statusText": "Setting updated"
}
```

## 7. Portal público del cliente

No requiere JWT. El acceso se realiza mediante `work_orders.public_token`.

### GET `/api/public/order/{token}`

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "order": {
      "id": 25,
      "public_token": "a3f5...",
      "customer_name": "Juan Perez",
      "vehicle_plate": "ABC123",
      "vehicle_make": "Toyota",
      "vehicle_model": "Corolla",
      "mileage": 85000,
      "fuel_level": "1/2",
      "status": "in_progress",
      "started_at": "2026-09-22 11:00:00",
      "finished_at": null,
      "withdrawal_comment": null
    },
    "evidence": [
      {
        "id": 10,
        "type": "photo",
        "file_url": "assets/evidence/4f2c.jpg",
        "created_at": "2026-09-22 11:30:00"
      }
    ],
    "budget": [
      {
        "id": 35,
        "type": "part",
        "description": "Pastillas de freno delanteras",
        "quantity": "1.00",
        "unit_price": "180000.00",
        "customer_decision": "pending"
      }
    ]
  },
  "statusText": "success"
}
```

> **Filtrado server-side de repuestos (RF-11 — requisito pendiente del backend)**: el backend debe filtrar `parts` en esta respuesta para devolver **solo los repuestos aceptados por el admin** (los que tienen `approvalStatus: "accepted"` o los que **no** traen `approvalStatus`, legacy/checkin). Los repuestos `pending` o `rejected` no deben aparecer **ni siquiera en el JSON de la respuesta**: el cliente nunca debe ver solicitudes aún no autorizadas ni piezas rechazadas, ni siquiera inspeccionando la petición. Este filtro es server-side porque el token es público; el frontend además aplica un filtrado de respaldo client-side sobre los campos que sí lleguen (ver §4 — Contrato de `parts`).

### POST `/api/public/order/{token}/decision`

No requiere JWT.

El cliente debe enviar la decisión de cada ítem usando el `id` de `budget_items`.

#### Payload

```json
{
  "items": [
    {
      "id": 35,
      "decision": "accepted"
    },
    {
      "id": 36,
      "decision": "rejected"
    }
  ]
}
```

Valores permitidos para `decision`:

```text
accepted
rejected
```

La operación actualiza `budget_items.customer_decision` y crea un registro en `alerts` para notificar al administrador.

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "notified": true
  },
  "statusText": "Decision saved"
}
```

## 8. Alertas del administrador

### GET `/api/alerts`

Rol: `admin`.

#### Respuesta `200`

```json
{
  "status": 200,
  "body": [
    {
      "id": 1,
      "order_id": 25,
      "type": "customer_decision",
      "message": "El cliente actualizo la decision del presupuesto",
      "read_at": null,
      "created_at": "2026-09-22 12:00:00"
    }
  ],
  "statusText": "success"
}
```

Campos de `alerts`:

```text
id
order_id
type
message
read_at
created_at
```

## 9. WhatsApp

### GET `/api/orders/{id}/whatsapp-url`

Roles: `admin`, `mechanic`.

Genera una URL para abrir WhatsApp con el teléfono de `work_orders.customer_phone` y el enlace público basado en `work_orders.public_token`.

#### Respuesta `200`

```json
{
  "status": 200,
  "body": {
    "url": "https://wa.me/573001112233?text=Consulta%20el%20estado%20de%20tu%20veh%C3%ADculo%3A%20https%3A%2F%2Ffrontend.example.com%2Forder%2Fa3f5..."
  },
  "statusText": "success"
}
```

## 10. Campos de base de datos

### `users`

```text
id
first_name
last_name
email
password
phone
role
active
user_token
exp_token
created_at
```

El frontend nunca debe mostrar ni solicitar `password`, `user_token` o `exp_token` en consultas normales.

### `work_orders`

```text
id
public_token
customer_name
customer_phone
customer_email
vehicle_plate
vehicle_make
vehicle_model
vehicle_year
mileage
fuel_level
failure_description
status
started_at
finished_at
withdrawal_comment
created_by
created_at
updated_at
```

### `order_evidence`

```text
id
order_id
type
file_url
uploaded_by
created_at
```

### `budget_items`

```text
id
order_id
type
description
quantity
unit_price
supplier_cost
customer_decision
created_at
```

### `app_settings`

```text
setting_key
setting_value
updated_at
```

### `alerts`

```text
id
order_id
type
message
read_at
created_at
```

## 11. Errores habituales

| HTTP | Significado |
|---:|---|
| `401` | JWT ausente, inválido o expirado |
| `403` | El rol no tiene permiso para la operación |
| `404` | Orden o registro no encontrado |
| `415` | Content-Type no soportado |
| `422` | Payload inválido o campo requerido ausente |
| `500` | Error interno o de base de datos |

## 12. Regla de integración

Para el CRUD genérico, usar siempre las columnas reales de la base de datos. No transformar nombres como:

```text
customer_name -> customerName
vehicle_plate -> vehiclePlate
unit_price -> unitPrice
```

El frontend debe enviar y leer los nombres originales:

```text
customer_name
vehicle_plate
unit_price
```

> **Excepción aprobada (Spec 008)**: los campos DENTRO del JSON string `parts` van en camelCase (`approvalStatus`, `requestedByTechnician`), porque son estructura interna del JSON de la columna y no columnas MySQL. Es la única excepción a esta regla; ver [§4 — Contrato de `parts`](#contrato-de-parts-repuestos).
