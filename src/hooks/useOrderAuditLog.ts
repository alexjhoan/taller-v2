import { useQuery } from "@tanstack/react-query";
import { api, endpoints } from "@/services/api";
import { AuditLogEntry } from "@/types/audit";

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
}

export function useOrderAuditLog(orderId: number | null) {
  return useQuery({
    queryKey: ['order_audit_log', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const response = await api.get<ApiResponse<AuditLogEntry[]>>(endpoints.orderAuditLog(orderId));
      return response.body;
    },
    enabled: orderId !== null && orderId > 0,
    staleTime: 1000 * 60 * 2,
  });
}
