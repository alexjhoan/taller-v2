// ============================================================
// Mecaflow Workshop OS — Cliente API único
// Base URL desde variable de entorno NEXT_PUBLIC_API_BASE_URL
// Token JWT seteado vía setApiToken()
// Usuario para updated_by seteado vía setApiUser()
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API || '';

let authToken: string | null = null;
let apiUser: { id?: number; firstName: string; lastName?: string; role: string } | null = null;

// Callback para manejar logout global (se setea desde UserProvider)
let globalLogoutHandler: (() => void) | null = null;

export function setGlobalLogoutHandler(handler: () => void): void {
  globalLogoutHandler = handler;
}

export function setApiToken(token: string | null): void {
  authToken = token;
}

export function getApiToken(): string | null {
  return authToken;
}

export function setApiUser(user: { id?: number; firstName: string; lastName?: string; role: string } | null): void {
  apiUser = user;
}

export function getApiUser(): { id?: number; firstName: string; lastName?: string; role: string } | null {
  return apiUser;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  isMultipart?: boolean;
  skipUpdatedBy?: boolean;
}

/**
 * Maneja errores de autenticación (401/403) redirigiendo al login
 * y limpiando la sesión globalmente.
 */
function handleAuthError(status: number): never {
  // Limpiar sesión global si existe el handler
  if (globalLogoutHandler) {
    globalLogoutHandler();
  }
  
  // Redirigir al login (solo en cliente)
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
  
  // Lanzar error genérico para que no rompa la app
  throw new ApiError(status, status === 401 ? 'Sesión expirada' : 'Acceso denegado', { statusText: status === 401 ? 'Token inválido o expirado' : 'No tiene permisos' });
}

async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, isMultipart = false } = options;

  const url = `${BASE_URL}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  // Prepare body with updated_by for non-GET requests (unless skipUpdatedBy is true)
  let requestBody = body;
  if (body && method !== 'GET' && !isMultipart && typeof body === 'object' && !Array.isArray(body) && body !== null && !options.skipUpdatedBy) {
    const userForUpdate = apiUser;
    if (userForUpdate) {
      requestBody = {
        ...(body as Record<string, unknown>),
        updated_by: JSON.stringify({
          id: userForUpdate.id,
          firstName: userForUpdate.firstName,
          lastName: userForUpdate.lastName ?? "",
          role: userForUpdate.role,
        }),
      };
    }
  }

  if (!isMultipart && requestBody) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (requestBody) {
    config.body = isMultipart ? (requestBody as FormData) : JSON.stringify(requestBody);
  }

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    // TypeError "Failed to fetch": red caída, DNS, CORS o servidor apagado.
    // Nunca debe tumbar la app: se convierte al mismo contrato OfflineMode
    // (503) que ya manejan todos los flujos, que muestran snackbar y
    // encolan en LocalForage cuando aplica.
    console.error('[api] Sin conexión con el servidor:', url);
    throw new ApiError(503, 'OfflineMode', {
      statusText: 'No hay conexión con el servidor',
    });
  }

  // Manejar errores de autenticación (401/403) antes de procesar el body
  if (response.status === 401 || response.status === 403) {
    handleAuthError(response.status);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.statusText || response.statusText,
      errorBody
    );
  }

  return response.json();
}

// --- Clase de error personalizada ---

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// --- Métodos de conveniencia ---

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: Partial<RequestOptions>) =>
    apiRequest<T>(endpoint, { method: 'POST', body, ...options }),
  patch: <T>(endpoint: string, body?: unknown, options?: Partial<RequestOptions>) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body, ...options }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
  upload: <T>(endpoint: string, formData: FormData) =>
    apiRequest<T>(endpoint, { method: 'POST', body: formData, isMultipart: true }),

  // Push notifications
  pushPublicKey: () => apiRequest<{ public_key: string }>(endpoints.pushPublicKey, { method: 'GET' }),
  pushSubscribe: (payload: { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string }) =>
    apiRequest<void>(endpoints.pushSubscribe, { method: 'POST', body: payload }),
  pushUnsubscribe: (endpoint: string) =>
    apiRequest<void>(endpoints.pushUnsubscribe, { method: 'POST', body: { endpoint } }),
};

// --- Endpoints específicos ---

export const endpoints = {
  // Auth
  login: '/login-user',

  // Órdenes
  orders: '/api/orders',
  orderById: (id: number) => `/api/orders/${id}`,
  orderStatus: (id: number) => `/api/orders/${id}/status`,
  orderWithdrawalComment: (id: number) => `/api/orders/${id}/withdrawal-comment`,
  orderWhatsAppUrl: (id: number) => `/api/orders/${id}/whatsapp-url`,
  ordersDelivered: '/api/orders/delivered',

  // Presupuesto
  budgetItems: (orderId: number) => `/api/orders/${orderId}/budget-items`,

  // Evidencias
  evidence: (orderId: number) => `/api/orders/${orderId}/evidence`,

  // Log de cambios (audit trail)
  orderAuditLog: (orderId: number) => `/api/orders/${orderId}/audit-log`,

  // Portal público
  publicOrder: (token: string) => `/api/public/order/${token}`,
  publicDecision: (token: string) => `/api/public/order/${token}/decision`,

  // Alertas
  alerts: '/api/alerts',

  // Configuración
  costVisibility: '/api/settings/cost-visibility',

  // Usuarios
  users: '/users',

  // Vehículos
  vehicles: '/vehicles',

  // Versión de la app (cache busting)
  versionApp: '/get-version-app',

  // Push notifications
  pushPublicKey: '/api/push/public-key',
  pushSubscribe: '/api/push/subscribe',
  pushUnsubscribe: '/api/push/unsubscribe',
};

/**
 * Obtiene la versión de la app del backend (GET /get-version-app).
 * Devuelve el string de la versión (ej. "0.0.1") desde body.version, o null si falla.
 * Usa fetch directo (no apiRequest) para que un fallo de red no toque la cola
 * offline ni dispare el redirect de 401: esta petición nunca debe tumbar la app.
 * Va con Authorization (JWT) porque el backend valida así que la petición
 * viene del front correcto.
 */
export async function apiGetVersionApp(): Promise<string | null> {
  try {
    const requestHeaders: Record<string, string> = {};
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    const response = await fetch(`${BASE_URL}${endpoints.versionApp}`, {
      headers: requestHeaders,
    });
    if (!response.ok) return null;
    // Formato del endpoint: { status, body: [{ id, version }], statusText, total }
    const data = (await response.json()) as { body?: Array<{ version?: string }> };
    const version = data?.body?.[0]?.version;
    return typeof version === 'string' && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}
