# Backend Prompt — Verificar y Crear Endpoints de Pagos

## Objetivo
Verificar si los endpoints de pagos ya están implementados. Si **NO** existen, crearlos con la especificación exacta que necesita el frontend.

## Checklist de Verificación (ejecutar primero)

```bash
# 1. Verificar si existe la tabla payments
# MySQL:
SHOW TABLES LIKE 'payments';

# 2. Verificar rutas en routes/api.php (o routes/web.php)
grep -r "payments" routes/

# 3. Verificar controlador
ls -la app/Http/Controllers/Api/PaymentsController.php 2>/dev/null || echo "NO EXISTE"
```

---

## Si NO existen → CREAR lo siguiente:

### 1. Migración SQL (si no existe la tabla)

```sql
-- Ejecutar solo si no existe la tabla payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `labor_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `parts_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash', 'card', 'transfer', 'other') DEFAULT 'cash',
  `reference` VARCHAR(100) DEFAULT NULL COMMENT 'Número de transacción, autorización, etc.',
  `notes` TEXT DEFAULT NULL COMMENT 'Observaciones del cobro',
  `paid_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Cuándo se registró el pago',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_order_id` (`order_id`),
  KEY `idx_payments_paid_at` (`paid_at`),
  KEY `idx_payments_payment_method` (`payment_method`),
  CONSTRAINT `fk_payments_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Pagos registrados al entregar órdenes (1:1 con orders)';
```

