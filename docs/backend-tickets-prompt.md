# Backend Prompt — Tickets de Soporte/Sugerencias

## Contexto
Nueva sección "Soporte/Sugerencia" en el sidebar. Dos vistas:
1. **Crear ticket** (cualquier usuario logueado) → `POST /api/tickets`
2. **Admin: lista y gestión** → `GET /api/tickets`, `GET /api/tickets/{id}`, `PATCH /api/tickets/{id}`, `POST /api/tickets/{id}/reply`

## Esquema de BD — Tabla `tickets`

```sql
CREATE TABLE `tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Usuario que crea el ticket (FK users.id)',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` ENUM('soporte', 'sugerencia', 'bug') NOT NULL DEFAULT 'soporte',
  `status` ENUM('abierto', 'en_proceso', 'cerrado') NOT NULL DEFAULT 'abierto',
  `assigned_admin_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Admin que lo atiende (FK users.id)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tickets_user_id` (`user_id`),
  KEY `idx_tickets_status` (`status`),
  KEY `idx_tickets_category` (`category`),
  KEY `idx_tickets_created_at` (`created_at`),
  CONSTRAINT `fk_tickets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tickets_assigned_admin_id` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tickets de soporte/sugerencias/bugs';

-- Tabla de respuestas (historial de conversación)
CREATE TABLE `ticket_replies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ticket_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Quién responde (admin o usuario)',
  `message` TEXT NOT NULL,
  `is_admin_reply` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = respuesta de admin, 0 = del usuario',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_replies_ticket_id` (`ticket_id`),
  KEY `idx_ticket_replies_user_id` (`user_id`),
  CONSTRAINT `fk_ticket_replies_ticket_id` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_replies_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Respuestas/historial de tickets';
```

---

## Endpoints API

### 1. Crear ticket (usuario logueado)
```
POST /api/tickets
Auth: JWT requerido
Body:
{
  "title": "string (max 255, requerido)",
  "description": "string (requerido)",
  "category": "soporte|sugerencia|bug (opcional, default 'soporte')"
}
Respuesta 201:
{
  "status": 201,
  "body": { "id": 123, "title": "...", "category": "soporte", "status": "abierto", "created_at": "..." },
  "statusText": "Ticket creado"
}
```

### 2. Listar tickets (admin) — con filtros y paginación
```
GET /api/tickets?page=1&per_page=20&status=abierto&category=sugerencia&date_from=2026-01-01&date_to=2026-12-31&search=printer
Auth: JWT (solo role=admin)
Query params (todos opcionales):
  - page, per_page (default 1, 20)
  - status: abierto|en_proceso|cerrado
  - category: soporte|sugerencia|bug
  - date_from, date_to (YYYY-MM-DD)
  - search: busca en title + description (LIKE)
Respuesta 200:
{
  "status": 200,
  "body": {
    "data": [
      { "id": 1, "user_id": 5, "user_name": "Juan Pérez", "title": "...", "category": "sugerencia", "status": "abierto", "created_at": "...", "replies_count": 2 }
    ],
    "pagination": { "current_page": 1, "per_page": 20, "total": 45, "last_page": 3 }
  },
  "statusText": "OK"
}
```

### 3. Ver detalle de ticket (admin)
```
GET /api/tickets/{id}
Auth: JWT (admin)
Respuesta 200:
{
  "status": 200,
  "body": {
    "id": 123,
    "user_id": 5,
    "user_name": "Juan Pérez",
    "user_email": "juan@mail.com",
    "title": "Problema con impresora",
    "description": "No imprime...",
    "category": "soporte",
    "status": "en_proceso",
    "assigned_admin_id": 1,
    "assigned_admin_name": "Admin Carlos",
    "created_at": "2026-11-10 10:00:00",
    "updated_at": "2026-11-10 14:30:00",
    "replies": [
      { "id": 1, "user_id": 5, "user_name": "Juan Pérez", "message": "No imprime...", "is_admin_reply": 0, "created_at": "..." },
      { "id": 2, "user_id": 1, "user_name": "Admin Carlos", "message": "Revisando...", "is_admin_reply": 1, "created_at": "..." }
    ]
  },
  "statusText": "OK"
}
```

### 4. Actualizar ticket (admin) — cambio de estado, asignación, categoría
```
PATCH /api/tickets/{id}
Auth: JWT (admin)
Body (todos opcionales):
{
  "status": "abierto|en_proceso|cerrado",
  "category": "soporte|sugerencia|bug",
  "assigned_admin_id": 3
}
Respuesta 200: ticket actualizado
```

### 5. Responder a ticket (admin)
```
POST /api/tickets/{id}/reply
Auth: JWT (admin)
Body:
{
  "message": "string (requerido)"
}
Efecto:
  - Inserta en ticket_replies (is_admin_reply=1, user_id=admin_logueado)
  - Si ticket estaba "abierto" → pasa a "en_proceso" automáticamente
  - (Opcional) Dispara notificación push/email al usuario creador
Respuesta 201:
{
  "status": 201,
  "body": { "id": 45, "ticket_id": 123, "message": "...", "is_admin_reply": 1, "created_at": "..." },
  "statusText": "Respuesta enviada"
}
```

### 6. Usuario responde a su ticket (opcional, si se quiere hilo)
```
POST /api/tickets/{id}/reply
Auth: JWT (usuario dueño del ticket)
Body: { "message": "..." }
Efecto: inserta en ticket_replies (is_admin_reply=0)
```

---

## Reglas de Negocio

| Regla | Detalle |
|-------|---------|
| Solo admin ve `GET /api/tickets` (lista) y `GET /api/tickets/{id}` | Validar `role === 'admin'` |
| Usuario solo ve SUS tickets | `GET /api/my-tickets` (opcional, filtro `user_id = me`) |
| Al crear ticket: `user_id` = usuario del JWT, `status` = 'abierto' | No aceptar `user_id` en body |
| Al responder (admin): si status='abierto' → 'en_proceso' | Automático en `POST /reply` |
| `assigned_admin_id`: solo admin puede setear (PATCH) | Nullable |
| Respuestas en `ticket_replies` son inmutables (no edit/delete) | Solo insert |

---

## Checklist Backend
- [ ] Migración SQL ejecutada (`tickets`, `ticket_replies`)
- [ ] Endpoints 1–5 implementados con validaciones
- [ ] `GET /api/tickets` paginado + filtros + búsqueda
- [ ] `POST /reply` actualiza `status` a `en_proceso` si era `abierto`
- [ ] (Opcional) Push/email al usuario cuando admin responde
- [ ] Índices en BD creados para filtros rápidos