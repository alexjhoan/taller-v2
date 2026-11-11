# Backend Prompt — Formalizar `GET /api/orders/{id}` (detalle de orden)

## Contexto (frontend ya implementado)

El frontend ahora entra al detalle de una orden desde la lista de pagos:

- Ruta nueva: `/admin/order-detail?order-id=N` (admin, JWT en cookie).
- Hook `src/hooks/useOrderById.ts` → `GET /api/orders/{id}`.
- Renderiza el mismo `AdminOrderDetail` del dashboard.

**El endpoint YA EXISTE y responde 200**, pero tiene detalles de contrato que
conviene formalizar/ajustar. Verificado con orden real:

```json
{
  "status": 200,
  "body": {
    "order": {
      "id": 4, "public_token": "415e75...", "customer_name": "alex ramirez",
      "customer_phone": "04120625921", "customer_email": "alex@gmail.com",
      "customer_document_id": "v18707791",
      "vehicle_plate": "6541jh", "vehicle_make": "test", "vehicle_model": "test",
      "vehicle_year": 2023, "vehicle_color": "azul", "mileage": 45000,
      "fuel_level": "1/2", "failure_description": "test",
      "assigned_user_id": "[1]", "vehicle_details": "es un test de pago",
      "checklist": "[{\"id\":\"cl-...\",\"title\":\"revisión\",\"priority\":\"MEDIA\",\"completed\":true}]",
      "parts": "[{\"name\":\"aceite\",\"quantity\":5,\"unit_price\":10000,\"approvalStatus\":\"accepted\",\"id\":\"MWC54075CY\"}]",
      "service_items": "[{\"description\":\"diagnostico\",\"price\":10000},{\"description\":\"otro servicio test\",\"price\":50000}]",
      "status": "delivered",
      "images": "20261111_081433_2a528a1b48e6274a.jpg",
      "videos": null,
      "budget_accepted": 1,
      "started_at": null, "finished_at": "2026-11-11 13:43:54",
      "withdrawal_comment": "test",
      "created_by": 1, "created_at": "2026-11-11 13:12:23",
      "updated_at": "2026-11-11 13:47:40", "updated_by": null
    },
    "budget": [],
    "evidence": [
      {
        "id": 7,
        "url": "http://taller-api.duckdns.org/assets/evidence/4/20261111_081433_2a528a1b48e6274a.jpg",
        "evidence_type": "work_progress",
        "type": "photo",
        "created_at": "2026-11-11 13:14:33"
      }
    ]
  },
  "statusText": "success",
  "total": 1
}
```

---

## Tareas pedidas (en orden de prioridad)

### 1. Incluir el pago asociado en la respuesta (NUEVO — principal)

Como el detalle se abre desde la lista de pagos, la respuesta debe traer el
pago de esa orden (tabla `payments`, relación 1:1 por `order_id`) para que el
frontend pueda mostrarlo sin otra llamada:

```json
"payment": {
  "id": 3,
  "order_id": 4,
  "labor_amount": 10000,
  "parts_amount": 50000,
  "total_amount": 60000,
  "created_at": "2026-11-11 13:15:15"
}
```

Reglas:
- Si la orden no tiene pago (aún no entregada): `"payment": null` (NO omitir la clave).
- Si la orden SÍ tiene pago: el objeto con los campos exactos de la tabla.
- NO recalcular nada: leer la fila existente de `payments` (el pago se crea al
  entregar, dentro de la misma transacción que el PATCH de estado — no tocar eso).

### 2. Documentar el contrato actual en `swagger.json`

El endpoint funciona pero no está documentado. Añadir a `swagger.json`:

- `GET /api/orders/{id}`:
  - Seguridad: Bearer JWT (`.htaccess` ya reenvía `Authorization` a PHP).
  - Respuesta 200: `{ status, body: { order, budget, evidence, payment }, statusText, total }`.
  - Respuesta 404: `{ status: 404, body: null, statusText: "Order not found" }`.
  - Nota: `assigned_user_id`, `checklist`, `parts` y `service_items` viajan como
    JSON strings (misma convención que la lista) — el frontend los parsea.
  - Nota: `evidence` viaja como array de objetos `{ id, url, evidence_type, type, created_at }`
    (a diferencia de la lista, donde `evidence` es string de URLs). Si se puede
    unificar (objetos en ambos), mejor; si no, basta con dejar la nota.

### 3. 404 consistente en JSON

Si el id no existe (o no es numérico), responder:

```json
{ "status": 404, "body": null, "statusText": "Order not found" }
```

con HTTP status 404 — NO un 200 con `body: {}` ni HTML de error. El frontend
muestra "Orden #N no encontrada" con ese 404.

### 4. No romper lo que ya funciona

- Mantener el envoltorio `{ status, body, statusText }`.
- Mantener `parts`, `checklist`, `service_items` como JSON strings.
- Mantener `evidence` aparte en `body.evidence` (el frontend ya lo fusiona con la orden).
- `W`orkshopController.php` es el dueño del flujo: el cambio va ahí, sin tocar
  la creación automática de pagos al entregar.

---

## Criterios de aceptación

1. `GET /api/orders/4` con JWT de admin devuelve 200 con `body.order`,
   `body.evidence` y AHORA TAMBIÉN `body.payment` (objeto o `null`).
2. `GET /api/orders/999999` devuelve 404 JSON con `statusText: "Order not found"`.
3. `swagger.json` documenta el endpoint completo.
4. El frontend (ya implementado) muestra la orden #4 con desglose de precios,
   evidencias, checklist, repuestos, servicios y comentario de entrega sin
   cambios adicionales.
