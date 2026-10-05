import {
  ArrowLeft,
  Car,
  User,
  FileText,
  ClipboardList,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { WorkOrder } from '@/hooks/useWorkOrders';

// --- Componente ---

interface AdminOrderDetailReadOnlyProps {
  order: WorkOrder;
  onBack: () => void;
}

export function AdminOrderDetailReadOnly({ order, onBack }: AdminOrderDetailReadOnlyProps) {
  const checklist = Array.isArray(order.checklist) ? order.checklist : [];
  const parts = Array.isArray(order.parts) ? order.parts : [];
  const completedCount = checklist.filter((i) => i.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const getOrderStatusBadge = (status: string) => {
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
    const config = statusMap[status] || { label: status, variant: 'neutral' as const };
    return <CustomBadge variant={config.variant} dot>{config.label}</CustomBadge>;
  };

  const getPartStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <CustomBadge variant="success" dot>Aprobado</CustomBadge>;
      case 'pending':
        return <CustomBadge variant="warning" dot>Pendiente</CustomBadge>;
      case 'rejected':
        return <CustomBadge variant="danger" dot>Rechazado</CustomBadge>;
      default:
        return <CustomBadge variant="neutral">{status}</CustomBadge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CustomButton variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
            Volver
          </CustomButton>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Orden #{order.id}
            </h1>
            <p className="text-sm text-slate-500">
              Creada: {new Date(order.created_at).toLocaleDateString('es-CO')}
            </p>
          </div>
        </div>
        {getOrderStatusBadge(order.status)}
      </div>

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <Car className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Vehículo</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-400">Placa</p>
            <p className="text-sm font-bold text-slate-800">{order.vehicle_plate}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Marca</p>
            <p className="text-sm font-bold text-slate-800">{order.vehicle_make}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Modelo</p>
            <p className="text-sm font-bold text-slate-800">{order.vehicle_model}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Año</p>
            <p className="text-sm font-bold text-slate-800">{order.vehicle_year}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Color</p>
            <p className="text-sm font-bold text-slate-800">{(order as { vehicle_color?: string }).vehicle_color || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Odómetro</p>
            <p className="text-sm font-bold text-slate-800">{order.mileage} km</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Combustible</p>
            <p className="text-sm font-bold text-slate-800">{order.fuel_level}</p>
          </div>
        </div>
      </CustomCard>

      {/* Datos del Cliente */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Cliente</h2>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-400">Nombre</p>
            <p className="text-sm font-bold text-slate-800">{order.customer_name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Teléfono</p>
            <p className="text-sm font-bold text-slate-800">{order.customer_phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Email</p>
            <p className="text-sm font-bold text-slate-800">{order.customer_email}</p>
          </div>
        </div>
      </CustomCard>

      {/* Datos de la Orden */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <FileText className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos de la Orden</h2>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-400">Descripción de la Falla</p>
            <p className="text-sm text-slate-600">{order.failure_description || 'Sin descripción'}</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Fecha de creación</p>
              <p className="text-sm font-bold text-slate-800">
                {new Date(order.created_at).toLocaleDateString('es-CO')}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Fecha de inicio</p>
              <p className="text-sm font-bold text-slate-800">
                {order.started_at ? new Date(order.started_at).toLocaleDateString('es-CO') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Fecha de entrega</p>
              <p className="text-sm font-bold text-slate-800">
                {order.finished_at ? new Date(order.finished_at).toLocaleDateString('es-CO') : '—'}
              </p>
            </div>
          </div>
        </div>
      </CustomCard>

      {/* Progreso del checklist */}
      {checklist.length > 0 && (
        <CustomCard>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
                <ClipboardList className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Progreso del Trabajo</h2>
            </div>
            <span className="text-sm font-extrabold text-brand-600">{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {completedCount} de {checklist.length} tareas completadas
          </p>

          <div className="mt-4 space-y-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  item.completed
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    item.completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {item.completed && <CheckCircle2 className="h-3 w-3" />}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-bold ${
                      item.completed ? 'text-emerald-700 line-through' : 'text-slate-800'
                    }`}
                  >
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{item.category}</span>
                    {item.priority === 'ALTA' && (
                      <CustomBadge variant="danger" dot>
                        Alta
                      </CustomBadge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CustomCard>
      )}

      {/* Repuestos Solicitados */}
      {parts.length > 0 && (
        <CustomCard>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <Package className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Repuestos Solicitados</h2>
          </div>
          <div className="space-y-3">
            {parts.map((part) => (
              <div
                key={part.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{part.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    Ref: {part.reference} · Cant: {part.quantity}
                  </p>
                  {part.notes && (
                    <p className="mt-2 text-xs italic text-slate-500">&ldquo;{part.notes}&rdquo;</p>
                  )}
                </div>
                <div className="shrink-0">{getPartStatusBadge(part.approvalStatus)}</div>
              </div>
            ))}
          </div>
        </CustomCard>
      )}
    </div>
  );
}
