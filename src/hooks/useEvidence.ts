import { useQuery } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';

export function useOrderEvidence(orderId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['order_evidence', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const response = await api.get<string[] | { body: string[] }>(endpoints.evidence(orderId));
      // El backend puede devolver el array directamente o envuelto en { body: [...] }
      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object' && 'body' in response) {
        return (response as { body: string[] }).body || [];
      }
      return [];
    },
    enabled: enabled && orderId !== null,
    staleTime: 1000 * 60 * 5,
  });
}