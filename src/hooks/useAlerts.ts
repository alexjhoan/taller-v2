import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';
import type { Alert } from '@/utils/alerts';

/**
 * Shape de la respuesta del backend para GET /api/alerts
 * El sobre es { status, statusText, body: Alert[] }
 */
interface AlertsResponse {
  status: number;
  statusText: string;
  body: Alert[];
}

/**
 * Determina si un error es el modo offline (503 / OfflineMode).
 */
function isOfflineError(error: unknown): boolean {
  const err = error as any;
  const status = err?.status ?? err?.response?.status;
  const statusText = err?.statusText ?? err?.response?.statusText;
  return status === 503 || statusText === 'OfflineMode';
}

/**
 * Hook principal: alertas no leídas del admin.
 * - Polling cada 120s (refetchInterval: 120000)
 * - Refetch al recuperar el foco de la ventana
 * - Maneja offline 503: no lanza error global, deja data anterior en cache
 * - Cache key: ['alerts', 'unread']
 * @param enabled Si false, desactiva la query (útil para solo admin)
 */
export function useUnreadAlerts(enabled = true) {
  return useQuery<Alert[], Error>({
    queryKey: ['alerts', 'unread'],
    queryFn: async (): Promise<Alert[]> => {
      const response = await api.get<AlertsResponse>(`${endpoints.alerts}?unread=1`);
      return response.body ?? [];
    },
    enabled,
    refetchInterval: 120_000,        // 120 segundos
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
    // throwOnError: false para que React Query no lance y el componente
    // pueda inspeccionar isError/error y decidir qué mostrar.
    // En offline 503, el error se captura pero data anterior persiste en cache.
    throwOnError: (error) => !isOfflineError(error),
  });
}

/**
 * Hook: alertas leídas del admin (historial).
 * - Polling cada 120s (refetchInterval: 120000)
 * - Refetch al recuperar el foco de la ventana
 * - Maneja offline 503: no lanza error global, deja data anterior en cache
 * - Cache key: ['alerts', 'read']
 * @param enabled Si false, desactiva la query
 */
export function useReadAlerts(enabled = true) {
  return useQuery<Alert[], Error>({
    queryKey: ['alerts', 'read'],
    queryFn: async (): Promise<Alert[]> => {
      const response = await api.get<AlertsResponse>(`${endpoints.alerts}?read=1`);
      return response.body ?? [];
    },
    enabled,
    refetchInterval: 120_000,        // 120 segundos
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
    throwOnError: (error) => !isOfflineError(error),
  });
}

/**
 * Mutación: marca una alerta como leída.
 * Payload: { id } → backend fija read_at = NOW().
 * Invalida AMBAS queries (unread y read) al éxito.
 */
export function useMarkAlertAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(endpoints.alerts, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

/**
 * Mutación: marca todas las alertas pendientes como leídas.
 * Payload: cuerpo vacío → backend fija read_at = NOW() en todas con read_at IS NULL.
 * Invalida AMBAS queries (unread y read) al éxito.
 */
export function useMarkAllAlertsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post(`${endpoints.alerts}/read-all`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}