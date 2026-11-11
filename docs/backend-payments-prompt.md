# Backend Prompt — Tabla de Pagos (Entrega de Orden)

## Contexto
Cuando una orden pasa a estado **`delivered`** (entregada), el cliente ya pagó. Necesitamos persistir ese pago en una tabla `payments` para trazabilidad y reportes futuros.

## Contrato de API

### POST `/api/orders/{id}/payment`  (se llama automáticamente al entregar)
- **Auth**: JWT (admin/mechanic)
- **Body**: vacío (todo se deriva de la orden)
- **Respuesta 200**:
```json
{
  "status": 200,
  "body": { "id": 42, "order_id": 123, "labor_amount": 150000, "parts_amount": 320000, "total_amount": 470000, "created_at": "2026-11-10 14:30:00" },
  "statusText": "Pago registrado"
}
```
- **Idempotencia**: si ya existe un pago para ese `order_id`, devolver el existente (200) y NO crear duplicado.

### GET `/api/payments?order_id={id}` (opcional, para ver historial)
- **Auth**: JWT
- **Respuesta 200**: lista de pagos de esa orden (usualmente 1).

---

## Cálculo de Montos (derivado de la orden)
| Campo | Fuente |
|-------|--------|
| `labor_amount` | Suma de `service_items.price` (mano de obra) |
| `parts_amount` | Suma de `parts.quantity * parts.unit_price` **solo repuestos con `approvalStatus === 'accepted'`** |
| `total_amount` | `labor_amount + parts_amount` |

> **Nota**: `service_items` y `parts` vienen como JSON strings en la tabla `orders`. Parsearlos en PHP antes de sumar.

---

## SQL — Tabla `payments`

```sql
CREATE TABLE `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `labor_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `parts_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash', 'card', 'transfer', 'other') DEFAULT 'cash',
  `reference` VARCHAR(100) DEFAULT NULL COMMENT 'Número de transacción, autorización, etc.',
  `notes` TEXT DEFAULT NULL COMMENT 'Observaciones del cobro',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_order_id` (`order_id`),
  KEY `idx_payments_created_at` (`created_at`),
  CONSTRAINT `fk_payments_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Índices clave
- `uk_payments_order_id`: garantiza **un pago por orden** (1:1).
- `idx_payments_created_at`: para reportes por rango de fechas.

---

## Flujo en el Backend (pseudocódigo)

```php
// En el handler que cambia estado a 'delivered' (PATCH /api/orders/{id})
// DESPUÉS de validar y persistir el withdrawal_comment:

$order = Order::find($id);
if ($order->status === 'delivered') {
    // Idempotencia: ¿ya existe pago?
    $existing = DB::table('payments')->where('order_id', $order->id)->first();
    if (!$existing) {
        $labor = calculateLaborTotal($order->service_items);      // suma service_items.price
        $parts = calculatePartsTotal($order->parts);              // solo approvalStatus === 'accepted'
        $total = $labor + $parts;

        DB::table('payments')->insert([
            'order_id'      => $order->id,
            'labor_amount'  => $labor,
            'parts_amount'  => $parts,
            'total_amount'  => $total,
            'payment_method'=> 'cash',           // default; luego se puede editar
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }
}

// Helper cálculos
function calculateLaborTotal(string $serviceItemsJson): float {
    $items = json_decode($serviceItemsJson, true) ?? [];
    return array_sum(array_column($items, 'price'));
}

function calculatePartsTotal(string $partsJson): float {
    $parts = json_decode($partsJson, true) ?? [];
    $sum = 0.0;
    foreach ($parts as $p) {
        if (($p['approvalStatus'] ?? '') === 'accepted' && isset($p['unit_price'])) {
            $sum += ($p['quantity'] ?? 0) * (float)$p['unit_price'];
        }
    }
    return $sum;
}
```

---

## Checklist de Verificación (solo backend)
- [ ] `POST /api/orders/{id}/payment` crea el pago al entregar (idempotente).
- [ ] `GET /api/payments?order_id=123` devuelve el pago.
- [ ] `labor_amount` suma correcta de `service_items`.
- [ ] `parts_amount` suma **solo** repuestos `accepted` con `unit_price`.
- [ ] Clave única `uk_payments_order_id` evita duplicados.
- [ ] Migración SQL ejecutada en staging y producción.