### 2. Modelo `app/Models/Payment.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $table = 'payments';
    protected $primaryKey = 'id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'order_id',
        'labor_amount',
        'parts_amount',
        'total_amount',
        'payment_method',
        'reference',
        'notes',
        'paid_at',
    ];

    protected $casts = [
        'labor_amount' => 'decimal:2',
        'parts_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    // Scope para filtros de fecha
    public function scopeDateRange($query, $from = null, $to = null)
    {
        if ($from) $query->where('paid_at', '>=', $from . ' 00:00:00');
        if ($to) $query->where('paid_at', '<=', $to . ' 23:59:59');
        return $query;
    }

    public function scopeFilterMethod($query, $method)
    {
        if ($method) return $query->where('payment_method', $method);
        return $query;
    }
}
```

### 3. Controlador `app/Http/Controllers/Api/PaymentsController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class PaymentsController extends Controller
{
    // GET /api/payments?page=1&per_page=20&date_from=2026-01-01&date_to=2026-12-31&method=cash
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
            'date_from' => 'sometimes|date_format:Y-m-d',
            'date_to' => 'sometimes|date_format:Y-m-d',
            'method' => 'sometimes|in:cash,card,transfer,other',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 422,
                'body' => $validator->errors(),
                'statusText' => 'Parámetros inválidos'
            ], 422);
        }

        $query = Payment::with('order:id,vehicle_plate,customer_name')
            ->orderBy('paid_at', 'desc');

        // Filtros
        if ($request->filled('date_from')) {
            $query->where('paid_at', '>=', $request->date_from . ' 00:00:00');
        }
        if ($request->filled('date_to')) {
            $query->where('paid_at', '<=', $request->date_to . ' 23:59:59');
        }
        if ($request->filled('method')) {
            $query->where('payment_method', $request->method);
        }

        $perPage = $request->get('per_page', 20);
        $paginated = $query->paginate($perPage);

        // Transformar para frontend
        $data = $paginated->getCollection()->map(function ($p) {
            return [
                'id' => $p->id,
                'order_id' => $p->order_id,
                'order' => $p->order ? [
                    'id' => $p->order->id,
                    'vehicle_plate' => $p->order->vehicle_plate,
                    'customer_name' => $p->order->customer_name,
                ] : null,
                'labor_amount' => (float) $p->labor_amount,
                'parts_amount' => (float) $p->parts_amount,
                'total_amount' => (float) $p->total_amount,
                'payment_method' => $p->payment_method,
                'reference' => $p->reference,
                'notes' => $p->notes,
                'paid_at' => $p->paid_at?->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'status' => 200,
            'body' => [
                'data' => $data,
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'last_page' => $paginated->lastPage(),
                ],
            ],
            'statusText' => 'OK'
        ]);
    }

    // GET /api/payments/stats?date_from=2026-01-01&date_to=2026-12-31
    public function stats(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date_from' => 'sometimes|date_format:Y-m-d',
            'date_to' => 'sometimes|date_format:Y-m-d',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 422,
                'body' => $validator->errors(),
                'statusText' => 'Parámetros inválidos'
            ], 422);
        }

        $query = Payment::query();

        if ($request->filled('date_from')) {
            $query->where('paid_at', '>=', $request->date_from . ' 00:00:00');
        }
        if ($request->filled('date_to')) {
            $query->where('paid_at', '<=', $request->date_to . ' 23:59:59');
        }

        $totals = $query->selectRaw('
            COALESCE(SUM(labor_amount), 0) as total_labor,
            COALESCE(SUM(parts_amount), 0) as total_parts,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COUNT(*) as total_payments
        ')->first();

        // Desglose por método de pago
        $byMethod = Payment::query();
        if ($request->filled('date_from')) {
            $byMethod->where('paid_at', '>=', $request->date_from . ' 00:00:00');
        }
        if ($request->filled('date_to')) {
            $byMethod->where('paid_at', '<=', $request->date_to . ' 23:59:59');
        }
        $byMethod = $byMethod->selectRaw('
            payment_method,
            COALESCE(SUM(total_amount), 0) as amount,
            COUNT(*) as count
        ')->groupBy('payment_method')->get()->keyBy('payment_method');

        return response()->json([
            'status' => 200,
            'body' => [
                'total_labor' => (float) $totals->total_labor,
                'total_parts' => (float) $totals->total_parts,
                'total_revenue' => (float) $totals->total_revenue,
                'total_payments' => (int) $totals->total_payments,
                'by_method' => [
                    'cash' => ['amount' => (float) ($byMethod['cash']->amount ?? 0), 'count' => (int) ($byMethod['cash']->count ?? 0)],
                    'card' => ['amount' => (float) ($byMethod['card']->amount ?? 0), 'count' => (int) ($byMethod['card']->count ?? 0)],
                    'transfer' => ['amount' => (float) ($byMethod['transfer']->amount ?? 0), 'count' => (int) ($byMethod['transfer']->count ?? 0)],
                    'other' => ['amount' => (float) ($byMethod['other']->amount ?? 0), 'count' => (int) ($byMethod['other']->count ?? 0)],
                ],
            ],
            'statusText' => 'OK'
        ]);
    }

    // POST /api/payments (crear pago manual - opcional)
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order_id' => 'required|exists:orders,id',
            'labor_amount' => 'required|numeric|min:0',
            'parts_amount' => 'required|numeric|min:0',
            'payment_method' => 'required|in:cash,card,transfer,other',
            'reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'paid_at' => 'sometimes|date_format:Y-m-d H:i:s',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 422,
                'body' => $validator->errors(),
                'statusText' => 'Datos inválidos'
            ], 422);
        }

        // Verificar si ya existe pago para esta orden
        $existing = Payment::where('order_id', $request->order_id)->first();
        if ($existing) {
            return response()->json([
                'status' => 409,
                'body' => ['order_id' => ['Ya existe un pago para esta orden']],
                'statusText' => 'Pago ya existe para esta orden'
            ], 409);
        }

        $payment = Payment::create([
            'order_id' => $request->order_id,
            'labor_amount' => $request->labor_amount,
            'parts_amount' => $request->parts_amount,
            'total_amount' => $request->labor_amount + $request->parts_amount,
            'payment_method' => $request->payment_method,
            'reference' => $request->reference,
            'notes' => $request->notes,
            'paid_at' => $request->paid_at ?? now(),
        ]);

        return response()->json([
            'status' => 201,
            'body' => [
                'id' => $payment->id,
                'order_id' => $payment->order_id,
                'labor_amount' => (float) $payment->labor_amount,
                'parts_amount' => (float) $payment->parts_amount,
                'total_amount' => (float) $payment->total_amount,
                'payment_method' => $payment->payment_method,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'paid_at' => $payment->paid_at->format('Y-m-d H:i:s'),
            ],
            'statusText' => 'Pago registrado'
        ], 201);
    }
}
```

### 4. Rutas en `routes/api.php`

```php
// Pagos (solo admin)
Route::middleware(['auth:api', 'role:admin'])->group(function () {
    Route::get('/payments', [App\Http\Controllers\Api\PaymentsController::class, 'index']);
    Route::get('/payments/stats', [App\Http\Controllers\Api\PaymentsController::class, 'stats']);
    Route::post('/payments', [App\Http\Controllers\Api\PaymentsController::class, 'store']);
});
```

### 5. Middleware `role:admin` (si no existe)

En `app/Http/Kernel.php` agregar:
```php
'role' => \App\Http\Middleware\CheckRole::class,
```

Crear `app/Http/Middleware/CheckRole.php`:
```php
<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        if (!$request->user() || !in_array($request->user()->role, $roles)) {
            return response()->json([
                'status' => 403,
                'body' => [],
                'statusText' => 'No autorizado'
            ], 403);
        }
        return $next($request);
    }
}
```

---

## Checklist Final Backend

- [ ] Tabla `payments` creada en BD
- [ ] Modelo `Payment` creado
- [ ] Controlador `PaymentsController` creado con `index`, `stats`, `store`
- [ ] Rutas registradas en `routes/api.php` con middleware `auth:api` + `role:admin`
- [ ] Middleware `role` registrado
- [ ] Probar endpoints:
  - `GET /api/payments?page=1&per_page=20&date_from=2026-01-01&date_to=2026-12-31` → 200
  - `GET /api/payments/stats?date_from=2026-01-01&date_to=2026-12-31` → 200 con totales y desglose por método
  - `POST /api/payments` (opcional) → 201

---

## Contrato Frontend (lo que espera el frontend)

| Endpoint | Parámetros | Respuesta |
|---|---|---|
| `GET /api/payments` | `page`, `per_page`, `date_from`, `date_to`, `method` | `{ data: Payment[], pagination: {current_page, per_page, total, last_page} }` |
| `GET /api/payments/stats` | `date_from`, `date_to` | `{ total_labor, total_parts, total_revenue, total_payments, by_method: {cash:{amount,count}, card:{amount,count}, transfer:{amount,count}, other:{amount,count}} }` |

**Formato fechas**: `YYYY-MM-DD` (ej: `2026-11-10`). El backend maneja hora 00:00:00 / 23:59:59 automáticamente.