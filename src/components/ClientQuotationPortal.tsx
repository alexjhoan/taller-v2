import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  MessageCircle,
  ChevronRight,
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
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomSwitch } from '@/components/ui/CustomSwitch';
import { CustomStepper } from '@/components/ui/CustomStepper';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { formatCOP } from '@/utils/currency';
import { api, endpoints } from '@/services/api';

// --- Tipos ---

type OrderStatus =
  | 'received'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'approved'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled';

type CustomerDecision = 'pending' | 'accepted' | 'rejected';

interface BudgetItem {
  id: number;
  type: 'labor' | 'part';
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

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
}

interface OrderData {
  id: number;
  public_token: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string | null;
  mileage: number;
  fuel_level: string;
  failure_description: string;
  status: OrderStatus;
  started_at: string | null;
  finished_at: string | null;
  withdrawal_comment: string | null;
  checklist?: ChecklistItem[] | string;
}

interface PublicOrderResponse {
  order: OrderData;
  evidence: Evidence[];
  budget: BudgetItem[];
}

// --- Constantes ---

const STEPS = [
  { label: 'Recepción', description: 'Vehículo recibido' },
  { label: 'Diagnóstico', description: 'Inspección inicial' },
  { label: 'Aprobación', description: 'Presupuesto' },
  { label: 'Taller', description: 'Reparación' },
  { label: 'Entrega', description: 'Listo para retirar' },
];

// --- Componente ---

interface ClientQuotationPortalProps {
  token: string;
}

