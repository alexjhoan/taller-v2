import { Calendar, User, UserCheck } from 'lucide-react';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { WorkOrder } from '@/hooks/useWorkOrders';
import { User as UserType } from '@/hooks/useUsers';

interface OrderCardProps {
  order: WorkOrder;
  onSelect: (order: WorkOrder) => void;
  /** Mostrar fecha de creación (dashboard) o finalización (historial) */
  dateLabel?: 'created' | 'finished';
  /** Mecánicos asignados (match con assigned_user_id, que es un array de IDs) */
  assignedUsers?: UserType[];
}

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  received: { label: 'Recibido', variant: 'info' },
  diagnosing: { label: 'Diagnóstico', variant: 'warning' },
  awaiting_approval: { label: 'Esperando aprobación', variant: 'warning' },
  approved: { label: 'Aprobado', variant: 'success' },
  in_progress: { label: 'En taller', variant: 'info' },
  ready: { label: 'Listo', variant: 'success' },
  delivered: { label: 'Entregado', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
};

const assignedStyles: Record<string, string> = {
  mechanic: 'bg-green-100 text-green-800 border-green-200',
  admin: 'bg-orange-100 text-orange-800 border-orange-200',
};

export function OrderCard({ order, onSelect, dateLabel = 'created', assignedUsers }: OrderCardProps) {
  const status = statusMap[order.status] || { label: order.status, variant: 'neutral' as const };

  const dateValue = dateLabel === 'finished' ? order.finished_at : order.created_at;

  return (
    <button
      type="button"
      onClick={() => onSelect(order)}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"
    >
      {/* Fila superior: número de orden + estado */}
      <div className="flex items-start justify-between gap-3">
        <span className="font-extrabold tracking-tight text-slate-900">
          Orden #{order.id}
        </span>
        <CustomBadge variant={status.variant} dot>
          {status.label}
        </CustomBadge>
      </div>

      {/* Placa + vehículo */}
      <p className="mt-1 text-xs font-semibold text-slate-400">
        {order.vehicle_plate} · {order.vehicle_make} {order.vehicle_model}
      </p>

      {/* Cliente */}
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate font-medium">{order.customer_name}</span>
      </div>

      {/* Asignados - siempre se muestra (un badge por mecánico) */}
      {assignedUsers && assignedUsers.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {assignedUsers.map((assignedUser) => (
            <span
              key={assignedUser.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${assignedStyles[assignedUser.role]}`}
            >
              <UserCheck className="h-3 w-3" />
              {assignedUser.first_name} {assignedUser.last_name}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            <UserCheck className="h-3 w-3" />
            No asignado
          </span>
        </div>
      )}

      {/* Fecha */}
      {dateValue && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            {dateLabel === 'finished' ? 'Entregado: ' : 'Creada: '}
            {new Date(dateValue).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      )}
    </button>
  );
}
