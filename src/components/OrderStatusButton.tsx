import { useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/services/apiClient';
import { endpoints } from '@/services/api';
import { ORDER_STATUS_SELECT_OPTIONS } from '@/utils/orderFilters';
import { CustomDialog } from '@/components/ui/CustomDialog';

// ============================================================
// Botón de cambio de estado de una orden: badge clickeable
// con ícono de lápiz. Al tocarlo abre un CustomDialog con las
// opciones de status. Al elegir una opción hace PATCH inmediato
// a /api/orders/{id}/status (feedback Notistack vía apiClient),
// refresca la lista de órdenes y cierra el modal.
//
// Excepción: para los statuses que requieren comentario
// (delivered/cancelled), si el padre pasa `onStatusWithComment`,
// NO hace PATCH: cierra el modal de opciones y delega en el padre
// para que abra su modal de confirmación.
// ============================================================

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type ButtonSize = 'sm' | 'md';

/** Clases de color del badge por variante (mismos tonos que CustomBadge). */
const VARIANT_BADGE_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};

/** Color del punto de estado (mismos tonos que CustomBadge). */
const STATUS_DOT_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
};

/** Variante de color por status del backend. */
const STATUS_VARIANTS: Record<string, StatusVariant> = {
  received: 'info',
  diagnosing: 'warning',
  awaiting_approval: 'warning',
  approved: 'success',
  in_progress: 'info',
  ready: 'success',
  delivered: 'success',
  cancelled: 'danger',
};

/** Clases de tamaño para el badge clickeable. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-sm',
};

const OPTION_CLASSES =
  'flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-colors';

/**
 * Statuses que requieren un comentario de entrega/cancelación antes de
 * persistir. El padre los intercepta (vía `onStatusWithComment`) para abrir
 * su modal de confirmación en vez de hacer PATCH inmediato.
 */
const COMMENT_REQUIRED_STATUSES = new Set(['delivered', 'cancelled']);

interface OrderStatusButtonProps {
  /** Id de la orden (necesario para el PATCH). */
  orderId: number;
  /** Estado actual controlado por el padre. */
  currentStatus: string;
  /** Se llama con el status nuevo (tras un PATCH exitoso). */
  onStatusChange: (status: string) => void;
  /**
   * Si se provee, se llama para los statuses que requieren comentario
   * (delivered/cancelled) EN VEZ de hacer PATCH inmediato. El padre abre su
   * modal de confirmación y persiste el cambio.
   */
  onStatusWithComment?: (status: string) => void;
  /** Deshabilitar (p.ej. técnico viendo una orden que no es suya). */
  disabled?: boolean;
  /** Tamaño del badge (sm por defecto para que quepa en el header). */
  size?: ButtonSize;
}

export function OrderStatusButton({
  orderId,
  currentStatus,
  onStatusChange,
  onStatusWithComment,
  disabled = false,
  size = 'sm',
}: OrderStatusButtonProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus || isUpdating) return;

    // Estados que requieren comentario: cerrar el modal de opciones y delegar
    // en el padre (abre su modal de confirmación) sin hacer PATCH inmediato.
    if (onStatusWithComment && COMMENT_REQUIRED_STATUSES.has(newStatus)) {
      setIsOpen(false);
      onStatusWithComment(newStatus);
      return;
    }

    setIsUpdating(true);
    try {
      await apiClient.patch(
        endpoints.orderStatus(orderId),
        { status: newStatus },
        { successMessage: 'Estado actualizado' }
      );
      onStatusChange(newStatus);
      setIsOpen(false);
      // Refrescar la lista de órdenes para que refleje el nuevo estado
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
    } catch {
      // El error ya se muestra globalmente (apiClient)
    } finally {
      setIsUpdating(false);
    }
  };

  const currentOption = ORDER_STATUS_SELECT_OPTIONS.find((option) => option.value === currentStatus);
  const currentLabel = currentOption?.label ?? currentStatus;
  const currentVariant = STATUS_VARIANTS[currentStatus] ?? 'neutral';

  return (
    <>
      <button
        type='button'
        disabled={disabled || isUpdating}
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset transition-all hover:shadow-md ${SIZE_CLASSES[size]} ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:brightness-95'
        } ${VARIANT_BADGE_CLASSES[currentVariant]}`}
        aria-label='Cambiar estado'
      >
        <span className='flex min-w-0 items-center gap-2'>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[currentVariant]}`}
          />
          <span className='truncate'>{currentLabel}</span>
        </span>
        {isUpdating ? (
          <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin opacity-60' />
        ) : (
          <Pencil className='h-3.5 w-3.5 shrink-0 opacity-60' />
        )}
      </button>

      <CustomDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title='Cambiar estado'
        maxWidth='sm'
      >
        <div className='space-y-1'>
          {ORDER_STATUS_SELECT_OPTIONS.map((option) => {
            const isSelected = option.value === currentStatus;
            return (
              <button
                key={option.value}
                type='button'
                onClick={() => handleChange(option.value)}
                disabled={isUpdating}
                className={`${OPTION_CLASSES} ${
                  isSelected
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      STATUS_DOT_CLASSES[STATUS_VARIANTS[option.value] ?? 'neutral']
                    }`}
                  />
                  <span className='truncate'>{option.label}</span>
                </span>
                {isSelected && <Check className='h-4 w-4 shrink-0' />}
              </button>
            );
          })}
        </div>
      </CustomDialog>
    </>
  );
}
