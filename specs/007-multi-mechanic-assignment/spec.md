# Spec 007 — Asignación múltiple de mecánicos

Estado: implementada

## Contexto y objetivo

Hoy una orden de trabajo tiene como máximo un mecánico asignado (`assigned_user_id`
es un FK escalar y la UI usa un `<select>` con "Sin asignar"). En la realidad del
taller una OT puede encargarse a varias personas a la vez, y el técnico debe ver
todas las órdenes donde participa.

Objetivo: `assigned_user_id` pase a representar un **array de IDs de mecánicos**,
manteniendo el nombre de columna/API (decisiones aprobadas por el usuario: el campo
se envía al backend como JSON string, igual que `parts`/`service_items`).

## Usuarios

- Recepcionista/admin: crea la orden y elige uno o varios mecánicos.
- Admin (detalle): corrige la asignación de una orden existente.
- Mecánico: ve en su lista las órdenes donde está asignado.

## Historias de usuario

- HU-1. Como recepcionista, quiero asignar varios mecánicos a una orden al crearla, para que el trabajo sea colaborativo.
- HU-2. Como admin, quiero editar la lista de mecánicos asignados de una orden, para reasignar trabajo.
- HU-3. Como mecánico, quiero ver todas las órdenes en las que participo, para no perder ninguna.

## Requisitos funcionales

- RF-1: EL SISTEMA almacena `assigned_user_id` como array de números; en el payload
  se envía como JSON string (`"[3, 5]"`; lista vacía = `"[]"` = sin asignar) y al
  recibirlo lo normaliza siempre a `number[]`, aceptando también array `[3,5]`,
  número/string legacy (`3`, `"3"`) y `null`/`""`. JSON corrupto → `[]`.
- RF-2: CUANDO se crea o edita una orden (recepción y detalle admin), EL SISTEMA
  muestra checkboxes múltiples (no select ni radio), uno por usuario activo, para
  elegir los mecánicos; sin usuarios activos muestra placeholder.
- RF-3: MIENTRAS el técnico usa su vista, EL SISTEMA filtra por inclusión: ve las
  órdenes donde su id está dentro del array de asignados.
- RF-4: EL SISTEMA muestra en OrderCard un badge por cada mecánico asignado; si el
  array está vacío (o ningún id coincide con un usuario conocido) muestra el badge
  rojo "No asignado".

## Casos límite

- `"[3,"` (JSON corrupto) → `[]`, sin tumbar la lista.
- ids que ya no existen en users → se ignoran al pintar badges.
- legacy `3` o `"3"` (órdenes creadas antes del cambio) → `[3]`.

## Fuera de alcance

- Permisos/roles sobre quién puede asignar.
- Edición masiva de asignaciones.
- Cambios en el backend (acepta el JSON string y lo guarda como array de números).

## Criterios de finalización

- `npm run typecheck` y `npm run build` sin errores.
- Sin referencias huérfanas (`canEditStatus`, `assignedUser=` singular, `<select>` de asignación residual).
- `node --test` en verde (helper `toNumericIdArray`).

## Dudas abiertas

- Ninguna: las 4 decisiones de contrato (nombre del campo, envío como JSON string,
  normalización de recepción y `"[]"` = sin asignar) fueron aprobadas por el usuario.
