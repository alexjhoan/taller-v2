# Prompt backend - Notificaciones Push Web (spec 010)

Este documento es un prompt autocontenido para el agente/dev que implementa
el backend PHP. No requiere ver nada del proyecto frontend: todo el contexto
y los contratos están aquí.

---

## CONTEXTO DEL SISTEMA

- API REST PHP + MariaDB, expuesta en https://taller-api.duckdns.org, corre en Docker.
- Convención de respuesta de TODOS los endpoints (envoltorio fijo):
  ```json
  { "status": 200, "body": { ... }, "statusText": "success", "total": 1 }
  ```
- Autenticación: JWT en header `Authorization: Bearer <token>` (igual que
  `GET /api/orders`). Requerirlos sin token → 401 con el envoltorio.
- Nombres de campos/columnas en snake_case (nombres de columnas MySQL).
- Existe tabla `alerts` (id, order_id, type, message, read_at, created_at)
  con triggers que ya insertan filas en: orden nueva, decisión del cliente
  sobre presupuesto (`customer_decision`), cambio de estado, etc.

## OBJETIVO

Habilitar Web Push (notificaciones nativas del sistema) para admins y
mecánicos: guardar suscripciones del navegador y enviar push en los mismos
puntos donde ya se insertan alertas, más un trigger nuevo de asignación de
orden a mecánico.

## TAREA 1 - Claves VAPID

1. Generar el par (se puede desde cualquier máquina):
   ```
   npx web-push generate-vapid-keys
   ```
2. Agregar al `.env` del servidor (no al repo):
   ```
   VAPID_PUBLIC_KEY=BExxxxx...
   VAPID_PRIVATE_KEY=xxxxx...
   VAPID_SUBJECT=mailto:contacto@taller.com
   ```
3. La PRIVATE_KEY JAMÁS debe viajar al frontend ni commitearse. Solo la pública
   se expone vía endpoint (ver TAREA 4).

## TAREA 2 - Tabla MariaDB

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,     -- SHA-256 del endpoint (indexable/único)
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_endpoint (endpoint_hash),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Notas: `endpoint_hash` permite replace único porque TEXT no puede ir en UNIQUE.
El mismo navegador re-suscribiéndose debe hacer UPSERT (no duplicar fila).

## TAREA 3 - Librería PHP

```
composer require minishlink/web-push
```
- Requisitos: PHP 8.1+, extensión `openssl` (ideal `gmp`).
- Si la imagen Docker instala dependencias con composer al construir,
  agregar la librería a `composer.json` y reconstruir la imagen. Si el
  contenedor ya corre con vendor montado, hacer `composer require` dentro
  del contenedor (docker compose exec app composer require minishlink/web-push).

## TAREA 4 - Endpoints (respuestas con el envoltorio estándar)

### GET /api/push/public-key   (JWT obligatorio)
```json
{ "status": 200, "body": { "public_key": "BExxxxx..." }, "statusText": "success" }
```

### POST /api/push/subscribe   (JWT obligatorio)
Request:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/AAA...",
  "keys": { "p256dh": "BExxx...", "auth": "yyy..." },
  "user_agent": "Mozilla/5.0 ... (opcional)"
}
```
Lógica:
1. `user_id` desde el JWT.
2. `endpoint_hash = hash('sha256', $endpoint)`.
3. UPSERT por `endpoint_hash` (ON DUPLICATE KEY UPDATE user_id, p256dh, auth,
   created_at=CURRENT_TIMESTAMP).
4. Respuesta: `{ "status": 200, "body": { "id": <id>, "saved": true }, "statusText": "success" }`

### POST /api/push/unsubscribe   (JWT obligatorio)
Request: `{ "endpoint": "https://fcm.googleapis.com/fcm/send/AAA..." }`
- Borra la(s) fila(s) con ese endpoint_hash (cualquier usuario dueño).
- Respuesta: `{ "status": 200, "body": { "deleted": 1 }, "statusText": "success" }`
- Idempotente: si no hay filas, devuelve `deleted: 0` con status 200.

## TAREA 5 - Helper de envío (interno, sin endpoint)

```php
// src/Push/PushSender.php (o equivalente en la estructura del proyecto)
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

