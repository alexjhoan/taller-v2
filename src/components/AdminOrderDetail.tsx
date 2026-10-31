import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  ArrowLeft,
  Save,
  X,
  Car,
  User,
  FileText,
  ClipboardList,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  MessageCircle,
  Mail,
  Pencil,
  Send,
  Wrench,
  Image,
  Clock,
  ChevronUp,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";

import { CustomInput } from "@/components/ui/CustomInput";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { NumericInput } from "@/components/ui/NumericInput";
import { OrderStatusButton } from "@/components/OrderStatusButton";
import { WorkOrder } from "@/hooks/useWorkOrders";
import { useUsers } from "@/hooks/useUsers";
import { toNumericId, toNumericIdArray } from "@/utils/ids";
import { assignFallbackPartIds, getPartActions, partNeedsPrice, serializeParts } from "@/utils/parts";
import { useApiClient } from "@/services/apiClient";
import { ApiError, endpoints } from "@/services/api";
import { formatCOP } from "@/utils/currency";
import { useUserContext } from "@/context/UserContext";
import { generateShortUid } from "@/utils/uid";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { EvidenceGallery } from "@/components/EvidenceGallery";

// --- Tipos ---

interface OrderFormData {
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  vehicle_details: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  failure_description: string;
  mileage: string;
  fuel_level: string;
  /** IDs de mecánicos asignados (puede ser varios) */
  assigned_user_id: number[];
}

interface PartItem {
  id: string;
  name: string;
  quantity: number;
  unit_price?: number;
  criticality: string;
  // Opcionales igual que en PartItem del hook: los repuestos legacy/checkin
  // no traen approvalStatus ni requestedByTechnician (RF-10 interim).
  approvalStatus?: string;
  requestedByTechnician?: boolean;
  notes?: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
  notes?: string; // Campo opcional para notas de ejecución
}

// Canal de contacto usado en el modal de confirmación de envío
type ContactChannel = "whatsapp" | "email";

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

// --- Componente ---

interface AdminOrderDetailProps {
  order: WorkOrder;
  onBack: () => void;
}

