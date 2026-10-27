import { Fragment } from "react";
import { RefreshCw, ChevronDown, ExternalLink } from "lucide-react";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { AlertList } from "@/components/AlertList";
import { formatAlertDate, getAlertBadgeVariant, getAlertTypeInfo, formatUnreadCount } from "@/utils/alerts";
import type { Alert } from "@/utils/alerts";
import { useEffect, useState } from "react";

interface NotificationModalProps {
  /** Si el modal está abierto */
  open: boolean;
  /** Callback al cerrar */
  onClose: () => void;
  /** Lista de alertas pendientes */
  alerts: Alert[];
  /** Marcar una alerta como leída */
  onMarkRead: (id: string, orderId: string | null) => void;
  /** Marcar todas como leídas */
  onMarkAllRead: () => void;
  /** Navegar a página completa de notificaciones */
  onViewAll: () => void;
  /** Estado de carga inicial */
  isLoading: boolean;
  /** Estado de error */
  isError: boolean;
  /** Objeto de error */
  error: Error | null;
  /** Reintentar carga (refetch) */
  onRetry: () => void;
  /** Ref a la campana para devolver foco al cerrar */
  bellRef: React.RefObject<HTMLButtonElement>;
}

/**
 * Modal de notificaciones pendientes (acceso rápido).
 * Solo muestra alertas con `read_at === null` (pendientes), ordenadas por fecha (más reciente arriba).
 * Click en alerta → marca leída + navega a la orden.
 * Incluye botón "Marcar todas como leídas", botón refresh y "Ver todas".
 */
export function NotificationModal({
  open,
  onClose,
  alerts,
  onMarkRead,
  onMarkAllRead,
  onViewAll,
  isLoading,
  isError,
  error,
  onRetry,
  bellRef,
}: NotificationModalProps) {
  const isOffline = error && (error as any).status === 503;
  const isEmpty = !isLoading && !isError && alerts.length === 0;

  // Estado local para refresh manual
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Devolver foco a la campana al cerrar
  useEffect(() => {
    if (!open) {
      bellRef.current?.focus();
    }
  }, [open, bellRef]);

  // Detectar si es offline 503 (el hook usa throwOnError para no propagar 503)
  const showOfflineNotice = isError && isOffline;

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRetry();
    // El hook invalida la query y React Query vuelve a fetch.
    // Cuando termine, isLoading será false y se renderizará la lista nueva.
    // Damos un pequeño margen para que se vea el loader.
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <CustomDialog
      open={open}
      onClose={onClose}
      title='Notificaciones pendientes'
      maxWidth='lg'
      disableBackdropClose={false}
      disableEscapeClose={false}
    >
      <div className='space-y-3'>
        {/* Lista de alertas usando componente reutilizable AlertList */}
        <AlertList
          alerts={alerts}
          emptyMessage='No tienes notificaciones pendientes'
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={onRetry}
          showActions={true}
          isRefreshing={isRefreshing}
        />

        {/* Mensajes de estado especializados que AlertList no cubre */}
        {isLoading && !isRefreshing && isEmpty && (
          <p className='text-center text-sm text-slate-400 py-6'>No tienes notificaciones pendientes</p>
        )}

        {!isLoading && !isRefreshing && isError && (
          <div className='rounded-xl border border-red-200 bg-red-50 p-4 text-center'>
            <p className='text-sm text-red-700 mb-3'>{error?.message ?? "Error al cargar notificaciones"}</p>
            <CustomButton variant='ghost' size='sm' onClick={onRetry}>
              Reintentar
            </CustomButton>
          </div>
        )}

        {showOfflineNotice && (
          <div className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-center'>
            <p className='text-sm text-amber-700 mb-3'>Sin conexión. Mostrando último estado conocido.</p>
            <CustomButton variant='ghost' size='sm' onClick={onRetry}>
              Reintentar
            </CustomButton>
          </div>
        )}
      </div>
      <div className='flex items-center justify-end gap-2 pt-8'>
        {/* Botón Ver todas - siempre visible si hay alertas o para ir al historial */}
        <CustomButton
          variant='ghost'
          size='sm'
          onClick={onViewAll}
          leftIcon={<ExternalLink className='h-3.5 w-3.5' />}
          className='whitespace-nowrap'
        >
          Ver todas
        </CustomButton>
      </div>
    </CustomDialog>
  );
}
