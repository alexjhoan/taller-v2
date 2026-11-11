import { useState, useEffect } from "react";
import { useRouter } from "next/router";
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
  Clock,
  ChevronUp,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { CustomInput } from "@/components/ui/CustomInput";
import { WorkOrder } from "@/hooks/useWorkOrders";
import { useApiClient } from "@/services/apiClient";
import { ApiError, endpoints } from "@/services/api";
import { OrderStatusButton } from "@/components/OrderStatusButton";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { EvidenceGallery } from "@/components/EvidenceGallery";
import { useUserContext } from "@/context/UserContext";
import { generateShortUid } from "@/utils/uid";
import { assignFallbackPartIds, canTechnicianDeletePart, serializeParts } from "@/utils/parts";
import { DeliveryCommentModal } from "@/components/DeliveryCommentModal";
import { PriceBreakdown } from "@/components/PriceBreakdown";

// --- Componente ---

/**
 * Formatea un error del guardado automático del checklist en texto legible:
 * `[ApiError 500] detalle` para errores de API o `[Tipo] mensaje` para el resto.
 */
function formatChecklistError(error: unknown): string {
  if (error instanceof ApiError) {
    const detail =
      error.body && typeof error.body === "object" && "statusText" in error.body
        ? (error.body as { statusText: string }).statusText
        : error.message;
    return `[ApiError ${error.status}] ${detail}`;
  }
  const err = error as Error;
  return `[${err?.name}] ${err?.message}`;
}

interface TechnicianOrderDetailProps {
  order: WorkOrder;
  onBack: () => void;
}

