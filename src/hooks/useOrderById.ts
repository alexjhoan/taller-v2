import { useQuery } from "@tanstack/react-query";
import { api, endpoints } from "@/services/api";
import { parseWorkOrder, WorkOrder } from "@/hooks/useWorkOrders";

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

/** Evidencia como la devuelve el backend: objeto con url ya resuelta. */
interface EvidenceItemApi {
  id?: number;
  url: string;
  evidence_type?: string;
  type?: string;
  created_at?: string;
}

/**
 * Carga UNA orden por id vía GET /api/orders/{id}.
 *
 * Se usa desde páginas que llegan con `?order-id=N` (p. ej. la lista de
 * pagos → detalle de la orden) donde la orden puede NO estar en la lista
 * cacheada de `useWorkOrders`.
 *
 * Respuesta tolerante — el backend envuelve todo en `{ status, body,
 * statusText }` y en este endpoint laorden viene ANIDADA en
 * `body.order` (la lista plana usa otras formas: `body.data` u orden
 * directa). La evidencia viaja aparte, en `body.evidence`, como objetos
 * `{ id, url, evidence_type, type, created_at }`; se fusionan en
 * `order.evidence` porque AdminOrderDetail/EvidenceGallery leen de ahí.
 * `parseWorkOrder` normaliza JSON strings (parts/checklist/
 * evidence/assigned_user_id) igual que en la lista.
 */
export function useOrderById(orderId: number | null) {
  return useQuery({
    queryKey: ["work_order", orderId],
    queryFn: async (): Promise<WorkOrder | null> => {
      if (!orderId || orderId <= 0) return null;
      const response = await api.get<ApiResponse<unknown>>(endpoints.orderById(orderId));
      const body = response?.body as
        | { order?: WorkOrder; data?: WorkOrder; evidence?: EvidenceItemApi[] }
        | undefined;
      const rawOrder = body?.order ?? body?.data ?? (body as WorkOrder | undefined);
      if (!rawOrder || typeof rawOrder !== "object" || !("id" in rawOrder)) return null;

      // Fusionar evidencia: el objeto aparte (`body.evidence`) si existe;
      // si no, lo que traiga la propia orden (string/array, lo normaliza
      // parseWorkOrder igual que en la lista).
      const evidenceFromBody = Array.isArray(body?.evidence) ? body.evidence : undefined;
      const merged: WorkOrder = evidenceFromBody
        ? { ...rawOrder, evidence: evidenceFromBody as unknown as WorkOrder["evidence"] }
        : rawOrder;

      return parseWorkOrder(merged);
    },
    enabled: orderId !== null && orderId > 0,
    staleTime: 1000 * 60 * 2,
    // No reintentar si el backend aún no implementa el endpoint (404):
    // con 1 intento basta para fallar rápido y mostrar el mensaje.
    retry: false,
  });
}
