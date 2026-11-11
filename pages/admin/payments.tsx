import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import { ArrowLeft, Filter, X, ChevronDown, ChevronUp, DollarSign, Calendar, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { api } from "@/services/api";
import { Layout } from "@/components/Layout";
import { withAuth } from "@/components/withAuth";
import { formatCOP } from "@/utils/currency";

interface AdminPaymentsPageProps {}

type DateRangePreset = "today" | "week" | "month" | "custom";

function AdminPaymentsPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });

  // Stats
  const [stats, setStats] = useState<{
    total_labor: number;
    total_parts: number;
    total_revenue: number;
    total_payments: number;
    by_method: Record<string, { amount: number; count: number }>;
  }>({
    total_labor: 0,
    total_parts: 0,
    total_revenue: 0,
    total_payments: 0,
    by_method: {
      cash: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      transfer: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    },
  });

  // Filtros
  const [filters, setFilters] = useState({
    preset: "month" as DateRangePreset,
    date_from: "",
    date_to: "",
    method: "",
  });
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

  // Al cambiar preset, actualizar date_from/date_to
  useEffect(() => {
    if (filters.preset !== "custom") {
      const { from, to } = computeDatesFromPreset(filters.preset);
      setFilters((prev) => ({ ...prev, date_from: from, date_to: to }));
    }
  }, [filters.preset]);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page: pagination.current_page,
        per_page: pagination.per_page,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        method: filters.method || undefined,
      };
      const response = await api.getPayments(params);
      if (response.body?.data) {
        setPayments(response.body.data);
        setPagination((prev) => ({ ...prev, ...response.body.pagination }));
      }
    } catch (error: any) {
      const detail = error?.body?.statusText || error?.message || "Error al cargar pagos";
      enqueueSnackbar(detail, { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current_page, pagination.per_page, filters.date_from, filters.date_to, filters.method]);

  const fetchStats = useCallback(async () => {
    try {
      const params = {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      };
      const response = await api.getPaymentStats(params);
      if (response.body) {
        setStats(response.body);
      }
    } catch (error) {
      // Silencioso: no bloquear la UI si fallan las stats
    }
  }, [filters.date_from, filters.date_to]);

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [fetchPayments, fetchStats]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key !== "preset") {
      setFilters((prev) => ({ ...prev, preset: "custom" }));
    }
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ preset: "month", date_from: "", date_to: "", method: "" });
    const { from, to } = computeDatesFromPreset("month");
    setFilters((prev) => ({ ...prev, date_from: from, date_to: to }));
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  };

  const handleExport = async () => {
    try {
      // Reutilizar api.getPayments con per_page grande para exportar
      const response = await api.getPayments({
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        method: filters.method || undefined,
        per_page: 10000,
        page: 1,
      });
      if (!response.body?.data?.length) {
        enqueueSnackbar("No hay datos para exportar", { variant: "warning" });
        return;
      }

      // Generar CSV
      const headers = ["ID", "Fecha", "Orden", "Cliente", "Vehículo", "Mano de obra", "Repuestos", "Total", "Método", "Referencia", "Notas"];
      const rows = response.body.data.map((p: any) => [
        p.id,
        p.paid_at?.split(" ")[0] || "",
        p.order_id || "",
        p.order?.customer_name || "",
        p.order?.vehicle_plate || "",
        p.labor_amount,
        p.parts_amount,
        p.total_amount,
        p.payment_method,
        p.reference || "",
        p.notes || "",
      ]);
      const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      link.download = `pagos_${filters.date_from}_a_${filters.date_to}_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar("Exportación completada", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("Error al exportar", { variant: "error" });
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "cash":
        return <CustomBadge variant="success" className="text-xs">Efectivo</CustomBadge>;
      case "card":
        return <CustomBadge variant="info" className="text-xs">Tarjeta</CustomBadge>;
      case "transfer":
        return <CustomBadge variant="neutral" className="text-xs">Transferencia</CustomBadge>;
      case "other":
        return <CustomBadge variant="neutral" className="text-xs">Otro</CustomBadge>;
      default:
        return <CustomBadge variant="neutral" className="text-xs">{method}</CustomBadge>;
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

  const presetOptions = [
    { value: "today", label: "Hoy" },
    { value: "week", label: "Última semana" },
    { value: "month", label: "Este mes" },
    { value: "custom", label: "Rango personalizado" },
  ];

  const methodOptions = [
    { value: "", label: "Todos" },
    { value: "cash", label: "Efectivo" },
    { value: "card", label: "Tarjeta" },
    { value: "transfer", label: "Transferencia" },
    { value: "other", label: "Otro" },
  ];

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

        {/* Total de ingresos - Card principal */}
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

          {/* Desglose por método */}
          <div className="mt-6 pt-6 border-t border-brand-500">
            <h3 className="text-sm font-semibold text-brand-100 mb-3">Por método de pago</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                { key: "cash", label: "Efectivo", color: "text-green-300" },
                { key: "card", label: "Tarjeta", color: "text-blue-300" },
                { key: "transfer", label: "Transferencia", color: "text-slate-300" },
                { key: "other", label: "Otro", color: "text-amber-300" },
              ].map((m) => (
                <div key={m.key} className="bg-brand-800/50 rounded-lg p-3">
                  <p className={`font-medium ${m.color}`}>{m.label}</p>
                  <p className="font-bold text-white">{formatCOP(stats.by_method[m.key]?.amount || 0)}</p>
                  <p className="text-xs text-brand-200">({stats.by_method[m.key]?.count || 0} pagos)</p>
                </div>
              ))}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rango de fechas</label>
                <CustomSelect
                  value={filters.preset}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange("preset", e.target.value)}
                  options={[
                    { value: "today", label: "Hoy" },
                    { value: "week", label: "Última semana" },
                    { value: "month", label: "Este mes" },
                    { value: "custom", label: "Rango personalizado" },
                  ]}
                />
              </div>

              {filters.preset === "custom" && (
                <>
                  <CustomInput
                    label="Fecha inicio"
                    type="date"
                    value={filters.date_from}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("date_from", e.target.value)}
                  />
                  <CustomInput
                    label="Fecha fin"
                    type="date"
                    value={filters.date_to}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("date_to", e.target.value)}
                  />
                </>
              )}

              <CustomSelect
                label="Método de pago"
                value={filters.method}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange("method", e.target.value)}
                options={[
                  { value: "", label: "Todos" },
                  { value: "cash", label: "Efectivo" },
                  { value: "card", label: "Tarjeta" },
                  { value: "transfer", label: "Transferencia" },
                  { value: "other", label: "Otro" },
                ]}
              />

              <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                <CustomButton variant="secondary" onClick={clearFilters} className="w-full">
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
                      <th className="pb-3 px-4">Mano de obra</th>
                      <th className="pb-3 px-4">Repuestos</th>
                      <th className="pb-3 px-4">Total</th>
                      <th className="pb-3 px-4">Método</th>
                      <th className="pb-3 px-4 hidden md:table-cell">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-500 font-mono">#{p.id}</td>
                        <td className="py-3 px-4">{formatDate(p.paid_at)}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">#{p.order_id}</td>
                        <td className="py-3 px-4 hidden md:table-cell">{p.order?.customer_name || ""}</td>
                        <td className="py-3 px-4 hidden lg:table-cell">{p.order?.vehicle_plate || ""}</td>
                        <td className="py-3 px-4 text-right">{formatCOP(p.labor_amount)}</td>
                        <td className="py-3 px-4 text-right">{formatCOP(p.parts_amount)}</td>
                        <td className="py-3 px-4 text-right font-bold text-brand-600">{formatCOP(p.total_amount)}</td>
                        <td className="py-3 px-4">{getMethodBadge(p.payment_method)}</td>
                        <td className="py-3 px-4 hidden md:table-cell text-slate-500">{p.reference || "-"}</td>
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