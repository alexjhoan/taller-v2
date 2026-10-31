import { Fragment } from 'react';
import { RefreshCw } from 'lucide-react';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomButton } from '@/components/ui/CustomButton';
import { formatAlertDate, getAlertBadgeVariant, getAlertTypeInfo, formatUnreadCount } from '@/utils/alerts';
import type { Alert } from '@/utils/alerts';

interface AlertListProps {
  /** Lista de alertas a mostrar */
  alerts: Alert[];
  /** Mensaje cuando no hay alertas */
  emptyMessage: string;
  /** Callback al marcar una alerta como leída (solo si showActions=true) */
  onMarkRead?: (id: string, orderId: string | null) => void;
  /** Callback al hacer click en una alerta para navegar a la orden */
  onClickAlert?: (orderId: string | null) => void;
  /** Callback al marcar todas como leídas (solo si showActions=true) */
  onMarkAllRead?: () => void;
  /** Estado de carga inicial */
  isLoading: boolean;
  /** Estado de error */
  isError: boolean;
  /** Objeto de error */
  error: Error | null;
  /** Reintentar carga */
  onRetry: () => void;
  /** Si mostrar botones de acción (marcar leída, marcar todas) */
  showActions: boolean;
  /** Ref al botón refresh para loading state (opcional) */
  isRefreshing?: boolean;
}

/**
 * Lista reutilizable de alertas.
 * - showActions=true: modal "No leídas" y página tab "No leídas" (con botones marcar).
 * - showActions=false: página tab "Leídas" (solo lectura).
 */
export function AlertList({
  alerts,
  emptyMessage,
  onMarkRead,
  onClickAlert,
  onMarkAllRead,
  isLoading,
  isError,
  error,
  onRetry,
  showActions,
  isRefreshing = false,
}: AlertListProps) {
  const isOffline = error && (error as any).status === 503;
  const isEmpty = !isLoading && !isRefreshing && !isError && alerts.length === 0;

  return (
    <Fragment>
      {/* Header con contador y botones (solo si showActions) */}
      {showActions && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex-1">
            Notificaciones
            {alerts.length > 0 && (
              <CustomBadge variant="neutral" className="ml-2" dot>
                {formatUnreadCount(alerts.length)}
              </CustomBadge>
            )}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Botón Refresh */}
            <CustomButton
              variant="ghost"
              size="sm"
              onClick={onRetry}
              disabled={isLoading || isRefreshing}
              aria-label={isRefreshing ? 'Actualizando...' : 'Actualizar notificaciones'}
              title={isRefreshing ? 'Actualizando...' : 'Actualizar'}
              className="whitespace-nowrap"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </CustomButton>
            {/* Botón Marcar todas */}
            {alerts.length > 0 && onMarkAllRead && (
              <CustomButton
                variant="secondary"
                size="sm"
                onClick={onMarkAllRead}
                className="whitespace-nowrap"
              >
                Marcar todas como leídas
              </CustomButton>
            )}
          </div>
        </div>
      )}

      {/* Contenido según estado */}
      {isLoading && !isRefreshing && (
        // Skeletons de carga inicial
        <div className="space-y-3" role="status" aria-label="Cargando notificaciones">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-3">
              <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-3/4 bg-slate-200 rounded mb-1" />
              <div className="h-3 w-1/2 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {isRefreshing && (
        // Loader durante refresh manual: oculta lista y muestra spinner centrado
        <div className="flex items-center justify-center py-8" role="status" aria-label="Actualizando notificaciones">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
          <span className="ml-2 text-sm text-slate-500">Actualizando...</span>
        </div>
      )}

      {!isLoading && !isRefreshing && isEmpty && (
        <p className="text-center text-sm text-slate-400 py-6">
          {emptyMessage}
        </p>
      )}

      {!isLoading && !isRefreshing && isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700 mb-3">
            {error?.message ?? 'Error al cargar notificaciones'}
          </p>
          <CustomButton variant="ghost" size="sm" onClick={onRetry}>
            Reintentar
          </CustomButton>
        </div>
      )}

      {/* Lista de alertas */}
      {!isLoading && !isRefreshing && !isError && alerts.length > 0 && (
        <Fragment>
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              role={showActions ? 'menuitem' : 'button'}
              tabIndex={0}
              onClick={() => {
                // Navegar a la orden si tiene order_id
                if (alert.order_id && onClickAlert) {
                  onClickAlert(alert.order_id);
                }
                // Marcar como leída solo en tab "no leídas" (showActions=true)
                if (showActions && onMarkRead) {
                  onMarkRead(alert.id, alert.order_id);
                }
              }}
              className={`w-full text-left rounded-xl border border-slate-200 p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer ${
                showActions
                  ? 'bg-white hover:bg-slate-50'
                  : 'bg-slate-50 hover:bg-slate-100'
              }`}
              disabled={!showActions && !onClickAlert}
            >
              <div className="flex items-start gap-2.5">
                <CustomBadge
                  variant={getAlertBadgeVariant(alert.type)}
                  dot
                  className="shrink-0 mt-0.5"
                >
                  {getAlertTypeInfo(alert.type).label}
                </CustomBadge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 line-clamp-2">
                    {alert.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatAlertDate(alert.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </Fragment>
      )}
    </Fragment>
  );
}