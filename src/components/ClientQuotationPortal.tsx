import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  XCircle,
  MessageCircle,
  Clock,
  Wrench,
  Camera,
  FileText,
  AlertCircle,
  Loader2,
  Car,
  User,
  Gauge,
  Fuel,
  ClipboardList,
  Package,
} from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
import { StatusSlider } from "@/components/StatusSlider";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { EvidenceGallery } from "@/components/EvidenceGallery";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { formatCOP } from "@/utils/currency";
import { api, endpoints } from "@/services/api";

// --- Tipos ---

type OrderStatus =
  | "received"
  | "diagnosing"
  | "awaiting_approval"
  | "approved"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

type CustomerDecision = "pending" | "accepted" | "rejected";

interface BudgetItem {
  id: number;
  type: "labor" | "part";
  description: string;
  quantity: string;
  unit_price: string;
  customer_decision: CustomerDecision;
}

interface Evidence {
  id: number;
  type: string;
  file_url: string;
  created_at: string;
}

type EvidenceItem = string | Evidence;

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
}

interface ServiceItem {
  id: string;
  description: string;
  price: number;
}

interface OrderPartItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  criticality?: string;
  approvalStatus?: string;
  requestedByTechnician?: boolean;
  notes?: string;
}

interface OrderData {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string | null;
  vehicle_details: string | null;
  mileage: number;
  fuel_level: string;
  failure_description: string;
  assigned_user_id: number | null;
  status: OrderStatus;
  budget_accepted: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  checklist?: ChecklistItem[] | string;
  parts?: string;
  service_items?: string;
}

interface PublicOrderResponse {
  order: OrderData;
  evidence: EvidenceItem[];
  budget: BudgetItem[];
}

// --- Constantes ---

const STEPS = [
  { label: "Recepción", description: "Vehículo recibido" },
  { label: "Diagnóstico", description: "Inspección inicial" },
  { label: "Esperando aprobación", description: "Esperando aprobación" },
  { label: "Presupuesto aprobado", description: "Presupuesto aprobado" },
  { label: "En taller", description: "Reparación en proceso" },
  { label: "Finalizado", description: "Terminado" },
  { label: "Entregado", description: "Listo para retirar" },
  { label: "Cancelado", description: "Orden cancelada" },
];

// --- Componente ---

interface ClientQuotationPortalProps {
  token: string;
}