export function AdminOrderDetail({ order, onBack }: AdminOrderDetailProps) {
  const router = useRouter();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: users } = useUsers();
  const { user } = useUserContext();
  // La evidencia viene directamente en la orden (campo evidence)
  const evidence = order.evidence ?? [];
  const [formData, setFormData] = useState<OrderFormData | null>(null);
  const [originalData, setOriginalData] = useState<OrderFormData | null>(null);
  // T-14: el backend aún devuelve parts sin id (RF-10 pendiente) y TODAS las
  // acciones por repuesto comparan por p.id, así que sin id de respaldo un
  // solo clic borraría o editaría la lista entera. Se asigna UNA vez al
  // montar (inicializador diferido de useState) para que cada id sea
  // estable durante toda la sesión.
  const [parts, setParts] = useState<PartItem[]>(() =>
    assignFallbackPartIds(Array.isArray(order.parts) ? order.parts : [], generateShortUid),
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(Array.isArray(order.checklist) ? order.checklist : []);
  // Último error del guardado automático del checklist (se muestra en modal)
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<PartItem | null>(null);
  const [editingCheckItem, setEditingCheckItem] = useState<ChecklistItem | null>(null);
  const [newPart, setNewPart] = useState({ name: "", quantity: 1, notes: "", unit_price: 0 });
  // RF-3 — Paso de precio al aprobar: diálogo que se abre cuando el
  // repuesto a aprobar no tiene unit_price. `pricePartTarget` guarda el
  // repuesto original (pending o rejected); cancelar NO lo muta.
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [pricePartTarget, setPricePartTarget] = useState<PartItem | null>(null);
  const [pendingPriceValue, setPendingPriceValue] = useState<number>(0);
  const [newCheckItem, setNewCheckItem] = useState({
    title: "",
    category: "DIAGNOSTICO",
    priority: "MEDIA",
    notes: "",
  });
  const [contactConfirm, setContactConfirm] = useState<{
    channel: ContactChannel;
    message: string;
  } | null>(null);
  const [isMessageEditable, setIsMessageEditable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Modal de confirmación para Entregado / Cancelado (requiere comentario).
  // Mientras esté abierto, NO se persiste nada: solo Cancelar o Guardar.
  const [commentTarget, setCommentTarget] = useState<"delivered" | "cancelled" | null>(null);
  const [comment, setComment] = useState("");
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  // Comentario de entrega/cancelación: se sincroniza con la orden y se
  // actualiza localmente tras guardar para reflejarlo sin recargar la lista.
  const [withdrawalComment, setWithdrawalComment] = useState<string | null>(order.withdrawal_comment ?? null);

  // Estados para cards expandibles
  const [isVehicleExpanded, setIsVehicleExpanded] = useState(true);
  const [isClientExpanded, setIsClientExpanded] = useState(true);

  // Estado para modal de notas del checklist item
  const [editingCheckItemNotes, setEditingCheckItemNotes] = useState<ChecklistItem | null>(null);
  const [checkItemNotes, setCheckItemNotes] = useState("");
  const [isCheckItemNotesModalOpen, setIsCheckItemNotesModalOpen] = useState(false);

  // Items de servicio (mano de obra) — lista editable
  const [serviceItems, setServiceItems] = useState<
    Array<{
      id: string;
      description: string;
      price: number;
    }>
  >([]);

  useEffect(() => {
    const data: OrderFormData = {
      vehicle_plate: order.vehicle_plate,
      vehicle_make: order.vehicle_make,
      vehicle_model: order.vehicle_model,
      vehicle_year: order.vehicle_year.toString(),
      vehicle_color: (order as { vehicle_color?: string }).vehicle_color || "",
      vehicle_details: (order as { vehicle_details?: string }).vehicle_details || "",
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      status: order.status,
      failure_description: order.failure_description,
      mileage: order.mileage.toString(),
      fuel_level: order.fuel_level,
      // assigned_user_id puede venir como JSON string, array o FK legacy;
      // normalizar a number[] para trabajar con la lista de asignados.
      assigned_user_id: toNumericIdArray(order.assigned_user_id),
    };
    setFormData(data);
    setOriginalData(data);

    // Cargar items de servicio desde la orden
    // service_items puede venir como JSON string o como array
    const rawServiceItems = (order as { service_items?: string | Array<{ description: string; price: number }> })
      .service_items;
    let serviceItemsData: Array<{ description: string; price: number }> = [];
    if (Array.isArray(rawServiceItems)) {
      serviceItemsData = rawServiceItems;
    } else if (typeof rawServiceItems === "string" && rawServiceItems) {
      try {
        serviceItemsData = JSON.parse(rawServiceItems);
      } catch {
        serviceItemsData = [];
      }
    }
    setServiceItems(serviceItemsData.map((item) => ({ id: generateShortUid(), ...item })));
  }, [order]);

  // Mantener sincronizado el comentario mostrado con el prop de la orden.
  useEffect(() => {
    setWithdrawalComment(order.withdrawal_comment ?? null);
  }, [order]);

  const handleChange = (field: keyof OrderFormData, value: string | number | null) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: value });
  };

  // Alterna un mecánico en la lista de asignados: lo incluye si no está, lo quita si está.
  const toggleAssignedUser = (id: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      assigned_user_id: formData.assigned_user_id.includes(id)
        ? formData.assigned_user_id.filter((uid) => uid !== id)
        : [...formData.assigned_user_id, id],
    });
  };

  /**
   * Cambio de estado desde el botón del header: el botón hace PATCH
   * inmediato (OrderStatusButton) y aquí solo sincronizamos formData +
   * originalData para que Cancelar/Guardar no reviertan ni re-envíen un
   * estado ya persistido.
   */
  const handleStatusChange = (newStatus: string) => {
    handleChange("status", newStatus);
    if (originalData) {
      setOriginalData({ ...originalData, status: newStatus });
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
            commentTarget === "delivered" ? "Orden entregada exitosamente" : "Orden cancelada exitosamente",
        },
      );

      // Sincronizar el badge (formData) + el comentario mostrado y refrescar la lista.
      handleStatusChange(commentTarget);
      setWithdrawalComment(comment);
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      closeCommentModal();
    } catch {
      // El error ya se muestra globalmente (apiClient)
    } finally {
      setIsCommentSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalData) {
      setFormData(originalData);
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    setIsSaving(true);

    try {
      const payload = {
        id: order.id,
        vehicle_plate: formData.vehicle_plate,
        vehicle_make: formData.vehicle_make,
        vehicle_model: formData.vehicle_model,
        vehicle_year: parseInt(formData.vehicle_year, 10) || 0,
        vehicle_color: formData.vehicle_color,
        vehicle_details: formData.vehicle_details,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        status: formData.status,
        failure_description: formData.failure_description,
        mileage: parseInt(formData.mileage, 10) || 0,
        fuel_level: formData.fuel_level,
        parts: serializeParts(parts),
        checklist: JSON.stringify(checklist),
        // Asignación múltiple de mecánicos como JSON string (misma convención
        // que parts/service_items). Lista vacía → "[]" = sin asignar.
        assigned_user_id: JSON.stringify(formData.assigned_user_id),
        // Items de servicio (mano de obra) - array de objetos {description, price}
        service_items: JSON.stringify(
          serviceItems.map((item) => ({
            description: item.description,
            price: item.price,
          })),
        ),
        updated_by: JSON.stringify({
          id: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName,
          role: user?.role,
        }),
      };

      await apiClient.patch(endpoints.orders, payload, {
        successMessage: "Cambios guardados exitosamente",
      });

      setOriginalData(formData);
      // Invalidar la query para que la lista se actualice
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
    } catch (error) {
      // El error ya se muestra globalmente
    } finally {
      setIsSaving(false);
    }
  };

  // --- Part handlers ---

  /**
   * RF-12/D1 — Persistencia INMEDIATA de los repuestos: PATCH optimista
   * con rollback (mismo patrón que el auto-guardado del checklist y el
   * modal del técnico). `budget_accepted: 0` reinicia la aceptación del
   * cliente para que revise el estado actual de los repuestos.
   * El error ya lo muestra globalmente apiClient (`[ApiError STATUS] detalle`).
   */
  const persistParts = async (previousParts: PartItem[], updatedParts: PartItem[]) => {
    setParts(updatedParts); // optimista
    try {
      await apiClient.patch(
        endpoints.orders,
        {
          id: order.id,
          parts: serializeParts(updatedParts),
          budget_accepted: 0,
          updated_by: JSON.stringify({
            id: user?.id,
            firstName: user?.firstName,
            lastName: user?.lastName,
            role: user?.role,
          }),
        },
        { showSuccess: false },
      );
      // Invalidar la query para que la lista se actualice
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
    } catch {
      setParts(previousParts); // rollback (el error ya se muestra globalmente)
    }
  };

  const handleAddPart = async () => {
    if (!newPart.name.trim()) return;

    const newPartItem: PartItem = {
      id: generateShortUid(),
      name: newPart.name.trim(),
      quantity: newPart.quantity,
      unit_price: newPart.unit_price > 0 ? newPart.unit_price : undefined,
      criticality: "preventive",
      // RF-5/D8: los repuestos que agrega el admin se guardan YA aceptados.
      approvalStatus: "accepted",
      requestedByTechnician: false,
      notes: newPart.notes.trim() || undefined,
    };

    const updatedParts = [...parts, newPartItem];
    setNewPart({ name: "", quantity: 1, notes: "", unit_price: 0 });
    setIsPartModalOpen(false);
    await persistParts(parts, updatedParts);
  };

  const handleEditPart = (part: PartItem) => {
    setEditingPart(part);
    setNewPart({
      name: part.name,
      quantity: part.quantity,
      notes: part.notes || "",
      unit_price: part.unit_price ?? 0,
    });
    setIsPartModalOpen(true);
  };

  const handleUpdatePart = async () => {
    if (!editingPart || !newPart.name.trim()) return;

    const updatedParts = parts.map((p) =>
      p.id === editingPart.id
        ? {
            ...p,
            name: newPart.name.trim(),
            quantity: newPart.quantity,
            unit_price: newPart.unit_price > 0 ? newPart.unit_price : undefined,
            notes: newPart.notes.trim() || undefined,
          }
        : p,
    );

    setEditingPart(null);
    setNewPart({ name: "", quantity: 1, notes: "", unit_price: 0 });
    setIsPartModalOpen(false);
    await persistParts(parts, updatedParts);
  };

  const handleDeletePart = async (partId: string) => {
    await persistParts(
      parts,
      parts.filter((p) => p.id !== partId),
    );
  };

  /**
   * RF-4 — Confirmación de la aceptación: marca el repuesto como
   * `accepted` y persiste con el MISMO patrón que el resto de cambios
   * de repuestos (optimista + PATCH con `budget_accepted: 0` + rollback
   * vía `persistParts`). El repuesto NUNCA se elimina (trazabilidad,
   * decisión 3). Acepta un `unitPrice` opcional: si viene (paso de
   * precio de RF-3) lo guarda junto con el estado; si no, el repuesto
   * conserva su precio actual (caso en que ya tenía).
   */
  const confirmApprovePart = async (part: PartItem, unitPrice?: number) => {
    await persistParts(
      parts,
      parts.map((p) =>
        p.id === part.id
          ? {
              ...p,
              approvalStatus: "accepted",
              ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
            }
          : p,
      ),
    );
  };

  /**
   * RF-2/RF-3/RF-4 — Acepta un repuesto (Aceptar se muestra en `pending`
   * y `rejected`, según `getPartActions`). Si le falta `unit_price`
   * (0/null/undefined, `partNeedsPrice`) abre el diálogo de precio ANTES
   * de aceptar: el repuesto NO se muta hasta confirmar. Si ya tiene
   * precio, acepta directo sin diálogo.
   */
  const handleApprovePart = async (part: PartItem) => {
    if (partNeedsPrice(part)) {
      // Abrir diálogo de precio sin mutar nada: el repuesto queda en su
      // estado original hasta confirmar (RF-3).
      setPricePartTarget(part);
      setPendingPriceValue(0);
      setIsPriceModalOpen(true);
      return;
    }
    await confirmApprovePart(part);
  };

  // Cierra el diálogo de precio SIN mutar el repuesto (RF-4): cancelar
  // deja el ESTADO ORIGINAL (pending sigue pending; rejected sigue
  // rejected) y nunca convierte un rejected en pending.
  const closePriceModal = () => {
    setIsPriceModalOpen(false);
    setPricePartTarget(null);
    setPendingPriceValue(0);
  };

  // Confirma el diálogo de precio: acepta con el precio introducido
  // reutilizando confirmApprovePart/persistParts (sin duplicar lógica
  // de persistencia). Precio 0 o vacío no acepta (botón deshabilitado
  // + guardia aquí, RF-3).
  const handleConfirmPrice = async () => {
    if (!pricePartTarget || pendingPriceValue <= 0) return;
    const target = pricePartTarget;
    closePriceModal();
    await confirmApprovePart(target, pendingPriceValue);
  };

  /**
   * RF-2/RF-4 — Rechaza un repuesto (Rechazar se muestra en `pending` y
   * `accepted`): lo marca `rejected` y persiste igual que la aceptación.
   * El repuesto se CONSERVA en la orden (trazabilidad, decisión 3); el
   * admin puede deshacerlo con Aceptar o eliminarlo manualmente.
   */
  const handleRejectPart = async (part: PartItem) => {
    await persistParts(
      parts,
      parts.map((p) => (p.id === part.id ? { ...p, approvalStatus: "rejected" } : p)),
    );
  };

  // --- Checklist handlers ---

  const handleAddCheckItem = async () => {
    if (!newCheckItem.title.trim()) return;

    const newItem: ChecklistItem = {
      id: generateShortUid(),
      title: newCheckItem.title.trim(),
      category: newCheckItem.category,
      priority: newCheckItem.priority,
      completed: false,
      notes: newCheckItem.notes?.trim() || undefined,
    };

    setChecklist([...checklist, newItem]);
    setNewCheckItem({ title: "", category: "DIAGNOSTICO", priority: "MEDIA", notes: "" });
    setIsChecklistModalOpen(false);
  };

  const handleEditCheckItem = (item: ChecklistItem) => {
    setEditingCheckItem(item);
    setNewCheckItem({
      title: item.title,
      category: item.category,
      priority: item.priority,
      notes: item.notes || "",
    });
    setIsChecklistModalOpen(true);
  };

  const handleUpdateCheckItem = async () => {
    if (!editingCheckItem || !newCheckItem.title.trim()) return;

    const updatedChecklist = checklist.map((item) =>
      item.id === editingCheckItem.id
        ? {
            ...item,
            title: newCheckItem.title.trim(),
            category: newCheckItem.category,
            priority: newCheckItem.priority,
            notes: newCheckItem.notes?.trim() || undefined,
          }
        : item,
    );

    setChecklist(updatedChecklist);
    setEditingCheckItem(null);
    setNewCheckItem({ title: "", category: "DIAGNOSTICO", priority: "MEDIA", notes: "" });
    setIsChecklistModalOpen(false);
  };

  // Guardado automático: el toggle persiste el checklist completo en el
  // backend (PATCH optimista con rollback y modal de error si falla).
  const toggleCheckItem = async (itemId: string) => {
    const updatedChecklist = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    const previous = checklist;
    setChecklist(updatedChecklist); // optimista
    try {
      await apiClient.patch(
        endpoints.orders,
        { id: order.id, checklist: JSON.stringify(updatedChecklist) },
        { showSuccess: false },
      );
    } catch (error) {
      setChecklist(previous); // rollback
      setChecklistError(formatChecklistError(error));
    }
  };

  const handleDeleteCheckItem = (itemId: string) => {
    setChecklist(checklist.filter((item) => item.id !== itemId));
  };

  // Handler para guardar notas del checklist item
  const handleSaveCheckItemNotes = async () => {
    if (!editingCheckItemNotes) return;
    const updatedChecklist = checklist.map((item) =>
      item.id === editingCheckItemNotes.id ? { ...item, notes: checkItemNotes.trim() || undefined } : item,
    );
    setChecklist(updatedChecklist);
    // Persistir igual que toggleCheckItem
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

  // --- Contact handlers ---

  const portalUrl = `${process.env.NEXT_PUBLIC_PORTAL_URL || (typeof window !== "undefined" ? window.location.origin : "")}/portal?token=${order.public_token}`;

  const buildWhatsAppMessage = () =>
    `Hola ${order.customer_name}, te escribimos del taller Mecaflow. Para revisar tu orden, presupuesto y progreso de tu vehículo visita este link: ${portalUrl}`;

  const buildEmailMessage = () =>
    `Hola ${order.customer_name},\n\nTe escribimos del taller Mecaflow sobre tu orden #${order.id}.\n\nPara revisar tu orden, presupuesto y progreso de tu vehículo visita este link: ${portalUrl}`;

  const handleWhatsAppClick = (message: string) => {
    // Convertir formato local a internacional: 04121234567 → 584121234567
    let phone = order.customer_phone.replace(/\D/g, "");
    // Si empieza con 0, reemplazar por 58 (código de Venezuela)
    if (phone.startsWith("0")) {
      phone = "58" + phone.substring(1);
    }
    // Si empieza con 58, está bien; si no y tiene 11 dígitos, agregar 58
    else if (!phone.startsWith("58") && phone.length === 11) {
      phone = "58" + phone;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleSendEmail = (message: string) => {
    // TODO: Implementar llamada al endpoint POST /api/orders/{id}/send-email
    // `message` es el cuerpo del correo (editable en el modal de confirmación)
    void message;
    enqueueSnackbar("Correo enviado", { variant: "success" });
  };

  // Abre el modal de confirmación con el mensaje exacto a enviar
  const openContactConfirm = (channel: ContactChannel) => {
    const message = channel === "whatsapp" ? buildWhatsAppMessage() : buildEmailMessage();
    setContactConfirm({ channel, message });
    setIsMessageEditable(false);
  };

  const closeContactConfirm = () => {
    setContactConfirm(null);
    setIsMessageEditable(false);
  };

  // Confirma el envío usando el mensaje actual (editado o original)
  const handleConfirmSend = () => {
    if (!contactConfirm) return;
    if (contactConfirm.channel === "whatsapp") {
      handleWhatsAppClick(contactConfirm.message);
    } else {
      handleSendEmail(contactConfirm.message);
    }
    closeContactConfirm();
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

  if (!formData) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='animate-pulse text-sm text-slate-400'>Cargando orden...</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header
          Móvil (<850px, breakpoint wide): fila 1 [Volver] ... [Orden # + fecha],
          fila 2 badge clickeable (OrderStatusButton → modal), fila 3 acciones.
          Desktop (≥850px): fila única [Volver] [Orden # + badge clickeable] ... [Editar]. */}
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 wide:flex-nowrap'>
        <CustomButton variant='ghost' size='sm' leftIcon={<ArrowLeft className='h-4 w-4' />} onClick={onBack}>
          Volver
        </CustomButton>
        <div className='order-1 min-w-0 text-right wide:order-none wide:text-left'>
          <div className='flex items-center justify-end gap-2 wide:justify-start'>
            <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>Orden #{order.id}</h1>
          </div>
          <p className='text-sm text-slate-500'>Creada: {new Date(order.created_at).toLocaleDateString("es-CO")}</p>
        </div>
        {/* Estado: SIEMPRE editable con PATCH inmediato (no depende del modo edición).
            Badge clickeable con lápiz que abre el modal de opciones. */}
        <div className='order-2 flex w-full min-w-0 items-center justify-end gap-2 wide:order-none wide:ml-auto wide:w-auto'>
          <OrderStatusButton
            orderId={order.id}
            currentStatus={formData.status}
            onStatusChange={handleStatusChange}
            onStatusWithComment={openCommentModal}
          />
        </div>
        <div className='order-3 flex w-full items-center justify-start gap-2 wide:order-none wide:w-auto'>
          {!isEditing ? (
            <CustomButton
              variant='secondary'
              size='sm'
              rightIcon={<Pencil className='h-3.5 w-3.5' />}
              onClick={() => setIsEditing(true)}
            >
              Editar
            </CustomButton>
          ) : (
            <>
              <CustomButton
                variant='secondary'
                size='sm'
                leftIcon={<X className='h-3.5 w-3.5' />}
                onClick={() => {
                  handleCancel();
                  setIsEditing(false);
                }}
              >
                Cancelar
              </CustomButton>
              <CustomButton
                size='sm'
                leftIcon={<Save className='h-3.5 w-3.5' />}
                onClick={handleSave}
                isLoading={isSaving}
              >
                Guardar
              </CustomButton>
            </>
          )}
        </div>
      </div>

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Car className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Datos del Vehículo</h2>
          </div>
          <button
            type='button'
            onClick={() => setIsVehicleExpanded(!isVehicleExpanded)}
            className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600'
            aria-label={isVehicleExpanded ? "Colapsar vehículo" : "Expandir vehículo"}
          >
            {isVehicleExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </button>
        </div>
        {isVehicleExpanded && (
          <div className='pb-4'>
            <CustomInput
              label='Placa'
              value={formData.vehicle_plate}
              onChange={(e) => handleChange("vehicle_plate", e.target.value)}
              disabled={!isEditing}
            />
          </div>
        )}
        {isVehicleExpanded && (
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
            <CustomInput
              label='Marca'
              value={formData.vehicle_make}
              onChange={(e) => handleChange("vehicle_make", e.target.value)}
              disabled={!isEditing}
            />
            <CustomInput
              label='Modelo'
              value={formData.vehicle_model}
              onChange={(e) => handleChange("vehicle_model", e.target.value)}
              disabled={!isEditing}
            />
            <CustomInput
              label='Año'
              type='number'
              value={formData.vehicle_year}
              onChange={(e) => handleChange("vehicle_year", e.target.value)}
              disabled={!isEditing}
            />
            <CustomInput
              label='Color'
              value={formData.vehicle_color}
              onChange={(e) => handleChange("vehicle_color", e.target.value)}
              disabled={!isEditing}
            />
            <CustomInput
              label='Odómetro (km)'
              type='number'
              value={formData.mileage}
              onChange={(e) => handleChange("mileage", e.target.value)}
              disabled={!isEditing}
            />
            <div>
              <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Combustible</label>
              <select
                value={formData.fuel_level}
                onChange={(e) => handleChange("fuel_level", e.target.value)}
                className='input-field'
                disabled={!isEditing}
              >
                <option value='E'>Vacío (E)</option>
                <option value='1/4'>1/4</option>
                <option value='1/2'>1/2</option>
                <option value='3/4'>3/4</option>
                <option value='F'>Lleno (F)</option>
              </select>
            </div>
          </div>
        )}
        {isVehicleExpanded && (
          <div className='pt-4'>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Detalles del Vehículo</label>
            <textarea
              value={formData.vehicle_details || ""}
              onChange={(e) => handleChange("vehicle_details", e.target.value)}
              rows={3}
              className='input-field resize-none'
              placeholder='Color, accesorios, daños visibles, características especiales...'
              disabled={!isEditing}
            />
          </div>
        )}
      </CustomCard>

      {/* Datos del Cliente */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <User className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Datos del Cliente</h2>
          </div>
          <button
            type='button'
            onClick={() => setIsClientExpanded(!isClientExpanded)}
            className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600'
            aria-label={isClientExpanded ? "Colapsar cliente" : "Expandir cliente"}
          >
            {isClientExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </button>
        </div>
        {isClientExpanded && (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <CustomInput
              label='Nombre'
              value={formData.customer_name}
              onChange={(e) => handleChange("customer_name", e.target.value)}
              disabled={!isEditing}
            />
            <CustomInput
              label='Teléfono'
              value={formData.customer_phone}
              onChange={(e) => handleChange("customer_phone", e.target.value)}
              disabled={!isEditing}
            />
            <CustomInput
              label='Email'
              type='email'
              value={formData.customer_email}
              onChange={(e) => handleChange("customer_email", e.target.value)}
              disabled={!isEditing}
            />
          </div>
        )}
      </CustomCard>

      {/* Datos de la Orden */}
      <CustomCard>
        <div className='mb-4 flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <FileText className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Datos de la Orden</h2>
        </div>
        <div className='space-y-4'>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Descripción de la Falla</label>
            <textarea
              value={formData.failure_description}
              onChange={(e) => handleChange("failure_description", e.target.value)}
              rows={3}
              className='input-field resize-none'
            />
          </div>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Asignar a</label>
            {(users || []).filter((u) => u.active).length === 0 ? (
              <p className='rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400'>
                No hay usuarios disponibles
              </p>
            ) : (
              <div className='flex flex-col gap-2'>
                {(users || [])
                  .filter((u) => u.active)
                  .map((u) => {
                    // El backend puede devolver u.id como string ("3"); se
                    // normaliza a number para que includes()/toggleAssignedUser
                    // comparen bien ("3" !== 3 rompería el checked y el payload).
                    const userId = toNumericId(u.id);
                    if (userId === null) return null;
                    return (
                      <label
                        key={userId}
                        className='flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300'
                      >
                        <input
                          type='checkbox'
                          checked={formData.assigned_user_id.includes(userId)}
                          onChange={() => toggleAssignedUser(userId)}
                          className='h-4 w-4 rounded border-slate-300'
                        />
                        <span className='text-sm text-slate-700'>
                          {u.first_name} {u.last_name} ({u.role === "admin" ? "Admin" : "Mecánico"})
                        </span>
                      </label>
                    );
                  })}
              </div>
            )}
            <p className='mt-1.5 text-xs text-slate-400'>Opcional — quiénes se encargan de esta orden</p>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-xs font-medium text-slate-400'>Fecha de inicio</p>
              <p className='text-sm font-bold text-slate-800'>
                {order.started_at ? new Date(order.started_at).toLocaleDateString("es-CO") : "—"}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-slate-400'>Fecha de finalización</p>
              <p className='text-sm font-bold text-slate-800'>
                {order.finished_at ? new Date(order.finished_at).toLocaleDateString("es-CO") : "—"}
              </p>
            </div>
          </div>
        </div>
      </CustomCard>

      {/* Servicio (mano de obra) - EDITABLE */}
      <CustomCard>
        <div className='mb-4 flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <Wrench className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Servicios (Mano de obra)</h2>
        </div>

        {serviceItems.length === 0 ? (
          <div className='text-center py-8'>
            <p className='text-sm text-slate-400 mb-4'>No hay servicios agregados</p>
            <CustomButton
              size='sm'
              leftIcon={<Plus className='h-3.5 w-3.5' />}
              onClick={() => setServiceItems([...serviceItems, { id: generateShortUid(), description: "", price: 0 }])}
            >
              Agregar servicio
            </CustomButton>
          </div>
        ) : (
          <>
            <div className='space-y-3'>
              {serviceItems.map((item, index) => (
                <div
                  key={item.id}
                  className='flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
                >
                  {/* Descripción del servicio (izquierda; en móvil toma el ancho completo) */}
                  <div className='min-w-0 flex-1 basis-full sm:basis-auto'>
                    <CustomInput
                      label={`Servicio ${index + 1}`}
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...serviceItems];
                        updated[index] = { ...updated[index], description: e.target.value };
                        setServiceItems(updated);
                      }}
                      placeholder='Ej: Cambio de aceite y filtro'
                    />
                  </div>
                  {/* Monto individual al FINAL de la fila (derecha) */}
                  <div className='flex justify-end'>
                    <NumericInput
                      label='Precio (COP)'
                      value={item.price}
                      onChange={(_, numericValue) => {
                        const updated = [...serviceItems];
                        updated[index] = { ...updated[index], price: numericValue || 0 };
                        setServiceItems(updated);
                      }}
                      placeholder='0'
                      isCurrency={true}
                      allowDecimal={true}
                      min={0}
                    />
                    <CustomButton
                      variant='ghost'
                      size='sm'
                      onClick={() => setServiceItems(serviceItems.filter((_, i) => i !== index))}
                      className='pt-8 text-red-500 hover:bg-red-50'
                    >
                      <Trash2 className='h-4 w-4' />
                    </CustomButton>
                  </div>
                </div>
              ))}
            </div>
            <div className='flex items-center justify-end gap-4 pt-4 border-t border-slate-100'>
              <CustomButton
                size='sm'
                leftIcon={<Plus className='h-3.5 w-3.5' />}
                onClick={() =>
                  setServiceItems([...serviceItems, { id: generateShortUid(), description: "", price: 0 }])
                }
              >
                Agregar servicio
              </CustomButton>
              <div className='text-right'>
                <p className='text-xs font-medium text-slate-400'>Total mano de obra</p>
                <p className='text-xl font-extrabold text-brand-600'>
                  {formatCOP(serviceItems.reduce((sum, item) => sum + item.price, 0))}
                </p>
              </div>
            </div>
          </>
        )}
      </CustomCard>

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
            onClick={() => {
              setEditingPart(null);
              setNewPart({ name: "", quantity: 1, notes: "", unit_price: 0 });
              setIsPartModalOpen(true);
            }}
          >
            Agregar
          </CustomButton>
        </div>

        <div className='space-y-3'>
          {parts.length === 0 ? (
            <p className='text-sm text-slate-400'>No hay repuestos solicitados</p>
          ) : (
            parts.map((part) => {
              // RF-2 — Esquema de botones por estado delegado en el helper
              // `getPartActions`: pending → Aceptar+Rechazar; accepted → solo
              // Rechazar (deshacer); rejected → solo Aceptar (deshacer); sin
              // approvalStatus (legacy/checkin) → ninguno. Editar/Eliminar
              // siempre visibles, en cualquier estado.
              const { canApprove, canReject } = getPartActions(part.approvalStatus);
              return (
                <div
                  key={part.id}
                  className='flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
                >
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-bold text-slate-800 truncate'>{part.name}</p>
                    <p className='mt-0.5 text-xs font-medium text-slate-400'>
                      Cant: {part.quantity}
                      {part.unit_price != null && (
                        <span className='ml-2 text-brand-600 font-semibold'>
                          · {formatCOP(part.unit_price)} c/u · Total: {formatCOP(part.quantity * part.unit_price)}
                        </span>
                      )}
                    </p>
                    {part.notes && <p className='mt-2 text-xs italic text-slate-500'>&ldquo;{part.notes}&rdquo;</p>}
                  </div>
                  <div className='flex flex-wrap items-center justify-end gap-2'>
                    {getPartStatusBadge(part.approvalStatus)}
                    {/* RF-9 — Origen del repuesto: etiqueta junto al badge de
                        estado solo cuando lo solicitó el técnico; los
                        repuestos del admin/checkin no la muestran. */}
                    {part.requestedByTechnician && <CustomBadge variant='info'>Solicitud del técnico</CustomBadge>}
                    {canApprove && (
                      <CustomButton
                        type='button'
                        size='sm'
                        variant='secondary'
                        leftIcon={<CheckCircle2 className='h-3.5 w-3.5' />}
                        onClick={() => handleApprovePart(part)}
                      >
                        Aceptar
                      </CustomButton>
                    )}
                    {canReject && (
                      <CustomButton
                        type='button'
                        size='sm'
                        variant='danger'
                        leftIcon={<X className='h-3.5 w-3.5' />}
                        onClick={() => handleRejectPart(part)}
                      >
                        Rechazar
                      </CustomButton>
                    )}
                    <button
                      onClick={() => handleEditPart(part)}
                      className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600'
                      title='Editar repuesto'
                    >
                      <FileText className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => handleDeletePart(part.id)}
                      className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                      title='Eliminar repuesto'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CustomCard>

      {/* Checklist de Trabajos - EDITABLE */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <ClipboardList className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Checklist de Trabajos</h2>
          </div>
          <CustomButton
            type='button'
            size='sm'
            leftIcon={<Plus className='h-3 w-3' />}
            onClick={() => {
              setEditingCheckItem(null);
              setNewCheckItem({ title: "", category: "DIAGNOSTICO", priority: "MEDIA", notes: "" });
              setIsChecklistModalOpen(true);
            }}
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
                  onClick={() => toggleCheckItem(item.id)}
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
                      setEditingCheckItemNotes(item);
                      setCheckItemNotes(item.notes || "");
                      setIsCheckItemNotesModalOpen(true);
                    }}
                    className='mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 transition-colors'
                    title={item.notes ? "Ver/editar notas" : "Agregar notas"}
                  >
                    <MessageSquare className='h-3.5 w-3.5' />
                    <span>{item.notes ? "Editar Nota" : "Agregar notas"}</span>
                  </button>
                </div>
                <button
                  onClick={() => handleEditCheckItem(item)}
                  className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600'
                  title='Editar item'
                >
                  <FileText className='h-4 w-4' />
                </button>
                <button
                  onClick={() => handleDeleteCheckItem(item.id)}
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

      {/* Cargar Evidencias */}
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

      <EvidenceUploader orderId={order.id} allowedTypes={['work_progress', 'final']} />

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

      {/* Botones de contacto (WhatsApp / Correo) */}
      <div className='flex flex-col gap-3 sm:flex-row'>
        <CustomButton
          type='button'
          size='md'
          className='flex-1 !bg-green-500 !text-white hover:!bg-green-600 shadow-sm'
          leftIcon={<MessageCircle className='h-4 w-4' />}
          onClick={() => openContactConfirm("whatsapp")}
        >
          WhatsApp
        </CustomButton>
        <CustomButton
          type='button'
          size='md'
          className='flex-1 !bg-blue-500 !text-white hover:!bg-blue-600 shadow-sm'
          leftIcon={<Mail className='h-4 w-4' />}
          onClick={() => openContactConfirm("email")}
        >
          Enviar Correo
        </CustomButton>
      </div>

      {/* Botones de acción */}
      <div className='flex gap-3'>
        <CustomButton
          variant='secondary'
          className='flex-1'
          leftIcon={<X className='h-4 w-4' />}
          onClick={handleCancel}
        >
          Cancelar
        </CustomButton>
        <CustomButton
          className='flex-1'
          leftIcon={<Save className='h-4 w-4' />}
          onClick={handleSave}
          isLoading={isSaving}
        >
          Guardar Cambios
        </CustomButton>
      </div>

      {/* Ver historial de cambios */}
      <CustomButton
        variant='secondary'
        leftIcon={<Clock className='h-4 w-4' />}
        onClick={() => {
          router.push(`/admin/order-log?orderId=${order.id}`);
        }}
      >
        Ver Log de Cambios
      </CustomButton>

      {/* Modal de repuesto */}
      <CustomDialog
        open={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        title={editingPart ? "Editar Repuesto" : "Agregar Repuesto"}
      >
        <div className='space-y-4'>
          <CustomInput
            label='Nombre del repuesto'
            value={newPart.name}
            onChange={(e) => setNewPart((prev) => ({ ...prev, name: e.target.value }))}
            placeholder='Ej: Pastillas de freno'
            required
          />
          <div className='grid grid-cols-2 gap-3'>
            <NumericInput
              label='Cantidad'
              value={newPart.quantity}
              min={1}
              onChange={(_, numericValue) =>
                setNewPart((prev) => ({
                  ...prev,
                  quantity: numericValue ?? 1,
                }))
              }
            />
            <NumericInput
              label='Precio unitario'
              value={newPart.unit_price}
              min={0}
              isCurrency={true}
              allowDecimal={true}
              placeholder='0'
              onChange={(_, numericValue) =>
                setNewPart((prev) => ({
                  ...prev,
                  unit_price: numericValue ?? 0,
                }))
              }
            />
          </div>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Notas</label>
            <textarea
              value={newPart.notes}
              onChange={(e) => setNewPart((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder='Notas adicionales...'
              rows={3}
              className='input-field resize-none'
            />
          </div>
          <div className='flex gap-3'>
            <CustomButton
              type='button'
              variant='secondary'
              className='flex-1'
              onClick={() => setIsPartModalOpen(false)}
            >
              Cancelar
            </CustomButton>
            <CustomButton className='flex-1' onClick={editingPart ? handleUpdatePart : handleAddPart}>
              {editingPart ? "Actualizar" : "Agregar"}
            </CustomButton>
          </div>
        </div>
      </CustomDialog>

      {/* Modal de precio unitario al aceptar (RF-3): se abre solo si el
          repuesto no tiene unit_price. Cancelar (o cerrar) NO muta nada:
          el repuesto queda en su estado original (RF-4). */}
      <CustomDialog open={isPriceModalOpen} onClose={closePriceModal} title='Aceptar Repuesto'>
        <div className='space-y-4'>
          <div className='rounded-lg border border-slate-100 bg-slate-50 p-3.5'>
            <p className='text-sm font-bold text-slate-800 truncate'>{pricePartTarget?.name}</p>
            <p className='mt-0.5 text-xs font-medium text-slate-400'>Cant: {pricePartTarget?.quantity}</p>
          </div>
          <p className='text-sm text-slate-600'>
            Ingresa el precio unitario para aceptar este repuesto (es necesario para el total del presupuesto):
          </p>
          <NumericInput
            label='Precio unitario'
            value={pendingPriceValue}
            min={0}
            isCurrency={true}
            allowDecimal={true}
            placeholder='0'
            onChange={(_, numericValue) => setPendingPriceValue(numericValue ?? 0)}
          />
          <div className='flex gap-3'>
            <CustomButton type='button' variant='secondary' className='flex-1' onClick={closePriceModal}>
              Cancelar
            </CustomButton>
            <CustomButton
              type='button'
              className='flex-1'
              leftIcon={<CheckCircle2 className='h-4 w-4' />}
              onClick={handleConfirmPrice}
              disabled={pendingPriceValue <= 0}
            >
              Aceptar
            </CustomButton>
          </div>
        </div>
      </CustomDialog>

      {/* Modal de checklist */}
      <CustomDialog
        open={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        title={editingCheckItem ? "Editar Item" : "Agregar Item al Checklist"}
      >
        <div className='space-y-4'>
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
            <CustomButton className='flex-1' onClick={editingCheckItem ? handleUpdateCheckItem : handleAddCheckItem}>
              {editingCheckItem ? "Actualizar" : "Agregar"}
            </CustomButton>
          </div>
        </div>
      </CustomDialog>

      {/* Modal de confirmación de envío (WhatsApp / Correo) */}
      <CustomDialog
        open={contactConfirm !== null}
        onClose={closeContactConfirm}
        title={contactConfirm?.channel === "whatsapp" ? "Confirmar envío por WhatsApp" : "Confirmar envío por correo"}
        maxWidth='lg'
      >
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <label className='block text-sm font-semibold text-slate-700'>Mensaje</label>
            <CustomButton
              type='button'
              variant='secondary'
              size='sm'
              leftIcon={<Pencil className='h-3.5 w-3.5' />}
              onClick={() => setIsMessageEditable((prev) => !prev)}
            >
              {isMessageEditable ? "Bloquear" : "Editar"}
            </CustomButton>
          </div>
          <textarea
            value={contactConfirm?.message ?? ""}
            onChange={(e) => setContactConfirm((prev) => (prev ? { ...prev, message: e.target.value } : prev))}
            readOnly={!isMessageEditable}
            rows={6}
            className={`input-field resize-none ${isMessageEditable ? "" : "bg-slate-50 cursor-not-allowed"}`}
            placeholder='Mensaje que se enviará...'
          />
          <div className='flex gap-3'>
            <CustomButton type='button' variant='secondary' className='flex-1' onClick={closeContactConfirm}>
              Cancelar
            </CustomButton>
            <CustomButton
              type='button'
              className='flex-1'
              leftIcon={<Send className='h-4 w-4' />}
              onClick={handleConfirmSend}
            >
              Enviar
            </CustomButton>
          </div>
        </div>
      </CustomDialog>

      {/* Modal de confirmación de entrega/cancelación (con comentario) */}
      <CustomDialog
        open={commentTarget !== null}
        onClose={closeCommentModal}
        title={commentTarget === "delivered" ? "Confirmar entrega" : "Confirmar cancelación"}
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
                commentTarget === "delivered"
                  ? "Ej: Vehículo retirado por el cliente. Se explicaron las reparaciones realizadas."
                  : "Ej: El cliente canceló el servicio por motivos personales."
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

      {/* Modal de notas de ejecución del checklist item */}
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
