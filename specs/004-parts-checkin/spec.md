# Spec 004 — Sección de Repuestos en Checkin

Estado: borrador

## Contexto y objetivo

El taller mecánico necesita permitir la solicitud de repuestos durante la recepción del vehículo (checkin). Actualmente el formulario `ReceptionCheckinForm` incluye checklist de patio pero no tiene sección para repuestos. El backend ya acepta el campo `parts` como JSON string en la tabla `work_orders`.

## Usuarios

- **Recepcionista/Administrador**: Usuario con rol `admin` o `mechanic` que realiza el checkin del vehículo. Necesita agregar repuestos que se solicitarán/provisionarán para la orden.

## Historias de usuario

- HU-1. Como recepcionista, quiero agregar repuestos solicitados durante el checkin para que queden registrados en la orden desde el inicio.
- HU-2. Como recepcionista, quiero poder agregar múltiples repuestos (nombre, cantidad, precio unitario opcional) en una interfaz visual clara.
- HU-3. Como recepcionista, quiero que los repuestos se guarden automáticamente al crear la orden, sin pasos extra.

## Requisitos funcionales

- RF-1: CUANDO el usuario abre el formulario de checkin, EL SISTEMA muestra una sección "Repuestos solicitados" después del checklist y antes del switch de seguridad.
- RF-2: CUANDO el usuario hace clic en "Agregar repuesto", EL SISTEMA muestra campos para nombre (obligatorio), cantidad (obligatorio, entero > 0) y precio unitario (opcional, decimal).
- RF-3: CUANDO el usuario completa los campos y confirma, EL SISTEMA agrega el repuesto a la lista visual con opción a eliminar.
- RF-4: EL SISTEMA permite agregar múltiples repuestos, cada uno mostrado como tarjeta con su información y botón de eliminar.
- RF-5: CUANDO el usuario envía el formulario, EL SISTEMA serializa la lista de repuestos como JSON string en el campo `parts` del payload hacia `POST /api/orders`.
- RF-6: EL SISTEMA valida que cada repuesto tenga nombre no vacío y cantidad >= 1 antes de permitir el envío (warning no bloqueante, solo aviso visual).
- RF-7: CUANDO el usuario elimina un repuesto de la lista, EL SISTEMA lo remueve inmediatamente del estado local.

## Requisitos no funcionales

- RF-8: La sección de repuestos debe usar `CustomCard`, `CustomInput`, `CustomButton` y `CustomBadge` existentes para mantener coherencia visual con el checklist.
- RF-9: El layout debe ser responsivo y funcionar en móvil (ancho máximo `max-w-md` igual que el resto del formulario).
- RF-10: Los nombres de campos en el JSON deben coincidir con snake_case: `name`, `quantity`, `unit_price`.

## Casos límite

- Lista de repuestos vacía → enviar `parts: "[]"` (array vacío serializado) o omitir el campo.
- Precio unitario vacío → guardar como `null` en el JSON.
- Cantidad no numérica → forzar a 1 y mostrar aviso.
- Duplicados (mismo nombre) → permitir (pueden ser proveedores distintos), no validar unicidad.
- Modo offline → el payload con `parts` se encola igual que el resto de campos.

## Fuera de alcance

- Catálogo de repuestos predefinidos / autocomplete.
- Búsqueda de precios o integración con proveedores.
- Edición de repuestos después de creado (solo agregar/eliminar en checkin).
- Cálculo de totales o sumatorias en el formulario.
- Visualización de repuestos en portal público (eso va en budget_items, no en parts).

## Criterios de finalización

- La sección "Repuestos solicitados" aparece en el formulario de checkin.
- Se pueden agregar/eliminar múltiples repuestos con nombre, cantidad y precio opcional.
- Al crear la orden, el campo `parts` llega al backend como JSON string válido.
- Typecheck pasa sin errores (`npm run typecheck`).
- Lint pasa sin errores (`npm run lint`).

## Dudas resueltas

- El campo en BD es `work_orders.parts` (TEXT/JSON), el backend ya lo acepta.
- El payload usa snake_case: `{ "name": "...", "quantity": 1, "unit_price": 150000 }`.
- No se requiere validación estricta de duplicados ni totales.
- La sección va entre el Checklist y el Switch de seguridad (orden visual lógico).