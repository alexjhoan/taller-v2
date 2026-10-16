import { useQuery } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';
import { WorkOrder, parseWorkOrder } from '@/hooks/useWorkOrders';

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

export function useDeliveredOrders(fecha?: string) {
  return useQuery({
    queryKey: ['delivered_orders', fecha],
    queryFn: async () => {
      const url = fecha
        ? `${endpoints.ordersDelivered}?fecha=${fecha}`
        : endpoints.ordersDelivered;
      const response = await api.get<ApiResponse<{ items: WorkOrder[]; pagination: { limit: number; offset: number; total: number } }>>(url);
      // El backend devuelve { items: [...], pagination: {...} } en vez de un array directo
      const items = response.body?.items ?? [];
      return items.map(parseWorkOrder);
    },
    staleTime: 1000 * 60 * 5,
  });
}
