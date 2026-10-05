# Spec 003 — Historial de Órdenes Entregadas

Estado: borrador

## Contexto y objetivo

El taller mecánico necesita un historial de todas las �rdenes de trabajo que ya fueron entregadas al cliente. Esta sección es exclusiva del administrador y permite consultar el historial completo con búsqueda por fecha.

## Usuarios

- **Admin**: Usuario con rol `admin` ya autenticado. Necesita consultar el historial de órdenes entregadas para seguimiento y control.

## Historias de usuario

- HU-1. Como admin, quiero ver una lista de todas las órdenes entregadas para consultar el historial del taller.
- HU-2. Como admin, quiero buscar órdenes entregadas por fecha para encontrar rápidamente una orden específica.
- HU-3. Como admin, quiero ver el detalle completo de una orden entregada (cliente, vehículo, fechas, presupuesto, checklist).
- HU-4. Como admin, quiero ver el progreso del checklist de una orden entregada.

## Requisitos funcionales

- RF-1: CUANDO el admin abre la sección de historial, EL SISTEMA muestra la lista de órdenes con status `delivered`.
- RF-2: CUANDO el admin selecciona una fecha, EL SISTEMA filtra las órdenes entregadas por esa fecha.
- RF-3: CUANDO el admin hace clic en una orden, EL SISTEMA muestra el detalle completo de la orden.
- RF-4: EL SISTEMA muestra los siguientes datos de la orden: ID, cliente (nombre, teléfono, email), vehículo (placa, marca, modelo, año, color, odómetro, combustible), fechas (creación, inicio, finalización), estado, descripción de la falla.
- RF-5: EL SISTEMA muestra el presupuesto de la orden (ítems con descripción, cantidad, precio unitario, decisión del cliente).
- RF-6: EL SISTEMA muestra el checklist de la orden con su progreso.
- RF-7: EL SISTEMA muestra los repuestos solicitados de la orden.
- RF-8: CUANDO el admin vuelve del detalle, EL SISTEMA regresa a la lista de historial.
- RF-9: EL SISTEMA permite refrescar la lista manualmente.
- RF-10: EL SISTEMA actualiza la lista automáticamente al montar el componente.

## Requisitos no funcionales

- RF-11: La lista debe cargar en menos de 2 segundos.
- RF-12: La búsqueda por fecha debe ser instantánea (frontend).
- RF-13: El detalle debe reutilizar el componente `AdminOrderDetail` si es posible.

## Casos límite

- No hay órdenes entregadas → mostrar estado vacío "No hay órdenes entregadas".
- Fecha sin resultados → mostrar "No se encontraron órdenes para esta fecha".
- Orden sin presupuesto → mostrar "Sin presupuesto".
- Orden sin checklist → mostrar "Sin checklist".
- Error de red → mostrar mensaje de error con opción de reintentar.

## Fuera de alcance

- Editar órdenes entregadas (solo lectura).
- Eliminar órdenes del historial.
- Exportar historial a Excel/PDF.
- Gráficos o estadísticas avanzadas.
- Notificaciones por email.

## Criterios de finalización

- El admin puede ver la lista de órdenes entregadas.
- El admin puede buscar por fecha.
- El admin puede ver el detalle completo de una orden entregada.
- El detalle muestra todos los datos: cliente, vehículo, fechas, presupuesto, checklist, repuestos.
- Typecheck pasa sin errores.

## Dudas resueltas

- El endpoint `/api/orders/delivered` requiere JWT (todas las peticiones internas lo llevan).
- La búsqueda por fecha es por fecha de creación (`created_at`).
- Se creará un componente de solo lectura basado en `AdminOrderDetail` para mantener uniformidad.
