# Tasks: Log de Cambios (Audit Trail)

## Fase 1: Backend (pendiente - requiere PHP)
- [ ] T-01: Crear tabla order_audit_log (SQL)
- [ ] T-02: Función helper logOrderAction()
- [ ] T-03: Insertar en log en createOrder, updateOrder, updateStatus, delivered, cancelled
- [ ] T-04: Endpoint GET /api/orders/{id}/audit-log
- [ ] T-05: Manejo de updated_by JSON para extraer user_id/name/role

## Fase 2: Frontend
- [x] T-06: Tipos AuditLogEntry (src/types/audit.ts)
- [x] T-07: Hook useOrderAuditLog (lazy loading)
- [x] T-08: Vista pages/admin/order-log.tsx
- [x] T-09: Botón "Ver Log de Cambios" en AdminOrderDetail
- [x] T-10: Botón "Ver Log de Cambios" en TechnicianOrderDetail
- [x] T-11: Endpoint centralizado en api.ts (orderAuditLog)
- [x] T-12: typecheck + build

## Estado
- Fase 1: PENDIENTE (backend PHP)
- Fase 2: COMPLETADA (frontend listo, espera backend)
