import { useQuery } from "@tanstack/react-query";
import { api, endpoints } from "@/services/api";
import { toNumericIdArray } from "@/utils/ids";

export interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
}

export interface PartItem {
  id: string;
  name: string;
  quantity: number;
  unit_price?: number;
  criticality: string;
  // RF-10 interim: el backend aún elimina estos campos al devolver parts
  // (y los repuestos de checkin/legacy nunca los tuvieron), así que van
  // opcionales hasta que el backend los devuelva verbatim.
  approvalStatus?: string;
  requestedByTechnician?: boolean;
  notes?: string;
}

export interface WorkOrder {
  id: number;
  public_token: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  mileage: number;
  fuel_level: string;
  failure_description: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  withdrawal_comment: string | null;
  created_by: number;
  /** Array de IDs de mecánicos asignados (normalizado a number[]) */
  assigned_user_id: number[];
  created_at: string;
  updated_at: string;
  checklist?: ChecklistItem[] | string;
  parts?: PartItem[] | string;
  evidence?: string[];
}

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

export function parseWorkOrder(order: WorkOrder): WorkOrder {
  // Una fila con JSON corrupto NO debe tumbar la lista completa:
  // si JSON.parse lanza, .map(parseWorkOrder) revienta, React Query
  // marca error y el dashboard entero muestra "Error al cargar órdenes".
  const safeParse = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== "string") return value as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      console.warn(`JSON corrupto en orden ${order.id}, usando []`);
      return fallback;
    }
  };

  return {
    ...order,
    // El backend puede devolver assigned_user_id como JSON string ("[3,5]"),
    // array o FK escalar legacy ("3"); normalizarlo a number[] aquí hace que
    // usersMap.get() y el filtro del técnico (inclusión) funcionen siempre.
    assigned_user_id: toNumericIdArray(order.assigned_user_id),
    checklist: safeParse<ChecklistItem[]>(order.checklist, []),
    parts: safeParse<PartItem[]>(order.parts, []),
    evidence: safeParse<string[]>(order.evidence, []),
  };
}

export function useWorkOrders() {
  return useQuery({
    queryKey: ["work_orders"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<WorkOrder[]>>(endpoints.orders);
      return response.body.map(parseWorkOrder);
    },
    staleTime: 1000 * 60 * 5,
  });
}
