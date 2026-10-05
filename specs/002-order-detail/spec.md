# Spec 002 — Vista de Detalle de Orden de Trabajo

Estado: borrador

## Contexto y objetivo

Actualmente la vista del técnico muestra la lista de órdenes y el detalle en el mismo componente, lo que hace que la interfaz sea confusa y difícil de navegar. Se necesita separar la lista de la vista de detalle para mejorar la experiencia de usuario. Además, el administrador necesita poder editar los datos del vehículo y del cliente directamente desde el detalle de la orden.

## Usuarios

- **Técnico**: Usuario con rol `mechanic` o `admin`. Puede ver el detalle de la orden pero NO puede editar.
- **Admin**: Usuario con rol `admin`. Puede ver y editar todos los campos del vehículo y del cliente desde el detalle de la orden.

## Historias de usuario

- HU-1. Como técnico, quiero ver la lista de órdenes de trabajo en una vista separada del detalle para navegar más fácilmente.
- HU-2. Como técnico, quiero hacer clic en una orden y ver todos sus detalles en una vista dedicada.
- HU-3. Como técnico, quiero volver a la lista de órdenes desde el detalle.
- HU-4. Como admin, quiero ver el detalle de una orden con todos los campos del vehículo y del cliente editables.
- HU-5. Como admin, quiero guardar los cambios realizados en el detalle de la orden.
- HU-6. Como admin, quiero ver una confirmación visual cuando los cambios se guardan exitosamente.

## Requisitos funcionales

- RF-1: CUANDO el técnico abre la vista del técnico, EL SISTEMA muestra solo la lista de órdenes de trabajo.
- RF-2: CUANDO el técnico hace clic en una orden, EL SISTEMA navega a la vista de detalle de esa orden.
- RF-3: CUANDO el técnico está en el detalle, EL SISTEMA muestra un botón "Volver a la lista" que regresa a la vista de lista.
- RF-4: CUANDO el admin abre el dashboard y hace clic en una orden, EL SISTEMA navega a la vista de detalle con campos editables.
- RF-5: CUANDO el admin edita un campo del vehículo o del cliente, EL SISTEMA actualiza el valor en tiempo real en el formulario.
- RF-6: CUANDO el admin hace clic en "Guardar cambios", EL SISTEMA envía un PATCH a /api/orders con los campos modificados.
- RF-7: SI el guardado es exitoso, ENTONCES EL SISTEMA muestra un snackbar de éxito.
- RF-8: SI el guardado falla, ENTONCES EL SISTEMA muestra un snackbar de error con el mensaje del backend.
- RF-9: EL SISTEMA muestra los siguientes datos del vehículo en el detalle: placa, marca, modelo, año, color.
- RF-10: EL SISTEMA muestra los siguientes datos del cliente en el detalle: nombre, teléfono, email.
- RF-11: EL SISTEMA muestra los siguientes datos de la orden en el detalle: ID, estado, descripción de la falla, odómetro, nivel de combustible, fecha de creación.
- RF-12: EL SISTEMA muestra el historial de repuestos solicitados en el detalle.
- RF-13: EL SISTEMA muestra el checklist de ejecución en el detalle.
- RF-14: EL SISTEMA permite al técnico marcar/desmarcar items del checklist.
- RF-15: EL SISTEMA muestra el progreso del checklist como porcentaje.

## Requisitos no funcionales

- RF-16: La vista de detalle debe cargar en menos de 1 segundo.
- RF-17: Los cambios del admin deben guardarse en menos de 2 segundos.
- RF-18: La vista de detalle debe ser responsive y funcionar en móvil y desktop.

## Casos límite

- Orden sin repuestos solicitados → mostrar "No hay repuestos solicitados".
- Orden sin checklist → mostrar "No hay checklist definido".
- Error de red al guardar → mostrar snackbar de error y no perder los cambios del formulario.
- Orden ya entregada → el admin puede ver el detalle pero los campos aparecen en modo lectura.

## Fuera de alcance

- Eliminar órdenes desde el detalle.
- Crear nuevas órdenes desde el detalle.
- Ver el historial de cambios de la orden.
- Exportar la orden a PDF.
- Enviar notificaciones al cliente desde el detalle.

## Criterios de finalización

- El técnico puede navegar entre la lista y el detalle de órdenes.
- El admin puede editar y guardar los datos del vehículo y del cliente.
- Todas las acciones muestran feedback visual (Notistack).
- Typecheck pasa sin errores.

## Dudas resueltas

- El admin puede editar el estado de la orden desde el detalle.
- El admin puede editar la descripción de la falla.
- Se incluye botón "Cancelar" que revierte los cambios y deja los campos como estaban antes de ser editados.
