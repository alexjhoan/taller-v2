import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import { ArrowLeft, Filter, X, ChevronDown, ChevronUp, DollarSign, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { api } from "@/services/api";
import { Layout } from "@/components/Layout";
import { withAuth } from "@/components/withAuth";
import { formatCOP } from "@/utils/currency";

interface AdminPaymentsPageProps {}

type DateRangePreset = "today" | "week" | "month" | "custom";

/** El backend devuelve { status, body: [...], statusText, total } (body es el array). */
interface PaymentRow {
  id: number;
  order_id: number;
  labor_amount: number;
  parts_amount: number;
  total_amount: number;
  created_at?: string;
  paid_at?: string;
  order?: { customer_name?: string; vehicle_plate?: string };
}

function AdminPaymentsPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });

  // Totales: se calculan desde la lista cargada (el endpoint de lista ya trae
  // la información). Solo se consulta /payments/stats cuando el usuario aplica
  // un filtro, para obtener los totales reales del rango filtrado.
  const [stats, setStats] = useState({
    total_labor: 0,
    total_parts: 0,
    total_revenue: 0,
    total_payments: 0,
  });

  // Filtros: `draft` es lo que el usuario edita; `applied` es lo que se consulta.
  const [draft, setDraft] = useState({
    preset: "month" as DateRangePreset,
    date_from: "",
    date_to: "",
  });
  const [applied, setApplied] = useState({ date_from: "", date_to: "" });
  const [showFilters, setShowFilters] = useState(false);

  // Helper: calcular fechas según preset
  const computeDatesFromPreset = (preset: DateRangePreset): { from: string; to: string } => {
    const today = new Date();
    const to = today.toISOString().split("T")[0];
    let from: Date;

    switch (preset) {
      case "today":
        from = today;
        break;
      case "week":
        from = new Date(today);
        from.setDate(today.getDate() - 6); // últimos 7 días incluyendo hoy
        break;
      case "month":
        from = new Date(today.getFullYear(), today.getMonth(), 1); // primer día del mes
        break;
      case "custom":
      default:
        return { from: "", to: "" };
    }
    return { from: from.toISOString().split("T")[0], to };
  };

  // Al cambiar preset, actualizar las fechas del borrador
  useEffect(() => {
    if (draft.preset !== "custom") {
      const { from, to } = computeDatesFromPreset(draft.preset);
      setDraft((prev) => ({ ...prev, date_from: from, date_to: to }));
    }
  }, [draft.preset]);

  // Totales calculados desde los pagos de la página actual
  const computeStatsFromList = useCallback((list: PaymentRow[]) => {
    const total_labor = list.reduce((sum, p) => sum + (Number(p.labor_amount) || 0), 0);
    const total_parts = list.reduce((sum, p) => sum + (Number(p.parts_amount) || 0), 0);
    setStats({
      total_labor,
      total_parts,
      total_revenue: total_labor + total_parts,
      total_payments: list.length,
    });
  }, []);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getPayments({
        page: pagination.current_page,
        per_page: pagination.per_page,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
      });
      // El backend devuelve body como array directo (con total fuera de body)
      const raw: any = response;
      const list: PaymentRow[] = Array.isArray(raw?.body)
        ? raw.body
        : Array.isArray(raw?.body?.data)
          ? raw.body.data
          : [];
      const total = Number(raw?.total ?? raw?.body?.total ?? list.length);
      const perPage = pagination.per_page;

      setPayments(list);
      setPagination((prev) => ({
        ...prev,
        total,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      }));
      computeStatsFromList(list);
    } catch (error: any) {
      const detail = error?.body?.statusText || error?.message || "Error al cargar pagos";
      enqueueSnackbar(detail, { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current_page, pagination.per_page, applied.date_from, applied.date_to, computeStatsFromList]);

  // Stats solo se consultan cuando hay un filtro aplicado (rango de fechas)
  const fetchStats = useCallback(async (from?: string, to?: string) => {
    const dateFrom = from ?? applied.date_from;
    const dateTo = to ?? applied.date_to;
    if (!dateFrom && !dateTo) return;
    try {
      const response = await api.getPaymentStats({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      const body: any = response?.body;
      if (body && typeof body === "object") {
        setStats({
          total_labor: Number(body.total_labor) || 0,
          total_parts: Number(body.total_parts) || 0,
          total_revenue: Number(body.total_revenue) || 0,
          total_payments: Number(body.total_payments) || 0,
        });
      }
    } catch {
      // Silencioso: si fallan las stats se conservan los totales de la lista
    }
  }, [applied.date_from, applied.date_to]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleFilterChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, current_page: 1 }));
    setApplied({ date_from: draft.date_from, date_to: draft.date_to });
    // Stats solo se piden al aplicar el filtro (con las fechas del borrador)
    fetchStats(draft.date_from, draft.date_to);
  };

  const clearFilters = () => {
    const fresh = { preset: "month" as DateRangePreset, date_from: "", date_to: "" };
    setDraft(fresh);
    setPagination((prev) => ({ ...prev, current_page: 1 }));
    setApplied({ date_from: "", date_to: "" });
  };

  const handleExport = async () => {
    try {
      // Reutilizar api.getPayments con per_page grande para exportar
      const response = await api.getPayments({
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        per_page: 10000,
        page: 1,
      });
      const raw: any = response;
      const list: PaymentRow[] = Array.isArray(raw?.body)
        ? raw.body
        : Array.isArray(raw?.body?.data)
          ? raw.body.data
          : [];
      if (!list.length) {
        enqueueSnackbar("No hay datos para exportar", { variant: "warning" });
        return;
      }

      // Generar CSV
      const headers = ["ID", "Fecha", "Orden", "Mano de obra", "Repuestos", "Total"];
      const rows = list.map((p) => [
        p.id,
        (p.created_at || p.paid_at || "").split(" ")[0] || "",
        p.order_id || "",
        p.labor_amount,
        p.parts_amount,
        p.total_amount,
      ]);
      const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      link.download = `pagos_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar("Exportación completada", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("Error al exportar", { variant: "error" });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl p-6 pb-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CustomButton variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")} leftIcon={<ArrowLeft className="h-4 w-4" />} className="whitespace-nowrap">
              Volver
            </CustomButton>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestión de Pagos</h1>
              <p className="mt-0.5 text-sm text-slate-500">Historial y totales de pagos registrados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CustomButton variant="secondary" size="sm" onClick={handleExport} leftIcon={<Download className="h-4 w-4" />}>Exportar CSV</CustomButton>
          </div>
        </div>

        {/* Totales - Card principal */}
        <CustomCard className="mb-6 bg-gradient-to-r from-brand-600 to-brand-700 text-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-brand-100">Total Mano de Obra</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold">{formatCOP(stats.total_labor)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-100">Total Repuestos</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold">{formatCOP(stats.total_parts)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-100">Total Pagos</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold">{stats.total_payments}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-100">Ingreso Total</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold">{formatCOP(stats.total_revenue)}</p>
            </div>
          </div>
        </CustomCard>

        {/* Filtros */}
        <CustomCard className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </h2>
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            >
              {showFilters ? "Ocultar" : "Mostrar"}
            </CustomButton>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rango de fechas</label>
                <CustomSelect
                  value={draft.preset}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange("preset", e.target.value)}
                  options={[
                    { value: "today", label: "Hoy" },
                    { value: "week", label: "Última semana" },
                    { value: "month", label: "Este mes" },
                    { value: "custom", label: "Rango personalizado" },
                  ]}
                />
              </div>

              {draft.preset === "custom" && (
                <>
                  <CustomInput
                    label="Fecha inicio"
                    type="date"
                    value={draft.date_from}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("date_from", e.target.value)}
                  />
                  <CustomInput
                    label="Fecha fin"
                    type="date"
                    value={draft.date_to}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("date_to", e.target.value)}
                  />
                </>
              )}

              <div className="flex items-end gap-2">
                <CustomButton onClick={applyFilters} className="flex-1">
                  <Filter className="h-4 w-4 mr-2" />
                  Aplicar
                </CustomButton>
                <CustomButton variant="secondary" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </CustomButton>
              </div>
            </div>
          )}
        </CustomCard>

        {/* Lista de pagos */}
        <CustomCard>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-slate-300" />
              <p className="mt-4 text-sm text-slate-500">No hay pagos con los filtros actuales</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-3 px-4">ID</th>
                      <th className="pb-3 px-4">Fecha</th>
                      <th className="pb-3 px-4">Orden</th>
                      <th className="pb-3 px-4 hidden md:table-cell">Cliente</th>
                      <th className="pb-3 px-4 hidden lg:table-cell">Vehículo</th>
                      <th className="pb-3 px-4 text-right">Mano de obra</th>
                      <th className="pb-3 px-4 text-right">Repuestos</th>
                      <th className="pb-3 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className="cursor-pointer hover:bg-brand-50/40"
                        onClick={() => p.order_id && router.push(`/admin/order-detail?order-id=${p.order_id}`)}
                        title={`Ver orden #${p.order_id}`}
                      >
                        <td className="py-3 px-4 text-slate-500 font-mono">#{p.id}</td>
                        <td className="py-3 px-4">{formatDate(p.created_at || p.paid_at || "")}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">#{p.order_id}</td>
                        <td className="py-3 px-4 hidden md:table-cell">{p.order?.customer_name || "-"}</td>
                        <td className="py-3 px-4 hidden lg:table-cell">{p.order?.vehicle_plate || "-"}</td>
                        <td className="py-3 px-4 text-right">{formatCOP(p.labor_amount)}</td>
                        <td className="py-3 px-4 text-right">{formatCOP(p.parts_amount)}</td>
                        <td className="py-3 px-4 text-right font-bold text-brand-600">{formatCOP(p.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {pagination.last_page > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1} a {Math.min(pagination.current_page * pagination.per_page, pagination.total)} de {pagination.total} pagos
                  </p>
                  <div className="flex gap-2">
                    <CustomButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, current_page: p.current_page - 1 }))}
                      disabled={pagination.current_page === 1}
                      leftIcon={<ChevronLeft className="h-4 w-4" />}
                    >
                      Anterior
                    </CustomButton>
                    <CustomButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, current_page: p.current_page + 1 }))}
                      disabled={pagination.current_page === pagination.last_page}
                      rightIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      Siguiente
                    </CustomButton>
                  </div>
                </div>
              )}
            </>
          )}
        </CustomCard>
      </div>
    </Layout>
  );
}

export default withAuth(AdminPaymentsPage, { roles: ["admin"], redirectTo: "/login" });