function push_enviar_a_usuarios(array $userIds, array $payload): void {
  // $payload: ['title' => '...', 'body' => '...', 'order_id' => 31]
  $webPush = new WebPush([
    'VAPID' => [
      'subject' => $_ENV['VAPID_SUBJECT'],
      'publicKey' => $_ENV['VAPID_PUBLIC_KEY'],
      'privateKey' => $_ENV['VAPID_PRIVATE_KEY'],
    ],
  ]);
  $json = json_encode($payload); // DEBE ser < 4096 bytes
  foreach (db(:SELECT * FROM push_subscriptions WHERE user_id IN (...)) as $s) {
    $webPush->sendNotification(
      Subscription::create([
        'endpoint' => $s['endpoint'],
        'keys' => ['p256dh' => $s['p256dh'], 'auth' => $s['auth']],
      ]),
      $json
    );
  }
  foreach ($webPush->flush() as $report) {
    if (!$report->isSuccess() && $report->isSubscriptionExpired()) {
      // 410 Gone: la suscripción murió, se purga (si no la tabla crece infinita)
      $endpoint = $report->getEndpoint();
      db(DELETE FROM push_subscriptions WHERE endpoint_hash = sha256($endpoint));
    }
  }
}

function push_enviar_a_admins(array $payload): void {
  // SELECT id FROM users WHERE role='admin' AND active=1 → push_enviar_a_usuarios(...)
}
```

## TAREA 6 - Disparadores (donde ya se insertan `alerts`)

Cada vez que el backend inserte una fila en la tabla `alerts`, llamar además
al helper con un payload corto:
```json
{ "title": "Mecaflow", "body": "El cliente aceptó el presupuesto de la orden #31", "order_id": 31 }
```
Puntos requeridos (los mismos de la spec 009):
- Orden nueva (recepción) → a admins.
- Decisión del cliente (presupuesto) → a admins.
- Repuestos aprobados/rechazados → a admins.
- Cambio de estado de orden → a admins.
- **NUEVO (decisión del usuario)**: cuando `PATCH /api/orders` cambia
  `assigned_user_id`, push a cada mecánico NUEVO en la lista:
  `"Te asignaron la orden #N — {vehicle_plate}"`.
- Regla de negocio: si la orden terminó (delivered/cancelled) no mandar push
  de asignación para ese estado.

## RESTRICCIONES / PEGAS CONOCIDAS

1. El payload DEBE ser < 4096 bytes (limite Web Push cifrado). Si un texto de
   alerta es muy largo, truncar el body a ~200 caracteres.
2. Base64url: `keys.p256dh` y `keys.auth` vienen base64url estándar del
   navegador; la librería los acepta tal cual, NO re-codificarlos.
3. Si el servidor no pudo enviar (push-service caído, CORS, etc.) debe
   fallar SILENCIAMENTE: log interno, nunca bloquear la operación principal
   (ej. la creación de la orden no debe fallar por un push).
4. Los endpoints/devuelven 422 si falta `endpoint` o `keys`.
5. En pruebas desde curl se puede usar payload falso; el navegador real es el
   que valida la clave VAPID.

## CHECKLIST DE VERIFICACIÓN (solo backend, sin frontend)

- [ ] `GET /api/push/public-key` con JWT → 200 con la clave.
- [ ] `POST /api/push/subscribe` con JWT + payload → guarda y UPSERT (no duplica).
- [ ] `POST /api/push/subscribe` sin JWT → 401.
- [ ] Re-suscribir con el mismo endpoint (distinto auth) → actualiza fila.
- [ ] Trigger de push manual (p.ej. comando artisan/script de prueba) llega
  al navegador desktop Chrome con permiso activo en... (nota: para probar
  sin frontend se puede usar https://web-push-codelab.glitch.me — generar
  suscripción allí y pegarla en la tabla a mano).
- [ ] Un endpoint muerto (borrar manualmente la fila con un endpoint falso) →
  el envío no tumba el request y purga la fila si hay 410.
- [ ] Crear orden / cambiar assigned_user_id dispara el push (con suscripción
  real cargada a mano en la tabla).