export function ClientQuotationPortal({ token }: ClientQuotationPortalProps) {
  const { buildPartInquiryUrl } = useWhatsApp();
  const [decisions, setDecisions] = useState<Record<number, CustomerDecision>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publicOrder', token],
    queryFn: async () => {
      const response = await api.get<{ status: number; body: PublicOrderResponse; statusText: string }>(
        endpoints.publicOrder(token)
      );
      return response.body;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const order = data?.order;
  const budget = data?.budget || [];
  const evidence = data?.evidence || [];

  const checklist = useMemo(() => {
    if (!order?.checklist) return [];
    if (Array.isArray(order.checklist)) return order.checklist;
    try {
      return JSON.parse(order.checklist);
    } catch {
      return [];
    }
  }, [order?.checklist]);

  const progress = useMemo(() => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter((item: ChecklistItem) => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  const getCurrentStep = (status: OrderStatus): number => {
    const stepMap: Record<OrderStatus, number> = {
      received: 0,
      diagnosing: 1,
      awaiting_approval: 2,
      approved: 3,
      in_progress: 3,
      ready: 4,
      delivered: 4,
      cancelled: 0,
    };
    return stepMap[status] ?? 0;
  };

  const { subtotal, iva, total, approvedCount, rejectedCount } = useMemo(() => {
    const approved = budget.filter(
      (item) => item.customer_decision === 'accepted' || decisions[item.id] === 'accepted'
    );
    const sub = approved.reduce((sum, item) => sum + parseFloat(item.unit_price) * parseInt(item.quantity, 10), 0);
    const tax = Math.round(sub * 0.19);
    return {
      subtotal: sub,
      iva: tax,
      total: sub + tax,
      approvedCount: approved.length,
      rejectedCount: budget.filter(
        (item) => item.customer_decision === 'rejected' || decisions[item.id] === 'rejected'
      ).length,
    };
  }, [budget, decisions]);

  const handleDecisionChange = (itemId: number, decision: CustomerDecision) => {
    setDecisions((prev) => ({ ...prev, [itemId]: decision }));
  };

  const handleWhatsAppInquiry = (item: BudgetItem) => {
    const url = buildPartInquiryUrl(
      '573001234567',
      item.description,
      `OT-${order?.id.toString().padStart(4, '0')}`
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAcceptAll = () => {
    const newDecisions: Record<number, CustomerDecision> = {};
    budget.forEach((item) => {
      newDecisions[item.id] = 'accepted';
    });
    setDecisions(newDecisions);
  };

  const handleRejectAll = () => {
    const newDecisions: Record<number, CustomerDecision> = {};
    budget.forEach((item) => {
      newDecisions[item.id] = 'rejected';
    });
    setDecisions(newDecisions);
  };

  const handleSubmitDecisions = async () => {
    try {
      const items = Object.entries(decisions).map(([id, decision]) => ({
        id: parseInt(id, 10),
        decision,
      }));

      if (items.length === 0) return;

      await api.post(endpoints.publicDecision(token), { items });
      setDecisions({});
    } catch (error) {
      // El error se muestra globalmente
    }
  };

  // Estado de carga
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
          <p className="mt-3 text-sm text-slate-500">Cargando información de su vehículo...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Error al cargar</h1>
          <p className="mt-2 text-sm text-slate-500">
            No se pudo encontrar la orden con el token proporcionado.
          </p>
          <div className="mt-4 space-y-2">
            <CustomButton variant="secondary" onClick={() => refetch()}>
              Reintentar
            </CustomButton>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Token: {token.substring(0, 10)}...
          </p>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStep(order.status);

  return (
    <div className="mx-auto max-w-md space-y-6 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Estado de tu Vehículo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.vehicle_make} {order.vehicle_model} · {order.vehicle_plate}
        </p>
      </div>

      {/* Stepper */}
      <CustomCard>
        <CustomStepper steps={STEPS} currentStep={currentStep} />
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
            {checklist.filter((i: ChecklistItem) => i.completed).length} de {checklist.length} tareas completadas
          </p>
        </CustomCard>
      )}

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <Car className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Vehículo</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
            <p className="text-sm font-bold text-slate-800">{order.vehicle_color || '—'}</p>
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

      {/* Descripción de la falla */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <FileText className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Descripción de la Falla</h2>
        </div>
        <p className="text-sm text-slate-600">{order.failure_description || 'Sin descripción'}</p>
      </CustomCard>

      {/* Banner de evidencias */}
      {evidence.length > 0 && (
        <CustomCard
          className="cursor-pointer border-brand-200 bg-brand-50"
          onClick={() => {
            window.location.href = `/portal/evidence?token=${token}`;
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
              <Camera className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-brand-800">
                Inspección & Evidencias del Taller
              </h3>
              <p className="text-xs text-brand-600">
                {evidence.length} {evidence.length === 1 ? 'novedad' : 'novedades'} disponibles
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-brand-400" />
          </div>
        </CustomCard>
      )}

      {/* --- Cotizador Interactivo --- */}
      <CustomCard>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <FileText className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Presupuesto Detallado</h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAcceptAll}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              Aprobar todo
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={handleRejectAll}
              className="text-xs font-bold text-red-500 hover:text-red-600"
            >
              Rechazar todo
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {budget.length === 0 ? (
            <p className="text-sm text-slate-400">No hay ítems en el presupuesto</p>
          ) : (
            budget.map((item) => {
              const currentDecision = decisions[item.id] || item.customer_decision;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-all ${
                    currentDecision === 'accepted'
                      ? 'border-emerald-200 bg-emerald-50'
                      : currentDecision === 'rejected'
                        ? 'border-red-200 bg-red-50 opacity-60'
                        : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CustomBadge variant={item.type === 'labor' ? 'brand' : 'neutral'}>
                          {item.type === 'labor' ? 'Mano de obra' : 'Repuesto'}
                        </CustomBadge>
                        {currentDecision === 'accepted' && (
                          <CustomBadge variant="success" dot>
                            Aprobado
                          </CustomBadge>
                        )}
                        {currentDecision === 'rejected' && (
                          <CustomBadge variant="danger" dot>
                            Omitido
                          </CustomBadge>
                        )}
                        {currentDecision === 'pending' && (
                          <CustomBadge variant="warning" dot>
                            Pendiente
                          </CustomBadge>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-800">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        Cant: {item.quantity} · {formatCOP(parseFloat(item.unit_price))} c/u
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {formatCOP(parseFloat(item.unit_price) * parseInt(item.quantity, 10))}
                    </p>
                  </div>

                  {/* Switch de aprobación */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <CustomSwitch
                      checked={currentDecision === 'accepted'}
                      onChange={(checked) =>
                        handleDecisionChange(item.id, checked ? 'accepted' : 'rejected')
                      }
                      label={currentDecision === 'accepted' ? 'Aprobado' : 'Rechazar'}
                      size="sm"
                    />
                    <button
                      onClick={() => handleWhatsAppInquiry(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Preguntar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CustomCard>

      {/* --- Resumen Financiero --- */}
      <CustomCard>
        <h2 className="mb-4 text-sm font-bold text-slate-800">Resumen Financiero</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-500">Subtotal ({approvedCount} ítems)</span>
            <span className="font-bold text-slate-800">{formatCOP(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-500">IVA (19%)</span>
            <span className="font-bold text-slate-800">{formatCOP(iva)}</span>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-extrabold text-slate-900">Total Aprobado</span>
              <span className="text-xl font-extrabold text-brand-600">{formatCOP(total)}</span>
            </div>
          </div>
          {rejectedCount > 0 && (
            <p className="text-xs font-medium text-slate-400">
              {rejectedCount} {rejectedCount === 1 ? 'ítem omitido' : 'ítems omitidos'} del presupuesto original
            </p>
          )}
        </div>
      </CustomCard>

      {/* --- Sticky Footer --- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total aprobado</span>
            <span className="text-2xl font-extrabold text-brand-600">{formatCOP(total)}</span>
          </div>
          <CustomButton
            size="lg"
            className="w-full"
            leftIcon={<CheckCircle2 className="h-5 w-5" />}
            onClick={handleSubmitDecisions}
          >
            Aceptar y Continuar Presupuesto
          </CustomButton>
        </div>
      </div>
    </div>
  );
}
