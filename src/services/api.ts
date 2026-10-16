// ============================================================
// Mecaflow Workshop OS — Cliente API único
// Base URL desde variable de entorno NEXT_PUBLIC_API_BASE_URL
// Token JWT seteado vía setApiToken()
// Usuario para updated_by seteado vía setApiUser()
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API || '';

let authToken: string | null = null;
let apiUser: { id?: number; firstName: string; lastName?: string; role: string } | null = null;

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
          lastName: userForUpdate.lastName,
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

  const response = await fetch(url, config);

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
};
