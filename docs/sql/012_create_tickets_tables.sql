-- ============================================================
-- Mecaflow Workshop OS — Tickets de Soporte/Sugerencias
-- Ejecutar en MySQL/MariaDB (staging y producción)
-- ============================================================

-- Tabla principal de tickets
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Usuario que crea el ticket (FK users.id)',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` ENUM('soporte', 'sugerencia', 'bug') NOT NULL DEFAULT 'soporte',
  `status` ENUM('abierto', 'en_proceso', 'cerrado') NOT NULL DEFAULT 'abierto',
  `assigned_admin_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Admin asignado (FK users.id)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tickets_user_id` (`user_id`),
  KEY `idx_tickets_status` (`status`),
  KEY `idx_tickets_category` (`category`),
  KEY `idx_tickets_created_at` (`created_at`),
  KEY `idx_tickets_assigned_admin_id` (`assigned_admin_id`),
  CONSTRAINT `fk_tickets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tickets_assigned_admin_id` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tickets de soporte/sugerencias/bugs';

-- Tabla de respuestas/historial del ticket
CREATE TABLE IF NOT EXISTS `ticket_replies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ticket_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Autor de la respuesta (admin o usuario)',
  `message` TEXT NOT NULL,
  `is_admin_reply` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = respuesta de admin, 0 = del usuario creador',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_replies_ticket_id` (`ticket_id`),
  KEY `idx_ticket_replies_user_id` (`user_id`),
  CONSTRAINT `fk_ticket_replies_ticket_id` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_replies_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Respuestas/historial de conversación de tickets';

-- ============================================================
-- Verificación rápida post-migración
-- ============================================================
-- SELECT * FROM tickets LIMIT 5;
-- SELECT * FROM ticket_replies LIMIT 5;
-- SHOW CREATE TABLE tickets;
-- SHOW CREATE TABLE ticket_replies;