export function ClientQuotationPortal({ token }: ClientQuotationPortalProps) {
  const { buildPartInquiryUrl, buildWhatsAppUrl } = useWhatsApp();
  const [decisions, setDecisions] = useState<Record<string, CustomerDecision>>({});
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["publicOrder", token],
    queryFn: async () => {
      const response = await api.get<{ status: number; body: PublicOrderResponse; statusText: string }>(
        endpoints.publicOrder(token),
      );
      return response.body;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const order = data?.order;
  const budget = data?.budget || [];
  const rawEvidence = data?.evidence || [];
  // La evidencia puede venir como strings (URLs) o como objetos con file_url
  const evidence = rawEvidence.map((e) => (typeof e === "string" ? e : e.file_url));

  const checklist = useMemo(() => {
    if (!order?.checklist) return [];
    if (Array.isArray(order.checklist)) return order.checklist;
    try {
      return JSON.parse(order.checklist);
    } catch {
      return [];
    }
  }, [order?.checklist]);

  const serviceItems = useMemo((): ServiceItem[] => {
    if (!order?.service_items) return [];
    try {
      return JSON.parse(order.service_items);
    } catch {
      return [];
    }
  }, [order?.service_items]);

  // Parse order.parts (JSON string from backend) y asignar IDs únicos estables
  const orderParts = useMemo(() => {
    if (!order?.parts) return [];
    try {
      const parsed = JSON.parse(order.parts);
      return parsed.map((item: OrderPartItem, index: number) => ({
        ...item,
        // Generar ID único estable basado en nombre, cantidad e índice
        // Esto evita colisiones si hay items con mismo nombre
        id: item.id ?? `part-${index}-${item.name?.replace(/\s+/g, "-")}-${item.quantity}-${item.unit_price}`,
      }));
    } catch {
      return [];
    }
  }, [order?.parts]);

  const progress = useMemo(() => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter((item: ChecklistItem) => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  const getCurrentStep = (status: OrderStatus): number => {
    const stepMap: Record<OrderStatus, number> = {
      received: 0, // Recepción
      diagnosing: 1, // Diagnóstico
      awaiting_approval: 2, // Esperando aprobación (no se muestra en stepper)
      approved: 3, // Aprobado (no se muestra en stepper)
      in_progress: 4, // En taller (step 2 en 0-index = 3er paso visual)
      ready: 5, // Listo (no se muestra en stepper)
      delivered: 6, // Entregado = Entrega (step 3 en 0-index = 4to paso visual)
      cancelled: 7, // Cancelado → Recepción
    };
    return stepMap[status] ?? 0;
  };

  // Calculate totals from orderParts and serviceItems (since budget comes empty)
  const {
    subtotal,
    total,
    approvedCount,
    rejectedCount,
    partsTotal,
    laborTotal,
    approvedPartsTotal,
    approvedLaborTotal,
  } = useMemo(() => {
    // Parts from order.parts
    const partsItems: OrderPartItem[] = orderParts || [];
    const partsTotal = partsItems.reduce(
      (sum: number, item: OrderPartItem) => sum + (item.unit_price || 0) * (item.quantity || 0),
      0,
    );
    // Si el presupuesto ya fue aceptado, todas las partes cuentan como aprobadas
    // (el backend no devuelve approvalStatus en los parts y decisions se limpia tras enviar)
    const isBudgetAccepted = order?.budget_accepted === 1;
    const approvedParts = isBudgetAccepted
      ? partsItems
      : partsItems.filter(
          (item: OrderPartItem) => decisions[item.id] === "accepted" || item.approvalStatus === "approved",
        );
    const approvedPartsTotal = approvedParts.reduce(
      (sum: number, item: OrderPartItem) => sum + (item.unit_price || 0) * (item.quantity || 0),
      0,
    );
    const rejectedPartsCount = isBudgetAccepted
      ? 0
      : partsItems.filter(
          (item: OrderPartItem) => decisions[item.id] === "rejected" || item.approvalStatus === "rejected",
        ).length;

    // Labor from serviceItems — la mano de obra es obligatoria, siempre se suma completa
    const laborTotal = serviceItems.reduce((sum: number, item: ServiceItem) => sum + (item.price || 0), 0);
    const approvedLaborTotal = laborTotal; // la mano de obra no tiene switch de rechazo

    const subtotal = approvedPartsTotal + approvedLaborTotal;

    return {
      subtotal,
      total: subtotal, // sin IVA
      approvedCount: approvedParts.length + serviceItems.length,
      rejectedCount: rejectedPartsCount,
      partsTotal,
      laborTotal,
      approvedPartsTotal,
      approvedLaborTotal,
    };
  }, [orderParts, serviceItems, decisions, order?.budget_accepted]);

  const handleDecisionChange = (itemId: string | number, decision: CustomerDecision) => {
    setDecisions((prev) => ({ ...prev, [String(itemId)]: decision }));
  };

  const handleWhatsAppInquiry = (item: BudgetItem | ServiceItem | OrderPartItem) => {
    const desc = "description" in item ? item.description : item.name;
    const url = buildPartInquiryUrl("573001234567", desc, `OT-${order?.id.toString().padStart(4, "0")}`);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppStatus = () => {
    const message = `Hola, quisiera más información sobre el estatus de mi vehículo: ${order?.vehicle_plate} ${order?.vehicle_make} ${order?.vehicle_model}. Mi nombre es: ${order?.customer_name}. Mi teléfono es: ${order?.customer_phone}.`;
    const url = buildWhatsAppUrl("573001234567", message);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleAcceptAll = () => {
    const newDecisions: Record<string, CustomerDecision> = {};
    budget.forEach((item: BudgetItem) => {
      newDecisions[String(item.id)] = "accepted";
    });
    (orderParts || []).forEach((item: OrderPartItem) => {
      newDecisions[String(item.id)] = "accepted";
    });
    serviceItems.forEach((item: ServiceItem) => {
      newDecisions[String(item.id)] = "accepted";
    });
    setDecisions(newDecisions);
  };

  const handleRejectAll = () => {
    const newDecisions: Record<string, CustomerDecision> = {};
    budget.forEach((item: BudgetItem) => {
      newDecisions[String(item.id)] = "rejected";
    });
    (orderParts || []).forEach((item: OrderPartItem) => {
      newDecisions[String(item.id)] = "rejected";
    });
    serviceItems.forEach((item: ServiceItem) => {
      newDecisions[String(item.id)] = "rejected";
    });
    setDecisions(newDecisions);
  };

  const handleSubmitDecisions = async () => {
    try {
      const items = Object.entries(decisions).map(([id, decision]) => ({
        id: isNaN(Number(id)) ? id : parseInt(id, 10),
        decision,
      }));

      if (items.length === 0) return;

      await api.post(endpoints.publicDecision(token), { items });
      setDecisions({});
    } catch (error) {
      // El error se muestra globalmente
    }
  };

  const handleConfirmAcceptance = async () => {
    await handleSubmitDecisions();
    try {
      await api.patch(
        endpoints.publicOrder(token),
        { budget_accepted: 1, status: "approved" },
        { skipUpdatedBy: true },
      );
    } catch {
      // Error no bloqueante — las decisiones ya se enviaron
    }
    setConfirmDialogOpen(false);
    refetch();
  };

  // Estado de carga
  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-surface-base'>
        <div className='text-center'>
          <Loader2 className='mx-auto h-8 w-8 animate-spin text-brand-600' />
          <p className='mt-3 text-sm text-slate-500'>Cargando información de su vehículo...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error || !order) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-surface-base p-4'>
        <div className='w-full max-w-md text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50'>
            <AlertCircle className='h-8 w-8 text-red-500' />
          </div>
          <h1 className='text-xl font-bold text-slate-800'>Error al cargar</h1>
          <p className='mt-2 text-sm text-slate-500'>No se pudo encontrar la orden con el token proporcionado.</p>
          <div className='mt-4 space-y-2'>
            <CustomButton variant='secondary' onClick={() => refetch()}>
              Reintentar
            </CustomButton>
          </div>
          <p className='mt-4 text-xs text-slate-400'>Token: {token.substring(0, 10)}...</p>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStep(order.status);
  const isBudgetEditable = order.budget_accepted === 0;

  return (
    <div className='mx-auto max-w-md space-y-6 px-4 pb-32 sm:px-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-extrabold tracking-tight text-slate-900'>Estado de tu Vehículo</h1>
        <p className='mt-1 text-sm text-slate-500'>
          {order.vehicle_make} {order.vehicle_model} · {order.vehicle_plate}
        </p>
      </div>

      {/* Stepper */}
      <CustomCard>
        <StatusSlider steps={STEPS} currentStep={currentStep} />
      </CustomCard>

      {/* Progreso del checklist */}
      {checklist.length > 0 && currentStep > 2 && currentStep < 7 && (
        <CustomCard>
          <div className='mb-3 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
                <ClipboardList className='h-4 w-4 text-brand-600' />
              </div>
              <h2 className='text-sm font-bold text-slate-800'>Progreso del Trabajo</h2>
            </div>
            <span className='text-sm font-extrabold text-brand-600'>{progress}%</span>
          </div>
          <div className='h-2.5 overflow-hidden rounded-full bg-slate-100'>
            <div
              className='h-full rounded-full bg-brand-600 transition-all duration-500 ease-out'
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className='mt-2 text-xs font-medium text-slate-400'>
            {checklist.filter((i: ChecklistItem) => i.completed).length} de {checklist.length} tareas completadas
          </p>
          <ul className='mt-4 space-y-2.5'>
            {checklist.map((item: ChecklistItem) => (
              <li key={item.id} className='flex items-center gap-2.5'>
                {item.completed ? (
                  <CheckCircle2 className='h-5 w-5 shrink-0 text-emerald-500' />
                ) : (
                  <Circle className='h-5 w-5 shrink-0 text-slate-300' />
                )}
                <span
                  className={`text-sm ${item.completed ? "text-slate-400 line-through" : "text-slate-700 font-medium"}`}
                >
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </CustomCard>
      )}

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className='mb-4 flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <Car className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Datos del Vehículo</h2>
        </div>
        <div className='grid grid-cols-2 gap-4'>
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
            <p className='text-xs font-medium text-slate-400'>Color</p>
            <p className='text-sm font-bold text-slate-800'>{order.vehicle_color || "—"}</p>
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
        <div className='grid grid-cols-1 gap-4'>
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
      {order.vehicle_details && (
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <FileText className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Detalles del Vehículo</h2>
          </div>
          <p className='text-sm text-slate-600 whitespace-pre-wrap'>{order.vehicle_details}</p>
        </CustomCard>
      )}

      {/* Servicios (Mano de obra) */}
      {serviceItems.length > 0 && (
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Wrench className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Servicios (Mano de obra)</h2>
          </div>
          <div className='space-y-3'>
            {serviceItems.map((item, index) => (
              <div
                key={item.id}
                className='flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5'
              >
                <span className='mt-1 text-sm font-medium text-slate-500'>{index + 1}.</span>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-bold text-slate-800'>{item.description}</p>
                  <p className='mt-1 text-xs font-medium text-slate-400'>{formatCOP(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className='mt-4 pt-4 border-t border-slate-100 flex items-center justify-between'>
            <span className='text-sm font-medium text-slate-500'>Total mano de obra</span>
            <span className='text-xl font-extrabold text-brand-600'>
              {formatCOP(serviceItems.reduce((sum, item) => sum + (item.price || 0), 0))}
            </span>
          </div>
        </CustomCard>
      )}

      {/* Galería de Evidencias */}
      {evidence.length > 0 && (
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Camera className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Inspección y Evidencias</h2>
          </div>
          <EvidenceGallery evidence={evidence} />
        </CustomCard>
      )}

      {/* --- Cotizador Interactivo --- */}
      <CustomCard>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <FileText className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Presupuesto Detallado</h2>
          </div>
        </div>

        {budget.length === 0 && (!orderParts || orderParts.length === 0) ? (
          <p className='text-sm text-slate-400'>No hay ítems en el presupuesto</p>
        ) : (
          <div className='space-y-3'>
            {/* --- Partes necesarias --- */}
            {(() => {
              const parts = orderParts || [];
              if (parts.length === 0) return null;
              const partsTotal = parts.reduce(
                (sum: number, item: OrderPartItem) => sum + (item.unit_price || 0) * (item.quantity || 0),
                0,
              );
              const isBudgetAccepted = order?.budget_accepted === 1;
              const approvedParts = isBudgetAccepted
                ? parts
                : parts.filter(
                    (item: OrderPartItem) =>
                      decisions[String(item.id)] === "accepted" || item.approvalStatus === "approved",
                  );
              const approvedPartsTotal = approvedParts.reduce(
                (sum: number, item: OrderPartItem) => sum + (item.unit_price || 0) * (item.quantity || 0),
                0,
              );

              return (
                <div className='space-y-3 mb-6'>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-2'>
                      <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50'>
                        <Package className='h-4 w-4 text-amber-600' />
                      </div>
                      <h3 className='text-sm font-bold text-slate-800'>Partes necesarias</h3>
                    </div>
                    <span className='text-sm font-bold text-amber-600'>{formatCOP(partsTotal)}</span>
                  </div>
                  <div className='space-y-2'>
                    {parts.map((item: OrderPartItem, index: number) => {
                      const currentDecision = isBudgetAccepted
                        ? "accepted"
                        : decisions[String(item.id)] || item.approvalStatus || "pending";
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 transition-all ${
                            currentDecision === "accepted"
                              ? "border-emerald-200 bg-emerald-50"
                              : currentDecision === "rejected"
                                ? "border-red-200 bg-red-50 opacity-60"
                                : "border-slate-100 bg-white"
                          }`}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div className='flex-1 min-w-0'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <CustomBadge variant='neutral'>Repuesto</CustomBadge>
                                {currentDecision === "accepted" && (
                                  <CustomBadge variant='success' dot>
                                    Aprobado
                                  </CustomBadge>
                                )}
                                {currentDecision === "rejected" && (
                                  <CustomBadge variant='danger' dot>
                                    Omitido
                                  </CustomBadge>
                                )}
                                {currentDecision === "pending" && (
                                  <CustomBadge variant='warning' dot>
                                    Pendiente
                                  </CustomBadge>
                                )}
                              </div>
                              <p className='mt-2 text-sm font-bold text-slate-800'>{item.name}</p>
                              <p className='mt-1 text-xs font-medium text-slate-400'>
                                Cant: {item.quantity} · {formatCOP(item.unit_price || 0)} c/u
                              </p>
                            </div>
                            <p className='text-sm font-extrabold text-slate-900'>
                              {formatCOP((item.unit_price || 0) * (item.quantity || 0))}
                            </p>
                          </div>
                          <div className='mt-4 flex items-center justify-between border-t border-slate-100 pt-3'>
                            <CustomSwitch
                              checked={currentDecision === "accepted"}
                              onChange={(checked) =>
                                handleDecisionChange(String(item.id), checked ? "accepted" : "rejected")
                              }
                              label={currentDecision === "accepted" ? "Aprobado" : "Rechazar"}
                              size='sm'
                              disabled={!isBudgetEditable}
                            />
                            <button
                              onClick={() => handleWhatsAppInquiry(item)}
                              disabled={!isBudgetEditable}
                              className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors ${
                                isBudgetEditable ? "hover:bg-emerald-100" : "opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <MessageCircle className='h-3.5 w-3.5' />
                              Preguntar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className='mt-3 pt-3 border-t border-slate-100 flex items-center justify-between'>
                    <span className='text-sm font-medium text-slate-500'>Subtotal partes</span>
                    <span className='text-lg font-extrabold text-amber-600'>{formatCOP(partsTotal)}</span>
                  </div>
                  <div className='mt-1 flex items-center justify-between text-xs text-slate-400'>
                    <span>Aprobado: {formatCOP(approvedPartsTotal)}</span>
                    <span>Pendiente: {formatCOP(partsTotal - approvedPartsTotal)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CustomCard>

      {/* --- Resumen Financiero --- */}
      <CustomCard>
        <h2 className='mb-4 text-sm font-bold text-slate-800'>Resumen Financiero</h2>
        <div className='space-y-3'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium text-slate-500'>Subtotal Partes ({approvedCount} ítems aprobados)</span>
            <span className='font-bold text-slate-800'>{formatCOP(approvedPartsTotal)}</span>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium text-slate-500'>Subtotal Mano de obra</span>
            <span className='font-bold text-slate-800'>{formatCOP(approvedLaborTotal)}</span>
          </div>
          <div className='border-t border-slate-100 pt-3'>
            <div className='flex items-center justify-between'>
              <span className='text-base font-extrabold text-slate-900'>Total General</span>
              <span className='text-xl font-extrabold text-brand-600'>{formatCOP(total)}</span>
            </div>
          </div>
          {rejectedCount > 0 && (
            <p className='text-xs font-medium text-slate-400'>
              {rejectedCount} {rejectedCount === 1 ? "ítem omitido" : "ítems omitidos"} del presupuesto original
            </p>
          )}
        </div>
      </CustomCard>

      {/* --- Sticky Footer --- */}
      <div className='fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm'>
        <div className='mx-auto max-w-md p-4'>
          {isBudgetEditable ? (
            <>
              <div className='mb-3 flex items-center justify-between'>
                <span className='text-sm font-medium text-slate-500'>Total aprobado</span>
                <span className='text-2xl font-extrabold text-brand-600'>{formatCOP(total)}</span>
              </div>
              <CustomButton
                size='lg'
                className='w-full'
                leftIcon={<CheckCircle2 className='h-5 w-5' />}
                onClick={() => setConfirmDialogOpen(true)}
              >
                Aceptar Presupuesto
              </CustomButton>
            </>
          ) : (
            <>
              <div className='mb-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3'>
                <CheckCircle2 className='h-5 w-5 text-emerald-600' />
                <span className='text-sm font-bold text-emerald-800'>Presupuesto aceptado</span>
              </div>
              <button
                onClick={handleWhatsAppStatus}
                className='flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-600'
              >
                <MessageCircle className='h-5 w-5' />
                Preguntar por mi vehículo
              </button>
            </>
          )}
        </div>
      </div>

      {/* --- Modal de Confirmación --- */}
      <CustomDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title='Confirmar Aceptación del Presupuesto'
      >
        <div className='space-y-3'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium text-slate-500'>Mano de obra</span>
            <span className='font-bold text-slate-800'>{formatCOP(laborTotal)}</span>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium text-slate-500'>Partes</span>
            <span className='font-bold text-slate-800'>{formatCOP(approvedPartsTotal)}</span>
          </div>
          <div className='border-t border-slate-100 pt-3'>
            <div className='flex items-center justify-between'>
              <span className='text-base font-extrabold text-slate-900'>Total General</span>
              <span className='text-xl font-extrabold text-brand-600'>{formatCOP(total)}</span>
            </div>
          </div>
        </div>
        <div className='mt-6 flex gap-3'>
          <CustomButton variant='secondary' className='flex-1' onClick={() => setConfirmDialogOpen(false)}>
            Cancelar
          </CustomButton>
          <CustomButton className='flex-1' onClick={handleConfirmAcceptance}>
            Confirmar Aceptación
          </CustomButton>
        </div>
      </CustomDialog>
    </div>
  );
}
