# Spec: Log de Cambios (Audit Trail) de Órdenes

## Objetivo
Registrar quién creó, editó y entregó cada orden, con trazabilidad completa de cambios.

## RFs

### RF-1: Tabla order_audit_log
- Crear tabla `order_audit_log` en MySQL con campos: id, order_id, action, user_id, user_name, user_role, changes (JSON), created_at
- Índice en order_id para consultas rápidas

### RF-2: Backend inserta en el log automáticamente
- En cada POST/PATCH/DELETE de órdenes, el backend inserta un registro en order_audit_log
- Acciones: created, edited, status_changed, delivered, cancelled
- Los datos del usuario se extraen del JSON string `updated_by` que envía el frontend

### RF-3: Endpoint GET /api/orders/{id}/audit-log
- Retorna el historial de una orden ordenado por created_at DESC
- Formato: `{ status: 200, body: [...], statusText: "success" }`
- Solo accesible para admin (no público)

### RF-4: Botón "Ver Log de Cambios" en detalle de orden
- En AdminOrderDetail (dashboard e historial): botón al final que navega a `/admin/order-log?orderId=X`
- En TechnicianOrderDetail: mismo botón
- El botón solo es visible para admin (el técnico no ve el log)

### RF-5: Vista de log (pages/admin/order-log.tsx)
- Timeline vertical con cada cambio
- Cada ítem muestra: hora HH:MM:SS + fecha, usuario + role + ID, acción con badge de color, cambios (campo: anterior → nuevo)
- Lazy loading: solo llama API cuando la vista está activa
- Estados: carga, vacío, error

### RF-6: Comportamiento offline
- Si no hay conexión, mostrar mensaje de error con opción de reintentar
- No guardar en cola offline (el log es solo lectura)

## Casos límite
- Orden sin log: mostrar "Sin registros de cambios"
- Error de API: mostrar mensaje de error con botón reintentar
- orderId inválido: redirigir a dashboard
- Usuario sin datos (sistema): mostrar "Sistema" como usuario
- Changes null: mostrar solo la acción sin detalle de cambios

## Fuera de alcance
- Edición de logs (solo lectura)
- Exportar logs a PDF/Excel
- Filtros por fecha o usuario
- Notificaciones push cuando hay cambios
