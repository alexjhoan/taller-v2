import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Car,
  User,
  FileText,
  ClipboardList,
  Package,
  CheckCircle2,
  Clock,
  Image,
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomDialog } from '@/components/ui/CustomDialog';
import { EvidenceGallery } from '@/components/EvidenceGallery';
import { OrderStatusButton } from '@/components/OrderStatusButton';
import { useApiClient } from '@/services/apiClient';
import { endpoints } from '@/services/api';
import { WorkOrder } from '@/hooks/useWorkOrders';

// --- Componente ---

interface AdminOrderDetailReadOnlyProps {
  order: WorkOrder;
  onBack: () => void;
}

export function AdminOrderDetailReadOnly({ order, onBack }: AdminOrderDetailReadOnlyProps) {
  const router = useRouter();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const checklist = Array.isArray(order.checklist) ? order.checklist : [];
  const parts = Array.isArray(order.parts) ? order.parts : [];
  const evidence = Array.isArray(order.evidence) ? order.evidence : [];
  const completedCount = checklist.filter((i) => i.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  // Estado local del status: sincronizado con la orden y actualizado tras el PATCH.
  const [status, setStatus] = useState<string>(order.status);
  // Comentario de entrega/cancelación: se sincroniza con la orden y se
  // actualiza localmente tras guardar para reflejarlo sin recargar la lista.
  const [withdrawalComment, setWithdrawalComment] = useState<string | null>(order.withdrawal_comment ?? null);
  // Modal de confirmación para Entregado / Cancelado (requiere comentario).
  // Mientras esté abierto, NO se persiste nada: solo Cancelar o Guardar.
  const [commentTarget, setCommentTarget] = useState<'delivered' | 'cancelled' | null>(null);
  const [comment, setComment] = useState('');
  const [isCommentSaving, setIsCommentSaving] = useState(false);

  useEffect(() => {
    setStatus(order.status);
  }, [order.status]);

  // Mantener sincronizado el comentario mostrado con el prop de la orden.
  useEffect(() => {
    setWithdrawalComment(order.withdrawal_comment ?? null);
  }, [order]);

  // --- Entrega / Cancelación con comentario ---

  const openCommentModal = (newStatus: string) => {
    if (newStatus !== 'delivered' && newStatus !== 'cancelled') return;
    setCommentTarget(newStatus);
    setComment('');
  };

  const closeCommentModal = () => {
    setCommentTarget(null);
    setComment('');
  };

  // Persiste el cambio de estado + comentario. Solo cierra el modal si el
  // PATCH es exitoso; en error permanece abierto.
  const handleCommentSave = async () => {
    if (!commentTarget) return;

    setIsCommentSaving(true);
    try {
      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          status: commentTarget,
          withdrawal_comment: comment,
        },
        {
          successMessage:
            commentTarget === 'delivered'
              ? 'Orden entregada exitosamente'
              : 'Orden cancelada exitosamente',
        },
      );

      setStatus(commentTarget);
      setWithdrawalComment(comment);
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      closeCommentModal();
    } catch {
      // El error ya se muestra globalmente (apiClient)
    } finally {
      setIsCommentSaving(false);
    }
  };

  // approvalStatus es opcional (repuestos legacy/checkin, RF-10 interim);
  // sin estado se muestra el badge neutro "Ingresado" (decisión 12, T-11).
  const getPartStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'accepted':
        return <CustomBadge variant="success" dot>Aceptado</CustomBadge>;
      case 'pending':
        return <CustomBadge variant="warning" dot>Pendiente</CustomBadge>;
      case 'rejected':
        return <CustomBadge variant="danger" dot>Rechazado</CustomBadge>;
      default:
        return <CustomBadge variant="neutral">Ingresado</CustomBadge>;
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
        <OrderStatusButton
          orderId={order.id}
          currentStatus={status}
          onStatusChange={(newStatus) => setStatus(newStatus)}
          onStatusWithComment={openCommentModal}
        />
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
                    Cant: {part.quantity}
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

      {/* Evidencias */}
      {evidence.length > 0 && (
        <CustomCard>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <Image className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Evidencias cargadas ({evidence.length})</h2>
          </div>
          <EvidenceGallery evidence={evidence} />
        </CustomCard>
      )}

      {/* Comentario de entrega/cancelación */}
      {withdrawalComment && withdrawalComment.trim() !== '' && (
        <CustomCard>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <FileText className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Comentario de entrega/cancelación</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{withdrawalComment}</p>
        </CustomCard>
      )}

      {/* Ver historial de cambios */}
      <CustomButton
        variant='secondary'
        leftIcon={<Clock className='h-4 w-4' />}
        onClick={() => router.push(`/admin/order-log?orderId=${order.id}`)}
      >
        Ver Log de Cambios
      </CustomButton>

      {/* Modal de confirmación de entrega/cancelación (con comentario) */}
      <CustomDialog
        open={commentTarget !== null}
        onClose={closeCommentModal}
        title={commentTarget === 'delivered' ? 'Confirmar entrega' : 'Confirmar cancelación'}
      >
        <div className='space-y-4'>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Comentario</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className='input-field resize-none'
              placeholder={
                commentTarget === 'delivered'
                  ? 'Ej: Vehículo retirado por el cliente. Se explicaron las reparaciones realizadas.'
                  : 'Ej: El cliente canceló el servicio por motivos personales.'
              }
            />
          </div>
          <div className='flex gap-3'>
            <CustomButton type='button' variant='secondary' className='flex-1' onClick={closeCommentModal}>
              Cancelar
            </CustomButton>
            <CustomButton
              type='button'
              className='flex-1'
              onClick={handleCommentSave}
              isLoading={isCommentSaving}
              disabled={isCommentSaving}
            >
              Guardar
            </CustomButton>
          </div>
        </div>
      </CustomDialog>
    </div>
  );
}
