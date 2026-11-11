import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import { ArrowLeft, Filter, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Mail, MessageSquare, Clock, Loader2, MoreVertical, Search, Send } from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { api } from "@/services/api";
import { Layout } from "@/components/Layout";
import { withAuth } from "@/components/withAuth";

interface AdminTicketsPageProps {}

function AdminTicketsPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });

  // Filtros
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    date_from: "",
    date_to: "",
    search: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Modal detalle
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page: pagination.current_page,
        per_page: pagination.per_page,
        status: filters.status || undefined,
        category: filters.category || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        search: filters.search || undefined,
      };
      const response = await api.getTickets(params);
      if (response.body?.data) {
        setTickets(response.body.data);
        setPagination((prev) => ({ ...prev, ...response.body.pagination }));
      }
    } catch (error: any) {
      const detail = error?.body?.statusText || error?.message || "Error al cargar tickets";
      enqueueSnackbar(detail, { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current_page, pagination.per_page, filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ status: "", category: "", date_from: "", date_to: "", search: "" });
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  };

  const openTicketDetail = (ticket: any) => {
    setSelectedTicket(ticket);
    setReplyMessage("");
  };

  const closeTicketDetail = () => {
    setSelectedTicket(null);
    setReplyMessage("");
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsReplying(true);
    try {
      await api.replyTicket(selectedTicket.id, replyMessage.trim());
      enqueueSnackbar("Respuesta enviada", { variant: "success" });
      const fresh = await api.getTicket(selectedTicket.id);
      setSelectedTicket(fresh.body);
      setReplyMessage("");
    } catch (error: any) {
      const detail = error?.body?.statusText || error?.message || "Error al responder";
      enqueueSnackbar(detail, { variant: "error" });
    } finally {
      setIsReplying(false);
    }
  };

  const handleStatusChange = async (ticketId: number, newStatus: "abierto" | "en_proceso" | "cerrado") => {
    try {
      await api.updateTicket(ticketId, { status: newStatus });
      enqueueSnackbar(`Estado actualizado a ${newStatus}`, { variant: "success" });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        const fresh = await api.getTicket(ticketId);
        setSelectedTicket(fresh.body);
      }
    } catch (error: any) {
      const detail = error?.body?.statusText || error?.message || "Error al cambiar estado";
      enqueueSnackbar(detail, { variant: "error" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "abierto":
        return <CustomBadge variant="warning" dot>Abierto</CustomBadge>;
      case "en_proceso":
        return <CustomBadge variant="info" dot>En proceso</CustomBadge>;
      case "cerrado":
        return <CustomBadge variant="success" dot>Cerrado</CustomBadge>;
      default:
        return <CustomBadge variant="neutral">{status}</CustomBadge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "soporte":
        return <CustomBadge variant="info" className="text-xs">Soporte</CustomBadge>;
      case "sugerencia":
        return <CustomBadge variant="neutral" className="text-xs">Sugerencia</CustomBadge>;
      case "bug":
        return <CustomBadge variant="danger" className="text-xs">Bug</CustomBadge>;
      default:
        return <CustomBadge variant="neutral" className="text-xs">{category}</CustomBadge>;
    }
  };

  const formatDate = (dateStr: string) => {
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
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestion de Tickets</h1>
            <p className="mt-0.5 text-sm text-slate-500">Soporte, sugerencias y reportes de usuarios</p>
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("search", e.target.value)}
                  placeholder="Titulo, descripcion..."
                  className="input-field pl-10"
                />
              </div>
            </div>
            <CustomSelect
              label="Estado"
              value={filters.status}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange("status", e.target.value)}
              options={[
                { value: "", label: "Todos" },
                { value: "abierto", label: "Abierto" },
                { value: "en_proceso", label: "En proceso" },
                { value: "cerrado", label: "Cerrado" },
              ]}
            />
            <CustomSelect
              label="Categoria"
              value={filters.category}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange("category", e.target.value)}
              options={[
                { value: "", label: "Todas" },
                { value: "soporte", label: "Soporte" },
                { value: "sugerencia", label: "Sugerencia" },
                { value: "bug", label: "Bug" },
              ]}
            />
            <CustomInput
              label="Desde"
              type="date"
              value={filters.date_from}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("date_from", e.target.value)}
            />
            <CustomInput
              label="Hasta"
              type="date"
              value={filters.date_to}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("date_to", e.target.value)}
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

      {/* Lista de tickets */}
      <CustomCard>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 mx-auto text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">No hay tickets con los filtros actuales</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 px-4">Ticket</th>
                    <th className="pb-3 px-4">Usuario</th>
                    <th className="pb-3 px-4 hidden md:table-cell">Categoria</th>
                    <th className="pb-3 px-4">Estado</th>
                    <th className="pb-3 px-4 hidden lg:table-cell">Fecha</th>
                    <th className="pb-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-800 truncate max-w-xs">#{ticket.id} {ticket.title}</p>
                          <p className="text-xs text-slate-400 truncate max-w-xs">{ticket.description}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{ticket.user_name || `Usuario #${ticket.user_id}`}</p>
                        <p className="text-xs text-slate-400">{ticket.user_email}</p>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        {getCategoryBadge(ticket.category)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(ticket.status)}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-slate-500">
                        {formatDate(ticket.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openTicketDetail(ticket); }}
                          className="text-slate-400 hover:text-brand-600"
                          title="Ver detalle"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.last_page > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Mostrando {((pagination.current_page - 1) * pagination.per_page) + 1} a {Math.min(pagination.current_page * pagination.per_page, pagination.total)} de {pagination.total} tickets
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

      {/* Modal detalle ticket */}
      <CustomDialog
        open={!!selectedTicket}
        onClose={closeTicketDetail}
        title={`Ticket #${selectedTicket?.id}`}
        maxWidth="xl"
      >
        {selectedTicket && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Header del ticket */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-slate-800 truncate">#{selectedTicket.id} {selectedTicket.title}</h3>
                  {getCategoryBadge(selectedTicket.category)}
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span><strong>Usuario:</strong> {selectedTicket.user_name} ({selectedTicket.user_email})</span>
                  <span><strong>Creado:</strong> {formatDate(selectedTicket.created_at)}</span>
                  {selectedTicket.assigned_admin_name && (
                    <span><strong>Asignado a:</strong> {selectedTicket.assigned_admin_name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CustomSelect
                  value={selectedTicket.status}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleStatusChange(selectedTicket.id, e.target.value as any)}
                  options={[
                    { value: "abierto", label: "Abierto" },
                    { value: "en_proceso", label: "En proceso" },
                    { value: "cerrado", label: "Cerrado" },
                  ]}
                  className="w-40"
                />
              </div>
            </div>

            {/* Descripcion original */}
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Descripcion original</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{selectedTicket.description}</p>
            </div>

            {/* Historial de respuestas */}
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Historial ({selectedTicket.replies?.length || 0})
              </h4>
              {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                <div className="space-y-3">
                  {selectedTicket.replies.map((reply: any) => (
                    <div
                      key={reply.id}
                      className={`flex gap-3 rounded-xl p-4 ${reply.is_admin_reply ? "bg-blue-50 border-l-4 border-blue-500" : "bg-slate-50 border-l-4 border-slate-200"}`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: reply.is_admin_reply ? "#3b82f6" : "#64748b" }}>
                        {reply.user_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-slate-800">{reply.user_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${reply.is_admin_reply ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {reply.is_admin_reply ? "Admin" : "Usuario"}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">{formatDate(reply.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{reply.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Sin respuestas aun</p>
              )}
            </div>

            {/* Responder (solo admin) */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-sm font-bold text-slate-800 mb-3">Responder al ticket</h4>
              <div className="flex gap-3">
                <textarea
                  value={replyMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyMessage(e.target.value)}
                  rows={3}
                  className="flex-1 input-field resize-none"
                  placeholder="Escribe tu respuesta..."
                />
                <CustomButton
                  className="h-fit"
                  onClick={handleReply}
                  isLoading={isReplying}
                  disabled={isReplying || !replyMessage.trim()}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Enviar
                </CustomButton>
              </div>
            </div>
          </div>
        )}
      </CustomDialog>
    </div>
  </Layout>
  );
}

export default withAuth(AdminTicketsPage, { roles: ["admin"], redirectTo: "/login" });