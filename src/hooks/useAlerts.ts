import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useMemo } from 'react';
import { api, endpoints, ApiError } from '@/services/api';
import type { Alert } from '@/utils/alerts';
import { useWorkOrders, WorkOrder as MechanicWorkOrder } from '@/hooks/useWorkOrders';
import { useUserContext } from '@/context/UserContext';
import { useSnackbar } from 'notistack';

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
 * Determina si un error es el modo offline (503 / OfflineMode) o error de servidor (500).
 */
function isOfflineOrServerError(error: unknown): boolean {
  const err = error as any;
  const status = err?.status ?? err?.response?.status;
  const statusText = err?.statusText ?? err?.response?.statusText;
  return status === 503 || statusText === 'OfflineMode' || status === 500;
}

/**
 * Hook principal: alertas no leídas del admin.
 * - Polling cada 120s (refetchInterval: 120000)
 * - Refetch al recuperar el foco de la ventana
 * - Maneja offline 503: no lanza error global, deja data anterior en cache
 * - Cache key: ['alerts', 'unread']
 * - Cuando llegan NUEVAS notificaciones (count aumenta), invalida la query de órdenes para actualizarlas
 * @param enabled Si false, desactiva la query (útil para solo admin)
 */
export function useUnreadAlerts(enabled = true) {
  const queryClient = useQueryClient();
  const prevCountRef = useRef<number>(0);

  // Trackear cambios en el count para invalidar órdenes cuando hay nuevas notificaciones
  // Se usa un efecto que compara el count actual con el anterior
  // NOTA: useQuery no expone onSuccess con previous data, así que usamos un ref + useEffect
  // que observa los datos devueltos por la query
  
  const query = useQuery<Alert[], Error>({
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
    throwOnError: (error) => !isOfflineOrServerError(error),
  });

  // Efecto para detectar NUEVAS notificaciones (count aumentó)
  // y invalidar la query de órdenes para que se actualicen
  useEffect(() => {
    if (!enabled || query.data === undefined) return;
    
    const currentCount = query.data.length;
    
    // Si el count aumentó respecto al anterior, hay notificaciones nuevas
    if (prevCountRef.current > 0 && currentCount > prevCountRef.current) {
      // Invalidar query de órdenes para que se actualicen con las nuevas notificaciones
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
    }
    
    // Actualizar ref con el count actual
    prevCountRef.current = currentCount;
  }, [query.data, enabled, queryClient]);

  return query;
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
    throwOnError: (error) => !isOfflineOrServerError(error),
  });
}

/**
 * Mutación: marca una alerta como leída.
 * Payload: { id } → backend fija read_at = NOW().
 * Invalida AMBAS queries (unread y read) al éxito.
 */
export function useMarkAlertAsRead() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(endpoints.alerts, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError;
      const body = apiError?.body as Record<string, unknown> | undefined;
      const message = (body?.statusText as string) || apiError?.message || 'Error al marcar alerta como leída';
      enqueueSnackbar(message, { variant: 'error', persist: false });
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
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<{ updated: number }, Error, void>({
    mutationFn: async () => {
      const response = await api.post<{ updated: number }>(`${endpoints.alerts}/read-all`, {});
      return response;
    },
    onSuccess: (data: { updated: number }) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      if (data.updated > 0) {
        enqueueSnackbar(`${data.updated} alerta${data.updated > 1 ? 's' : ''} marcada${data.updated > 1 ? 's' : ''} como leída`, { variant: 'success' });
      }
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError;
      const body = apiError?.body as Record<string, unknown> | undefined;
      const message = (body?.statusText as string) || apiError?.message || 'Error al marcar todas como leídas';
      enqueueSnackbar(message, { variant: 'error', persist: false });
    },
  });
}

/**
 * Hook: alertas no leídas del MECÁNICO.
 * - El backend ya filtra por token de usuario (JWT).
 * - Mismo polling/refetch que admin.
 * - NO filtramos en cliente: el backend ya filtra por JWT.
 * @param enabled Si false, desactiva la query
 */
export function useMechanicUnreadAlerts(enabled = true) {
  const { user } = useUserContext();
  const queryClient = useQueryClient();
  const prevCountRef = useRef<number>(0);

  const query = useQuery<Alert[], Error>({
    queryKey: ['alerts', 'unread', 'mechanic', user?.id],
    queryFn: async (): Promise<Alert[]> => {
      const response = await api.get<AlertsResponse>(`${endpoints.alerts}?unread=1`);
      return response.body ?? [];
    },
    enabled: enabled && !!user?.id,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
    throwOnError: (error) => !isOfflineOrServerError(error),
  });

  // Efecto para detectar NUEVAS notificaciones y invalidar órdenes
  useEffect(() => {
    if (!enabled || query.data === undefined) return;
    
    const currentCount = query.data.length;
    
    if (prevCountRef.current > 0 && currentCount > prevCountRef.current) {
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
    }
    
    prevCountRef.current = currentCount;
  }, [query.data, enabled, queryClient]);

  return query;
}