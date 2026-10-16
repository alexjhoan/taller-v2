import { useEffect } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Loader2, AlertCircle, FileText, Clock } from "lucide-react";
import { withAuth } from "@/components/withAuth";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { Layout } from "@/components/Layout";
import { useOrderAuditLog } from "@/hooks/useOrderAuditLog";
import { AuditLogEntry } from "@/types/audit";

// --- Utilidades de formato ---

function formatDateTime(isoString: string): { time: string; date: string } {
  const d = new Date(isoString);
  const time = d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return { time, date };
}

const actionConfig: Record<
  AuditLogEntry["action"],
  { label: string; badgeVariant: "info" | "warning" | "success" | "danger"; dotColor: string; icon: string }
> = {
  created: {
    label: "Creada",
    badgeVariant: "info",
    dotColor: "bg-sky-500",
    icon: "✓",
  },
  edited: {
    label: "Editada",
    badgeVariant: "warning",
    dotColor: "bg-amber-500",
    icon: "✎",
  },
  status_changed: {
    label: "Estado cambiado",
    badgeVariant: "warning",
    dotColor: "bg-amber-500",
    icon: "⟳",
  },
  delivered: {
    label: "Entregada",
    badgeVariant: "success",
    dotColor: "bg-emerald-500",
    icon: "✓",
  },
  cancelled: {
    label: "Cancelada",
    badgeVariant: "danger",
    dotColor: "bg-red-500",
    icon: "✕",
  },
};

// Traducción de valores de status/campos en inglés a español
const statusLabels: Record<string, string> = {
  received: "Recibido",
  diagnosing: "Diagnóstico",
  awaiting_approval: "Esperando aprobación",
  approved: "Aprobado",
  in_progress: "En taller",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
  pending: "Pendiente",
  accepted: "Aceptado",
  rejected: "Rechazado",
  preventive: "Preventivo",
  corrective: "Correctivo",
  motor: "Motor",
  suspension: "Suspensión",
  electric: "Eléctrico",
  transmission: "Transmisión",
  brakes: "Frenos",
  bodywork: "Carrocería",
  other: "Otro",
  labor: "Mano de obra",
  part: "Repuesto",
};

function translateStatus(value: string): string {
  return statusLabels[value] ?? value;
}

// --- Componente principal ---

function AdminOrderLogPage() {
  const router = useRouter();
  const orderIdParam = router.query.orderId;
  const orderId = orderIdParam ? parseInt(orderIdParam as string, 10) : null;

  const { data: auditLog, isLoading, error } = useOrderAuditLog(orderId);

  // Redirigir si no hay orderId
  useEffect(() => {
    if (!orderIdParam || isNaN(Number(orderIdParam))) {
      router.replace("/admin/dashboard");
    }
  }, [orderIdParam, router]);

  if (!orderId || isNaN(orderId)) {
    return null;
  }

  return (
    <Layout>
      <div className='mx-auto max-w-4xl space-y-6 p-6 pb-8'>
        {/* Header */}
        <div className='flex items-center gap-4'>
          <CustomButton
            variant='ghost'
            size='sm'
            leftIcon={<ArrowLeft className='h-4 w-4' />}
            onClick={() => router.back()}
          >
            Volver
          </CustomButton>
          <div>
            <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>
              Historial de Cambios
            </h1>
            <p className='mt-0.5 text-sm text-slate-500'>Orden #{orderId}</p>
          </div>
        </div>

        {/* Contenido */}
        <CustomCard>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-6 w-6 animate-spin text-brand-600' />
              <span className='ml-2 text-sm text-slate-500'>Cargando historial...</span>
            </div>
          ) : error ? (
            <div className='flex items-center justify-center py-12 text-red-500'>
              <AlertCircle className='h-6 w-6' />
              <span className='ml-2 text-sm'>Error al cargar el historial de cambios</span>
            </div>
          ) : !auditLog || auditLog.length === 0 ? (
            <div className='py-12 text-center'>
              <FileText className='mx-auto h-12 w-12 text-slate-300' />
              <p className='mt-3 text-sm font-medium text-slate-400'>Sin registros de cambios</p>
            </div>
          ) : (
            <div className='relative'>
              {/* Línea vertical */}
              <div className='absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200' />

              {/* Items del timeline */}
              <div className='space-y-6'>
                {auditLog.map((entry) => {
                  const config = actionConfig[entry.action];
                  const { time, date } = formatDateTime(entry.created_at);

                  return (
                    <div key={entry.id} className='relative flex gap-4'>
                      {/* Círculo */}
                      <div
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${config.dotColor}`}
                      >
                        {config.icon}
                      </div>

                      {/* Contenido */}
                      <div className='flex-1 min-w-0 pb-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <CustomBadge variant={config.badgeVariant} dot>
                            {config.label}
                          </CustomBadge>
                          <span className='text-xs text-slate-400'>#{entry.id}</span>
                        </div>

                        {/* Hora y fecha */}
                        <div className='mt-1 flex items-center gap-2 text-sm'>
                          <Clock className='h-3.5 w-3.5 text-slate-400' />
                          <span className='font-mono font-semibold text-slate-700'>{time}</span>
                          <span className='text-slate-400'>·</span>
                          <span className='text-slate-500'>{date}</span>
                        </div>

                        {/* Usuario */}
                        <div className='mt-1.5 flex flex-wrap items-center gap-2'>
                          <span className='text-sm font-semibold text-slate-800'>{entry.user_name}</span>
                          <CustomBadge variant={entry.user_role === "admin" ? "brand" : "neutral"}>
                            {entry.user_role === "admin" ? "Admin" : "Mecánico"}
                          </CustomBadge>
                          <span className='text-xs text-slate-400'>ID: {entry.user_id}</span>
                        </div>

                        {/* Cambios */}
                        {entry.changes && Object.keys(entry.changes).length > 0 && (
                          <div className='mt-3 space-y-1.5'>
                            {Object.entries(entry.changes).map(([field, change]) => (
                              <div key={field} className='flex flex-wrap items-center gap-2 text-sm'>
                                <span className='font-medium text-slate-600 capitalize'>
                                  {field.replace(/_/g, " ")}:
                                </span>
                                <span className='text-red-500 line-through'>{translateStatus(change.from) || "—"}</span>
                                <span className='text-slate-400'>→</span>
                                <span className='text-emerald-600 font-medium'>{translateStatus(change.to) || "—"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CustomCard>
      </div>
    </Layout>
  );
}

export default withAuth(AdminOrderLogPage, {
  roles: ["admin"],
  redirectTo: "/login",
});
