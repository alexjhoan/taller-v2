# Plan: Log de Cambios (Audit Trail) de Órdenes

## Objetivo
Registrar quién creó, editó y entregó cada orden, con trazabilidad completa de cambios.

## Contexto actual
- `work_orders` ya tiene `created_by` (id del usuario que creó).
- `updated_by` ahora se envía como JSON string `{id, firstName, lastName, role}` en cada PATCH.
- No hay historial de cambios: solo se ve el último estado.

## Opciones analizadas

### Opción A: Columna TEXT con JSON append (propuesta del usuario)
```sql
ALTER TABLE work_orders ADD COLUMN audit_log TEXT;
-- Cada PATCH envía el JSON completo actualizado:
[{"action":"created","by":{"id":2,"name":"Ana Torres","role":"admin"},"at":"2026-10-13T10:00:00"},
 {"action":"edited","by":{"id":2,"name":"Ana Torres","role":"admin"},"at":"2026-10-13T11:00:00","changes":{"status":{"from":"received","to":"in_progress"}}}]
```

**Pros**: Simple, sin tablas nuevas, fácil de leer.
**Contras**: 
- El frontend debe enviar el JSON completo (read-modify-write) → risk de lost updates si dos usuarios editan simultáneamente.
- No se puede indexar ni consultar eficientemente ("¿quién editó la orden #123?" requiere parsear JSON).
- El campo crece sin límite.

### Opción B: Tabla separada `order_audit_log` (RECOMENDADA)
```sql
CREATE TABLE order_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  action ENUM('created','edited','status_changed','delivered','cancelled') NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  changes JSON,          -- {"field": {"from": "old", "to": "new"}}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_user_id (user_id)
);
```

**Pros**: 
- El backend inserta directamente (no read-modify-write).
- Consultable con SQL: `SELECT * FROM order_audit_log WHERE order_id = 123`.
- No risk de lost updates.
- Escalable (miles de registros por orden no afectan performance).

**Contras**: 
- Tabla nueva en el backend.
- El frontend necesita un endpoint para leer el log: `GET /api/orders/{id}/audit-log`.

### Opción C: Híbrida (columna resumen + tabla detalle)
- `work_orders.updated_by` ya tiene el último editor (JSON string).
- Tabla `order_audit_log` para el historial completo.
- Lo mejor de ambos mundos.

## Recomendación: Opción B (tabla separada)

### ¿Por qué?
1. **El backend controla el log**: cada vez que se hace POST/PATCH/DELETE en `/api/orders/{id}`, el backend inserta en `order_audit_log` automáticamente. El frontend no necesita enviar nada extra.
2. **Sin lost updates**: no hay read-modify-write.
3. **Consultable**: "¿quién entregó la orden #123?" → `SELECT user_name FROM order_audit_log WHERE order_id=123 AND action='delivered'`.
4. **Escalable**: índices en `order_id` y `user_id`.

### Flujo
```
Frontend → PATCH /api/orders/123 {status: "delivered"}
Backend:
  1. UPDATE work_orders SET status="delivered" WHERE id=123
  2. INSERT INTO order_audit_log (order_id, action, user_id, user_name, user_role, changes)
     VALUES (123, 'delivered', 2, 'Ana Torres', 'admin', '{"status":{"from":"ready","to":"delivered"}}')
  3. Retorna {status: 200, body: {...}}
```

### Endpoint para leer el log
```
GET /api/orders/{id}/audit-log
→ {status: 200, body: [{action, user_name, user_role, changes, created_at}, ...]}
```

### Frontend: componente `OrderAuditLog.tsx`
- Sección colapsable en el detalle de orden: "Historial de cambios"
- Timeline vertical con íconos por acción (✏️ editado, 📦 entregado, ✅ creado)
- Cada ítem: nombre del usuario, rol, fecha, y cambios (campo: old → new)

## Plan de implementación

### Fase 1: Backend (pendiente del usuario)
1. Crear tabla `order_audit_log` (SQL arriba).
2. En `WorkshopController.php`, en cada método que modifica órdenes (create, update, delete, status, deliver), insertar en `order_audit_log`.
3. Crear endpoint `GET /api/orders/{id}/audit-log`.

### Fase 2: Frontend
1. Crear `src/components/OrderAuditLog.tsx` (timeline colapsable).
2. Agregar en `AdminOrderDetail.tsx` y `TechnicianOrderDetail.tsx` (sección al final).
3. Hook `useOrderAuditLog(orderId)` con React Query.
4. Tipos: `AuditLogEntry { id, order_id, action, user_id, user_name, user_role, changes, created_at }`.

### Fase 3: Tests
- Test del hook `useOrderAuditLog`.
- Test del componente `OrderAuditLog` (render de timeline).

## Alternativa simplificada (si no quieres tabla nueva)

Si prefieres NO crear tabla nueva, la Opción A mejorada:

```sql
ALTER TABLE work_orders ADD COLUMN audit_log JSON;
```

- El backend hace el append (no el frontend): lee el JSON actual, agrega el nuevo entry, guarda.
- El frontend solo envía los cambios normales (status, etc.), el backend construye el log.
- Sigue siendo read-modify-write pero del lado del backend (más seguro).

**Contras**: no es consultable con SQL, pero mejor que TEXT.

## Resumen

| Opción | Tabla nueva | Backend controla | Consultable | Simplicidad |
|--------|-------------|------------------|-------------|-------------|
| A: TEXT append | No | No (frontend) | No | Alta |
| B: Tabla separada | Sí | Sí | Sí | Media |
| C: Híbrida | Sí | Sí | Sí | Media |

**Recomendación**: Opción B. Es la más robusta y escalable, y el backend ya tiene toda la información necesaria para insertar en el log automáticamente.
