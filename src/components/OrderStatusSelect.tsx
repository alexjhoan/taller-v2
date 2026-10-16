import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/services/apiClient';
import { endpoints } from '@/services/api';
import { ORDER_STATUS_SELECT_OPTIONS } from '@/utils/orderFilters';

// ============================================================
// Select de cambio de estado de una orden (unificado admin +
// técnico). Por defecto (immediate) al cambiar dispara PATCH a
// /api/orders/{id}/status con feedback (Notistack vía apiClient)
// y refresca la lista de órdenes (invalidateQueries work_orders).
// Con immediate=false solo notifica onChange y quien lo usa
// decide cuándo persistir.
// ============================================================

interface OrderStatusSelectProps {
  orderId: number;
  /** Estado actual controlado por el padre. */
  value: string;
  /** Se llama con el status nuevo (tras un PATCH exitoso, o sin PATCH si immediate=false). */
  onChange: (status: string) => void;
  /** Deshabilitar (p.ej. técnico viendo una orden que no es suya). */
  disabled?: boolean;
  /**
   * Si es true (default) hace PATCH inmediato al cambiar.
   * Si es false solo notifica onChange y el padre persiste el
   * status después (p.ej. junto con el resto en "Guardar").
   */
  immediate?: boolean;
  className?: string;
}

export function OrderStatusSelect({ orderId, value, onChange, disabled = false, immediate = true, className }: OrderStatusSelectProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === value || isUpdating) return;
    if (!immediate) {
      onChange(newStatus);
      return;
    }
    setIsUpdating(true);
    try {
      await apiClient.patch(
        endpoints.orderStatus(orderId),
        { status: newStatus },
        { successMessage: 'Estado actualizado' }
      );
      onChange(newStatus);
      // Refrescar la lista de órdenes para que refleje el nuevo estado
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
    } catch {
      // El error ya se muestra globalmente (apiClient)
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled || isUpdating}
      className={className ?? 'input-field'}
      aria-label='Cambiar estado'
    >
      {ORDER_STATUS_SELECT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
