// ============================================================
// Mecaflow Workshop OS — Driver LocalForage (cola offline)
// Almacena peticiones fallidas para reintentar cuando vuelva
// la conexión. Implementación sin dependencias externas.
// ============================================================

const QUEUE_KEY = 'queue_offline';

export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timestamp: number;
  retryCount: number;
}

// --- Implementación en memoria + localStorage ---

function getQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const localForage = {
  /**
   * Agrega una petición a la cola offline
   */
  async addToQueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queue = getQueue();
    const newRequest: QueuedRequest = {
      ...request,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newRequest);
    saveQueue(queue);
  },

  /**
   * Obtiene todas las peticiones pendientes
   */
  async getQueue(): Promise<QueuedRequest[]> {
    return getQueue();
  },

  /**
   * Remueve una petición de la cola por ID
   */
  async removeFromQueue(id: string): Promise<void> {
    const queue = getQueue().filter((r) => r.id !== id);
    saveQueue(queue);
  },

  /**
   * Limpia toda la cola
   */
  async clearQueue(): Promise<void> {
    saveQueue([]);
  },

  /**
   * Reintenta todas las peticiones pendientes
   */
  async retryQueue(
    onRequest: (request: QueuedRequest) => Promise<boolean>
  ): Promise<{ success: number; failed: number }> {
    const queue = getQueue();
    let success = 0;
    let failed = 0;

    for (const request of queue) {
      try {
        const ok = await onRequest(request);
        if (ok) {
          await this.removeFromQueue(request.id);
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { success, failed };
  },
};
