import { useState, useEffect } from "react";
import { useSnackbar } from "notistack";
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Package,
  ClipboardList,
  Car,
  User,
  FileText,
  Trash2,
  Image,
} from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { CustomInput } from "@/components/ui/CustomInput";
import { WorkOrder } from "@/hooks/useWorkOrders";
import { useUserContext } from "@/context/UserContext";
import { useApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/api";
import { OrderStatusButton } from "@/components/OrderStatusButton";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { EvidenceGallery } from "@/components/EvidenceGallery";
import { EVIDENCE_ALLOWED_TYPES, EVIDENCE_MAX_SIZE, EVIDENCE_ACCEPT } from "@/hooks/useEvidenceUpload";
import { generateShortUid } from "@/utils/uid";

// --- Componente ---

/**
 * Serializa los repuestos para el payload descartando campos obsoletos
 * (reference). Conserva el resto de propiedades (unit_price, notes, etc.).
 */
function serializeParts<T>(items: T[]): string {
  return JSON.stringify(
    items.map((item) => {
      const copy = { ...(item as Record<string, unknown>) };
      delete copy.reference;
      return copy;
    }),
  );
}

interface TechnicianOrderDetailProps {
  order: WorkOrder;
  onBack: () => void;
}

export function TechnicianOrderDetail({ order, onBack }: TechnicianOrderDetailProps) {
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUserContext();
  // La evidencia viene directamente en la orden (campo evidence)
  const evidence = order.evidence ?? [];
  // Estado local del estado de la orden: se sincroniza con la prop y
  // lo actualiza el select (PATCH inmediato a /api/orders/{id}/status)
  const [status, setStatus] = useState(order.status);
  useEffect(() => {
    setStatus(order.status);
  }, [order.status]);
  // Mantener sincronizado el comentario mostrado con el prop de la orden.
  useEffect(() => {
    setWithdrawalComment(order.withdrawal_comment ?? null);
  }, [order]);
  // Solo el técnico asignado puede cambiar el estado de la orden
  // (select en desktop, botón + modal en móvil).
  const canEditStatus = order.assigned_user_id !== (user?.id ?? null);
  const [parts, setParts] = useState<
    Array<{
      id: string;
      name: string;
      quantity: number;
      criticality: string;
      approvalStatus: string;
      requestedByTechnician: boolean;
      notes?: string;
    }>
  >(Array.isArray(order.parts) ? order.parts : []);
  const [checklist, setChecklist] = useState<
    Array<{
      id: string;
      title: string;
      category: string;
      priority: string;
      completed: boolean;
    }>
  >(Array.isArray(order.checklist) ? order.checklist : []);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [newPart, setNewPart] = useState({ name: "", quantity: 1, notes: "" });
  const [newCheckItem, setNewCheckItem] = useState({ title: "", category: "DIAGNOSTICO", priority: "MEDIA" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Modal de confirmación para Entregado / Cancelado (requiere comentario).
  // Mientras esté abierto, NO se persiste nada: solo Cancelar o Guardar.
  const [commentTarget, setCommentTarget] = useState<"delivered" | "cancelled" | null>(null);
  const [comment, setComment] = useState("");
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  // Comentario de entrega/cancelación: se sincroniza con la orden y se
  // actualiza localmente tras guardar para reflejarlo sin recargar.
  const [withdrawalComment, setWithdrawalComment] = useState<string | null>(order.withdrawal_comment ?? null);

  const handleSubmitNewPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPart.name.trim()) return;

    setIsSubmitting(true);

    const newPartItem = {
      id: generateShortUid(),
      name: newPart.name.trim(),
      quantity: newPart.quantity,
      criticality: "preventive",
      approvalStatus: "pending",
      requestedByTechnician: true,
      notes: newPart.notes.trim() || undefined,
    };

    const updatedParts = [...parts, newPartItem];

    try {
      setParts(updatedParts);

      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          parts: serializeParts(updatedParts),
        },
        {
          successMessage: "Repuesto solicitado exitosamente",
        },
      );

      setNewPart({ name: "", quantity: 1, notes: "" });
      setIsRequestModalOpen(false);
    } catch (error) {
      // El error ya se muestra globalmente
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitNewCheckItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItem.title.trim()) return;

    setIsSubmitting(true);

    const newItem = {
      id: generateShortUid(),
      title: newCheckItem.title.trim(),
      category: newCheckItem.category,
      priority: newCheckItem.priority,
      completed: false,
    };

    const updatedChecklist = [...checklist, newItem];

    try {
      setChecklist(updatedChecklist);

      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          checklist: JSON.stringify(updatedChecklist),
        },
        {
          successMessage: "Item agregado al checklist",
        },
      );

      setNewCheckItem({ title: "", category: "DIAGNOSTICO", priority: "MEDIA" });
      setIsChecklistModalOpen(false);
    } catch (error) {
      // El error ya se muestra globalmente
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleChecklistItem = async (itemId: string) => {
    const updatedChecklist = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );

    try {
      setChecklist(updatedChecklist);

      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          checklist: JSON.stringify(updatedChecklist),
        },
        {
          showSuccess: false,
        },
      );
    } catch (error) {
      setChecklist(checklist);
    }
  };

  const deleteChecklistItem = async (itemId: string) => {
    const updatedChecklist = checklist.filter((item) => item.id !== itemId);

    try {
      setChecklist(updatedChecklist);

      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          checklist: JSON.stringify(updatedChecklist),
        },
        {
          successMessage: "Item eliminado",
        },
      );
    } catch (error) {
      setChecklist(checklist);
    }
  };

  const deletePart = async (partId: string) => {
    const updatedParts = parts.filter((p) => p.id !== partId);

    try {
      setParts(updatedParts);

      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          parts: serializeParts(updatedParts),
        },
        {
          successMessage: "Repuesto eliminado",
        },
      );
    } catch (error) {
      setParts(parts);
    }
  };

  // --- Entrega / Cancelación con comentario ---

  const openCommentModal = (status: string) => {
    if (status !== "delivered" && status !== "cancelled") return;
    setCommentTarget(status);
    setComment("");
  };

  const closeCommentModal = () => {
    setCommentTarget(null);
    setComment("");
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
            commentTarget === "delivered"
              ? "Orden entregada exitosamente"
              : "Orden cancelada exitosamente",
        },
      );

      setStatus(commentTarget);
      setWithdrawalComment(comment);
      closeCommentModal();
    } catch {
      // El error ya se muestra globalmente (apiClient)
    } finally {
      setIsCommentSaving(false);
    }
  };

  const getPartStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <CustomBadge variant='success' dot>
            Aprobado
          </CustomBadge>
        );
      case "pending":
        return (
          <CustomBadge variant='warning' dot>
            Pendiente
          </CustomBadge>
        );
      case "rejected":
        return (
          <CustomBadge variant='danger' dot>
            Rechazado
          </CustomBadge>
        );
      default:
        return <CustomBadge variant='neutral'>{status}</CustomBadge>;
    }
  };

  const getCriticalityIcon = (criticality: string) => {
    switch (criticality) {
      case "critical":
        return <ShieldAlert className='h-4 w-4 text-red-500' />;
      case "preventive":
        return <ShieldAlert className='h-4 w-4 text-amber-500' />;
      default:
        return <ShieldAlert className='h-4 w-4 text-slate-400' />;
    }
  };

  const completedCount = checklist.filter((i) => i.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  return (
    <div className='space-y-6'>
      {/* Header
          Móvil (<850px, breakpoint wide): fila 1 [Volver] ... [Orden # + fecha],
          fila 2 badge clickeable (OrderStatusButton → modal).
          Desktop (≥850px): fila única [Volver] [Orden # + badge clickeable]. */}
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 wide:flex-nowrap'>
        <CustomButton variant='ghost' size='sm' leftIcon={<ArrowLeft className='h-4 w-4' />} onClick={onBack}>
          Volver
        </CustomButton>
        <div className='order-1 min-w-0 text-right wide:order-none wide:text-left'>
          <h1 className='text-2xl font-extrabold tracking-tight text-slate-900'>Orden #{order.id}</h1>
          <p className='text-sm text-slate-500'>Creada: {new Date(order.created_at).toLocaleDateString("es-CO")}</p>
        </div>
        {/* Estado: PATCH inmediato (solo si la orden es del técnico).
            Badge clickeable con lápiz que abre el modal de opciones. */}
        <div className='order-2 flex w-full min-w-0 items-center justify-end gap-2 wide:order-none wide:ml-auto wide:w-auto'>
          <OrderStatusButton
            orderId={order.id}
            currentStatus={status}
            onStatusChange={setStatus}
            onStatusWithComment={openCommentModal}
          />
        </div>
      </div>

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className='mb-4 flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <Car className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Datos del Vehículo</h2>
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
          <div>
            <p className='text-xs font-medium text-slate-400'>Placa</p>
            <p className='text-sm font-bold text-slate-800'>{order.vehicle_plate}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Marca</p>
            <p className='text-sm font-bold text-slate-800'>{order.vehicle_make}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Modelo</p>
            <p className='text-sm font-bold text-slate-800'>{order.vehicle_model}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Año</p>
            <p className='text-sm font-bold text-slate-800'>{order.vehicle_year}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Odómetro</p>
            <p className='text-sm font-bold text-slate-800'>{order.mileage} km</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Combustible</p>
            <p className='text-sm font-bold text-slate-800'>{order.fuel_level}</p>
          </div>
        </div>
      </CustomCard>

      {/* Datos del Cliente */}
      <CustomCard>
        <div className='mb-4 flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <User className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Datos del Cliente</h2>
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div>
            <p className='text-xs font-medium text-slate-400'>Nombre</p>
            <p className='text-sm font-bold text-slate-800'>{order.customer_name}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Teléfono</p>
            <p className='text-sm font-bold text-slate-800'>{order.customer_phone}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-slate-400'>Email</p>
            <p className='text-sm font-bold text-slate-800'>{order.customer_email}</p>
          </div>
        </div>
      </CustomCard>

      {/* Descripción de la falla */}
      <CustomCard>
        <div className='mb-4 flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <FileText className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Descripción de la Falla</h2>
        </div>
        <p className='text-sm text-slate-600'>{order.failure_description || "Sin descripción"}</p>
      </CustomCard>

      {/* Detalles del Vehículo */}
      {(order as { vehicle_details?: string }).vehicle_details && (
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <FileText className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Detalles del Vehículo</h2>
          </div>
          <p className='text-sm text-slate-600 whitespace-pre-wrap'>
            {(order as { vehicle_details?: string }).vehicle_details}
          </p>
        </CustomCard>
      )}

      {/* Progreso del checklist */}
      {checklist.length > 0 && (
        <CustomCard>
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-sm font-bold text-slate-800'>Progreso de ejecución</span>
            <span className='text-sm font-extrabold text-brand-600'>{progress}%</span>
          </div>
          <div className='h-2.5 overflow-hidden rounded-full bg-slate-100'>
            <div
              className='h-full rounded-full bg-brand-600 transition-all duration-500 ease-out'
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className='mt-2 text-xs font-medium text-slate-400'>
            {completedCount} de {checklist.length} tareas completadas
          </p>
        </CustomCard>
      )}

      {/* Repuestos Solicitados - EDITABLE */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Package className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Repuestos Solicitados</h2>
          </div>
          <CustomButton
            type='button'
            size='sm'
            leftIcon={<Plus className='h-3 w-3' />}
            onClick={() => setIsRequestModalOpen(true)}
          >
            Agregar
          </CustomButton>
        </div>

        <div className='space-y-3'>
          {parts.length === 0 ? (
            <p className='text-sm text-slate-400'>No hay repuestos solicitados</p>
          ) : (
            parts.map((part) => (
              <div
                key={part.id}
                className='flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
              >
                <div className='mt-0.5'>{getCriticalityIcon(part.criticality)}</div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-bold text-slate-800 truncate'>{part.name}</p>
                  <p className='mt-0.5 text-xs font-medium text-slate-400'>Cant: {part.quantity}</p>
                  {part.notes && <p className='mt-2 text-xs italic text-slate-500'>&ldquo;{part.notes}&rdquo;</p>}
                </div>
                <div className='flex items-center gap-2'>
                  {getPartStatusBadge(part.approvalStatus)}
                  <button
                    onClick={() => deletePart(part.id)}
                    className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                    title='Eliminar repuesto'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Nota de seguridad - OCULTA */}
        {/* <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-50 p-3 text-xs font-semibold text-brand-700">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Los precios COP no son visibles para técnicos.</span>
        </div> */}
      </CustomCard>

      {/* Checklist de Ejecución - EDITABLE */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <ClipboardList className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Checklist de Ejecución</h2>
          </div>
          <CustomButton
            type='button'
            size='sm'
            leftIcon={<Plus className='h-3 w-3' />}
            onClick={() => setIsChecklistModalOpen(true)}
          >
            Agregar
          </CustomButton>
        </div>

        <div className='space-y-2'>
          {checklist.length === 0 ? (
            <p className='text-sm text-slate-400'>No hay items en el checklist</p>
          ) : (
            checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                  item.completed ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white"
                }`}
              >
                <button
                  onClick={() => toggleChecklistItem(item.id)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    item.completed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  {item.completed && <CheckCircle2 className='h-4 w-4' />}
                </button>
                <div className='flex-1'>
                  <p
                    className={`text-sm font-bold ${
                      item.completed ? "text-emerald-700 line-through" : "text-slate-800"
                    }`}
                  >
                    {item.title}
                  </p>
                  <div className='mt-1 flex items-center gap-2'>
                    <span className='text-xs font-medium text-slate-400'>{item.category}</span>
                    {item.priority === "ALTA" && (
                      <CustomBadge variant='danger' dot>
                        Alta
                      </CustomBadge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteChecklistItem(item.id)}
                  className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                  title='Eliminar item'
                >
                  <Trash2 className='h-4 w-4' />
                </button>
              </div>
            ))
          )}
        </div>
      </CustomCard>

      {evidence.length > 0 && (
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Image className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Evidencias cargadas ({evidence.length})</h2>
          </div>
          <EvidenceGallery evidence={evidence} />
        </CustomCard>
      )}

      <EvidenceUploader orderId={order.id} />

      {/* Comentario de entrega/cancelación (solo si la orden ya lo tiene) */}
      {withdrawalComment && withdrawalComment.trim() !== "" && (
        <CustomCard>
          <div className='mb-3 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <FileText className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Comentario de entrega/cancelación</h2>
          </div>
          <p className='whitespace-pre-wrap text-sm text-slate-600'>{withdrawalComment}</p>
        </CustomCard>
      )}

      {/* Modal de solicitud de repuesto */}
      <CustomDialog open={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title='Solicitar Repuesto'>
        <form onSubmit={handleSubmitNewPart} className='space-y-4'>
          <CustomInput
            label='Nombre del repuesto'
            value={newPart.name}
            onChange={(e) => setNewPart((prev) => ({ ...prev, name: e.target.value }))}
            placeholder='Ej: Pastillas de freno traseras'
            required
          />
          <CustomInput
            label='Cantidad'
            type='number'
            min={1}
            value={newPart.quantity}
            onChange={(e) =>
              setNewPart((prev) => ({
                ...prev,
                quantity: parseInt(e.target.value, 10) || 1,
              }))
            }
          />
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Notas técnicas</label>
            <textarea
              value={newPart.notes}
              onChange={(e) => setNewPart((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder='Motivo técnico de la solicitud...'
              rows={3}
              className='input-field resize-none'
            />
          </div>
          <div className='flex gap-3'>
            <CustomButton
              type='button'
              variant='secondary'
              className='flex-1'
              onClick={() => setIsRequestModalOpen(false)}
            >
              Cancelar
            </CustomButton>
            <CustomButton type='submit' className='flex-1' isLoading={isSubmitting}>
              Enviar Solicitud
            </CustomButton>
          </div>
        </form>
      </CustomDialog>

      {/* Modal de agregar item al checklist */}
      <CustomDialog
        open={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        title='Agregar Item al Checklist'
      >
        <form onSubmit={handleSubmitNewCheckItem} className='space-y-4'>
          <CustomInput
            label='Título del trabajo'
            value={newCheckItem.title}
            onChange={(e) => setNewCheckItem((prev) => ({ ...prev, title: e.target.value }))}
            placeholder='Ej: Revisión de frenos'
            required
          />
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Prioridad</label>
            <select
              value={newCheckItem.priority}
              onChange={(e) => setNewCheckItem((prev) => ({ ...prev, priority: e.target.value }))}
              className='input-field'
            >
              <option value='ALTA'>Alta</option>
              <option value='MEDIA'>Media</option>
              <option value='BAJA'>Baja</option>
            </select>
          </div>
          <div className='flex gap-3'>
            <CustomButton
              type='button'
              variant='secondary'
              className='flex-1'
              onClick={() => setIsChecklistModalOpen(false)}
            >
              Cancelar
            </CustomButton>
            <CustomButton type='submit' className='flex-1' isLoading={isSubmitting}>
              Agregar Item
            </CustomButton>
          </div>
        </form>
      </CustomDialog>

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
