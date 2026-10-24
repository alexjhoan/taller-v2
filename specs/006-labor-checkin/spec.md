# Spec: Mano de Obra en Recepción de Vehículo

## Objetivo
Permitir agregar servicios (mano de obra) al momento de registrar una orden de trabajo desde recepción.

## RFs

### RF-1: Card de Servicios (Mano de Obra) en RecepciónCheckinForm
- Se ubica después de "Repuestos solicitados" y antes de "Cargar Evidencias"
- Lista de servicios agregados con: descripción + precio + botón eliminar
- Inputs para agregar: descripción (obligatorio) + precio (opcional, default 0)
- Botón "Agregar servicio"
- Total mano de obra visible
- Enter en inputs agrega el servicio

### RF-2: Payload service_items
- Se envía como JSON string: `[{ "description": "...", "price": 123 }]`
- Lista vacía → `"[]"`
- Campo snake_case: `service_items`

### RF-3: Validaciones
- Descripción obligatoria (snackbar error si vacía)
- Precio opcional (default 0 si vacío)
- Sin límite de ítems

## Casos límite
- Servicio sin precio → price: 0
- Múltiples servicios con misma descripción → permitido (IDs únicos con generateShortUid)
- Reset del formulario tras crear orden → serviceItems se limpia

## Fuera de alcance
- Editar servicios existentes (solo crear nuevos desde recepción)
- Eliminar servicios del backend (se hace desde admin)
- Cálculo de totales con IVA
