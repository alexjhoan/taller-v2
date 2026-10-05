# Spec 001 — Dashboard del Administrador

Estado: aprobada

## Contexto y objetivo

El taller mecánico necesita un panel centralizado donde el administrador pueda ver todos los vehículos registrados y gestionar los usuarios del sistema. Hoy esta información está dispersa o inaccesible sin consultar la base de datos directamente.

## Usuarios

- **Admin**: Usuario con rol `admin` ya autenticado. Necesita visibilidad total del taller y control de usuarios.

## Historias de usuario

- HU-1. Como admin, quiero ver una lista de todos los vehículos del taller para saber qué hay en cada momento.
- HU-2. Como admin, quiero filtrar la lista de vehículos por estado para encontrar rápidamente los que están en reparación.
- HU-3. Como admin, quiero ver el detalle de un vehículo para conocer su información completa y su historial.
- HU-4. Como admin, quiero crear nuevos usuarios del sistema para dar acceso a nuevos mecánicos o administradores.
- HU-5. Como admin, quiero editar la información de un usuario para corregir datos o cambiar roles.
- HU-6. Como admin, quiero desactivar un usuario para revocar su acceso sin eliminar su historial.
- HU-7. Como admin, quiero reactivar un usuario desactivado para restaurar su acceso.

## Requisitos funcionales

- RF-1: CUANDO el admin abre el dashboard, EL SISTEMA muestra la lista de vehículos con placa, marca, modelo, cliente y estado.
- RF-2: CUANDO el admin selecciona un filtro de estado, EL SISTEMA muestra solo los vehículos con ese estado.
- RF-3: CUANDO el admin hace clic en un vehículo, EL SISTEMA muestra su detalle completo (datos del vehículo, cliente, historial de órdenes).
- RF-4: CUANDO el admin abre la sección de usuarios, EL SISTEMA muestra la lista de usuarios con nombre, email, rol y estado activo/inactivo.
- RF-5: CUANDO el admin crea un usuario, EL SISTEMA valida que el email no exista y guarda el usuario con: first_name, last_name, email, password, phone, role.
- RF-6: CUANDO el admin edita un usuario, EL SISTEMA permite modificar first_name, last_name, email, phone, role.
- RF-7: CUANDO el admin desactiva un usuario, EL SISTEMA marca `active = 0` en users.
- RF-8: SI el usuario desactivado intenta iniciar sesión, ENTONCES EL SISTEMA rechaza el login con mensaje "Usuario desactivado".
- RF-9: CUANDO el admin busca un vehículo por placa, EL SISTEMA filtra la lista en tiempo real (búsqueda parcial).
- RF-10: EL SISTEMA muestra notificaciones de éxito o error para cada acción (crear, editar, desactivar, reactivar).
- RF-11: El dashboard debe cargar en menos de 2 segundos con hasta 100 vehículos.
- RF-12: La lista de vehículos debe paginarse con 20 registros por página.
- RF-13: Toda acción de administración debe confirmarse con el usuario antes de ejecutarse.
- RF-14: El dashboard solo es accesible con rol `admin`.
- RF-15: CUANDO el admin reactiva un usuario, EL SISTEMA marca `active = 1` y permite login nuevamente.
- RF-16: CUANDO el admin ve el detalle de un vehículo, EL SISTEMA muestra su historial de órdenes (GET /work_orders?vehicle_plate=XXX).
- RF-17: La lista de vehículos se ordena por created_at descendente (más recientes primero).
- RF-18: La lista de usuarios se ordena por first_name ascendente.
- RF-19: CUANDO una orden se marca como `delivered`, EL SISTEMA la mantiene en work_orders (no se elimina).

## Requisitos no funcionales

- RF-11: Carga < 2s con 100 vehículos.
- RF-12: Paginación con 20 registros por página.
- RF-13: Confirmación antes de acciones destructivas.
- RF-14: Solo accesible con rol admin.

## Casos límite

- No hay vehículos registrados → mostrar estado vacío con mensaje "No hay vehículos registrados".
- No hay usuarios registrados → mostrar estado vacío con mensaje "No hay usuarios registrados".
- Email duplicado al crear usuario → mostrar error "El email ya está registrado".
- Usuario desactivado intenta login → rechazado con mensaje claro.
- Red no disponible al crear/editar → encolar acción y mostrar warning.
- Vehículo sin orden asociada → mostrar "Sin orden activa" en el detalle.

## Fuera de alcance

- Eliminar vehículos del sistema (solo se desactivan órdenes).
- Eliminar usuarios físicamente (solo desactivación lógica).
- Exportar datos a Excel/PDF.
- Gráficos o estadísticas avanzadas.
- Notificaciones por email o WhatsApp desde el dashboard.
- Gestión de repuestos o inventario.
- Tabla de historial de órdenes cerradas (se implementará después).

## Criterios de finalización

- El admin puede ver la lista de vehículos con filtros por estado y búsqueda por placa.
- El admin puede ver el detalle de un vehículo con su historial de órdenes.
- El admin puede crear, editar, desactivar y reactivar usuarios.
- Todas las acciones muestran feedback visual (Notistack).
- El dashboard está protegido con withAuth (solo admin).
- Typecheck pasa sin errores.

## Dudas resueltas

- La lista de vehículos se obtiene de GET /vehicles (tabla vehicles con CRUD completo).
- El admin puede crear tanto admins como mecánicos.
- Se incluye botón para reactivar usuarios desactivados.
- Las órdenes delivered no se eliminan de work_orders (solo cambian de estado).
- Tabla order_history se implementará en el futuro para la sección de historial.