export function TechnicianOrderDetail({ order, onBack }: TechnicianOrderDetailProps) {
  const apiClient = useApiClient();
  const router = useRouter();
  // El botón del log de cambios solo se muestra a admin (spec 005 RF-4);
  // el mecánico no lo ve ni puede usarlo.
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
  // El estado es editable por todos (sin restricción de rol ni de asignación).
  // T-14: el backend aún devuelve parts sin id (RF-10 pendiente) y las
  // acciones por repuesto (eliminar/editar) comparan por p.id, así que sin
  // id de respaldo un solo clic borraría o editaría la lista entera. Se
  // asigna UNA vez al montar (inicializador diferido de useState) para que
  // cada id sea estable durante toda la sesión.
  const [parts, setParts] = useState<
    Array<{
      id: string;
      name: string;
      quantity: number;
      criticality: string;
      // Opcionales igual que en PartItem del hook: los repuestos legacy/checkin
      // no traen approvalStatus ni requestedByTechnician (RF-10 interim).
      approvalStatus?: string;
      requestedByTechnician?: boolean;
      notes?: string;
    }>
  >(() => assignFallbackPartIds(Array.isArray(order.parts) ? order.parts : [], generateShortUid));
  const [checklist, setChecklist] = useState<
    Array<{
      id: string;
      title: string;
      category: string;
      priority: string;
      completed: boolean;
      notes?: string; // Campo opcional para notas de ejecución
    }>
  >(Array.isArray(order.checklist) ? order.checklist : []);
  // Último error del guardado automático del checklist (se muestra en modal)
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [newPart, setNewPart] = useState({ name: "", quantity: 1, notes: "" });
  const [newCheckItem, setNewCheckItem] = useState({
    title: "",
    category: "DIAGNOSTICO",
    priority: "MEDIA",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Estados para cards expandibles
  const [isVehicleExpanded, setIsVehicleExpanded] = useState(true);
  const [isClientExpanded, setIsClientExpanded] = useState(true);

  // Estado para modal de notas del checklist item
  const [editingCheckItemNotes, setEditingCheckItemNotes] = useState<{
    id: string;
    title: string;
    notes?: string;
  } | null>(null);
  const [checkItemNotes, setCheckItemNotes] = useState("");
  const [isCheckItemNotesModalOpen, setIsCheckItemNotesModalOpen] = useState(false);
  // Modal de confirmación para Entregado / Cancelado (requiere comentario).
  // El contenido (textarea + botones) vive en DeliveryCommentModal;
  // aquí solo guardamos qué estado se está confirmando y si está guardando.
  const [commentTarget, setCommentTarget] = useState<"delivered" | "cancelled" | null>(null);
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  // Comentario local para el modal de entrega/cancelación
  const [closeOrderComment, setCloseOrderComment] = useState("");
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
      notes: newCheckItem.notes?.trim() || undefined,
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

      setNewCheckItem({ title: "", category: "DIAGNOSTICO", priority: "MEDIA", notes: "" });
      setIsChecklistModalOpen(false);
    } catch (error) {
      // El error ya se muestra globalmente
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardado automático: el toggle persiste el checklist completo en el
  // backend (PATCH optimista con rollback y modal de error si falla).
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
      setChecklistError(formatChecklistError(error));
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
    // RF-13 — Defensa en profundidad: el botón ya no se pinta si el
    // repuesto no es borrable, pero el handler también lo verifica antes
    // de persistir. Si no puede borrarlo, sale sin tocar nada.
    const part = parts.find((p) => p.id === partId);
    if (!part || !canTechnicianDeletePart(part)) return;

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

  // Guardar notas de un item del checklist
  const handleSaveCheckItemNotes = async () => {
    if (!editingCheckItemNotes) return;
    const updatedChecklist = checklist.map((item) =>
      item.id === editingCheckItemNotes.id ? { ...item, notes: checkItemNotes.trim() || undefined } : item,
    );
    setChecklist(updatedChecklist);
    try {
      await apiClient.patch(
        endpoints.orders,
        { id: order.id, checklist: JSON.stringify(updatedChecklist) },
        { showSuccess: false },
      );
    } catch (error) {
      setChecklistError(formatChecklistError(error));
    }
    setIsCheckItemNotesModalOpen(false);
    setEditingCheckItemNotes(null);
    setCheckItemNotes("");
  };

  // --- Entrega / Cancelación con comentario (usa DeliveryCommentModal) ---

  const openCommentModal = (status: string) => {
    if (status !== "delivered" && status !== "cancelled") return;
    setCommentTarget(status);
    setCloseOrderComment("");
  };

  const closeCommentModal = () => {
    setCommentTarget(null);
  };

  // Persiste el cambio de estado + comentario. Solo cierra el modal si el
  // PATCH es exitoso; en error permanece abierto.
  const handleCommentSave = async () => {
    if (!commentTarget || !closeOrderComment.trim()) return;

    setIsCommentSaving(true);
    try {
      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          status: commentTarget,
          withdrawal_comment: closeOrderComment,
        },
        {
          successMessage:
            commentTarget === "delivered" ? "Orden entregada exitosamente" : "Orden cancelada exitosamente",
        },
      );

      setStatus(commentTarget);
      setWithdrawalComment(closeOrderComment);
      closeCommentModal();
    } catch {
      // El error ya se muestra globalmente (apiClient)
    } finally {
      setIsCommentSaving(false);
    }
  };

  // approvalStatus es opcional (legacy/checkin, RF-10 interim); los repuestos
  // sin estado (undefined o desconocido) muestran el badge neutro "Ingresado"
  // en lugar del valor crudo (decisión 12).
  const getPartStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "accepted":
        return (
          <CustomBadge variant='success' dot>
            Aceptado
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
        // Sin approvalStatus (legacy/checkin) o valor desconocido → badge
        // neutro "Ingresado", sin color de estado (decisión 12).
        return <CustomBadge variant='neutral'>Ingresado</CustomBadge>;
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
    <div className='mx-auto max-w-4xl space-y-6 px-4 sm:px-6'>
      {/* Header
          Móvil (<850px, breakpoint wide): fila 1 [Volver] ... [Orden # + fecha],
          fila 2 badge clickeable (OrderStatusButton → modal).
          Desktop (≥850px): fila única [Volver] [Orden # + badge clickeable]. */}
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 wide:flex-nowrap'>
        <CustomButton variant='ghost' size='sm' leftIcon={<ArrowLeft className='h-4 w-4' />} onClick={onBack}>
          Volver
        </CustomButton>
        <div className='order-1 min-w-0 text-right wide:order-none wide:text-left'>
          <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>Orden #{order.id}</h1>
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
        <div className='mb-4 flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Car className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Datos del Vehículo</h2>
          </div>
          <button
            type='button'
            onClick={() => setIsVehicleExpanded(!isVehicleExpanded)}
            className='flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100'
            aria-label={isVehicleExpanded ? "Colapsar datos del vehículo" : "Expandir datos del vehículo"}
          >
            {isVehicleExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </button>
        </div>
        {isVehicleExpanded && (
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
        )}
      </CustomCard>

      {/* Datos del Cliente */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <User className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Datos del Cliente</h2>
          </div>
          <button
            type='button'
            onClick={() => setIsClientExpanded(!isClientExpanded)}
            className='flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100'
            aria-label={isClientExpanded ? "Colapsar datos del cliente" : "Expandir datos del cliente"}
          >
            {isClientExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </button>
        </div>
        {isClientExpanded && (
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
        )}
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
                className='space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
              >
                {/* Fila 1: criticidad + nombre + origen */}
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex min-w-0 items-start gap-2'>
                    {getCriticalityIcon(part.criticality)}
                    <p className='min-w-0 flex-1 truncate text-sm font-bold text-slate-800'>{part.name}</p>
                  </div>
                  {part.requestedByTechnician && (
                    <CustomBadge variant='info' className='shrink-0'>
                      Solicitud del técnico
                    </CustomBadge>
                  )}
                </div>

                {/* Fila 2: datos alineados en columnas — sin partir valores
                    a mitad de línea (el fallo del diseño previo).
                    RF: los precios COP no son visibles para técnicos. */}
                <div className='grid grid-cols-2 gap-2 rounded-lg bg-white px-3 py-2.5'>
                  <div>
                    <p className='text-[10px] font-semibold uppercase tracking-wide text-slate-400'>Cant.</p>
                    <p className='text-sm font-bold text-slate-800'>{part.quantity}</p>
                  </div>
                  <div>
                    <p className='text-[10px] font-semibold uppercase tracking-wide text-slate-400'>Criticidad</p>
                    <p className='text-sm font-bold text-slate-800'>
                      {part.criticality === 'critical' ? 'Crítica' : part.criticality === 'preventive' ? 'Preventiva' : 'General'}
                    </p>
                  </div>
                </div>

                {/* Fila 3: notas (solo si hay) */}
                {part.notes && (
                  <p className='text-xs italic text-slate-500'>&ldquo;{part.notes}&rdquo;</p>
                )}

                {/* Fila 4: estado a la izquierda, acciones a la derecha.
                    RF-13 — El técnico solo puede ELIMINAR sus propias
                    solicitudes no aprobadas; para el resto no se ofrece
                    botón (se oculta, no se deshabilita). */}
                <div className='flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5'>
                  {getPartStatusBadge(part.approvalStatus)}
                  {canTechnicianDeletePart(part) && (
                    <button
                      onClick={() => deletePart(part.id)}
                      className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                      title='Eliminar repuesto'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  )}
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

      {/* Desglose de precios (solo cuando la orden está entregada) */}
      {status === "delivered" && (
        <PriceBreakdown parts={parts} serviceItems={[]} />
      )}

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
                className={`flex items-start gap-3 rounded-xl border p-3.5 ${
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
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-1'>
                    {/* Prioridad arriba del título */}
                    {item.priority === "ALTA" && (
                      <CustomBadge variant='danger' dot>
                        Alta
                      </CustomBadge>
                    )}
                    {item.priority === "MEDIA" && (
                      <CustomBadge variant='warning' dot>
                        Media
                      </CustomBadge>
                    )}
                    {item.priority === "BAJA" && (
                      <CustomBadge variant='neutral' dot>
                        Baja
                      </CustomBadge>
                    )}
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      item.completed ? "text-emerald-700 line-through" : "text-slate-800"
                    }`}
                  >
                    {item.title}
                  </p>
                  {/* Notas como expandible debajo del título */}
                  {item.notes && item.notes.trim() !== "" && (
                    <div className='my-2 ml-6 text-sm text-slate-600 whitespace-pre-wrap border-l-2 border-slate-200 pl-3'>
                      {item.notes}
                    </div>
                  )}
                  {/* Botón para editar notas del item del checklist */}
                  <button
                    type='button'
                    onClick={() => {
                      setEditingCheckItemNotes({ id: item.id, title: item.title, notes: item.notes });
                      setCheckItemNotes(item.notes || "");
                      setIsCheckItemNotesModalOpen(true);
                    }}
                    className='mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 transition-colors'
                    title={item.notes ? "Ver/editar notas" : "Agregar notas"}
                  >
                    <MessageSquare className='h-3.5 w-3.5' />
                    <span>{item.notes ? "Editar Nota" : "Agregar notas"}</span>
                  </button>
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

      <EvidenceUploader orderId={order.id} allowedTypes={['work_progress']} />

      {/* Ver historial de cambios (solo admin; el mecánico no lo ve) */}
      {user?.role === "admin" && (
        <CustomButton
          variant='secondary'
          leftIcon={<Clock className='h-4 w-4' />}
          onClick={() => router.push(`/admin/order-log?orderId=${order.id}`)}
        >
          Ver Log de Cambios
        </CustomButton>
      )}

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
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Notas de ejecución (opcional)</label>
            <textarea
              value={newCheckItem.notes}
              onChange={(e) => setNewCheckItem((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder='Observaciones, detalles técnicos, hallazgos...'
              rows={3}
              className='input-field resize-none'
            />
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

      {/* Modal de confirmación de entrega/cancelación (con comentario) — componente separado */}
      <DeliveryCommentModal
        open={commentTarget !== null}
        onClose={closeCommentModal}
        onSave={handleCommentSave}
        isSaving={isCommentSaving}
        target={commentTarget as "delivered" | "cancelled"}
        commentValue={closeOrderComment}
        onCommentChange={setCloseOrderComment}
      />

      {/* Modal para editar notas del checklist item */}
      <CustomDialog
        open={isCheckItemNotesModalOpen}
        onClose={() => {
          setIsCheckItemNotesModalOpen(false);
          setEditingCheckItemNotes(null);
          setCheckItemNotes("");
        }}
        title={editingCheckItemNotes ? `Notas: ${editingCheckItemNotes.title}` : "Notas de ejecución"}
      >
        <div className='space-y-4'>
          <div className='text-sm text-slate-500'>
            <strong>Tarea:</strong> {editingCheckItemNotes?.title}
          </div>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Notas de ejecución</label>
            <textarea
              value={checkItemNotes}
              onChange={(e) => setCheckItemNotes(e.target.value)}
              placeholder='Observaciones, detalles técnicos, hallazgos...'
              rows={4}
              className='input-field resize-none'
            />
          </div>
          <div className='flex gap-3'>
            <CustomButton
              type='button'
              variant='secondary'
              className='flex-1'
              onClick={() => {
                setIsCheckItemNotesModalOpen(false);
                setEditingCheckItemNotes(null);
                setCheckItemNotes("");
              }}
            >
              Cancelar
            </CustomButton>
            <CustomButton className='flex-1' onClick={handleSaveCheckItemNotes}>
              Guardar
            </CustomButton>
          </div>
        </div>
      </CustomDialog>

      {/* Modal de error del guardado automático del checklist */}
      <CustomDialog
        open={!!checklistError}
        onClose={() => setChecklistError(null)}
        title='Error al guardar checklist'
        maxWidth='sm'
      >
        <div className='space-y-3'>
          <p className='text-sm text-slate-600'>No se pudo guardar el cambio en el checklist.</p>
          <p className='break-all whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600'>
            {checklistError}
          </p>
        </div>
      </CustomDialog>
    </div>
  );
}
