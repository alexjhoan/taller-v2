import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FileText, Search, RefreshCw, Loader2, AlertCircle, Calendar } from "lucide-react";
import { withAuth } from "@/components/withAuth";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomInput } from "@/components/ui/CustomInput";
import { Layout } from "@/components/Layout";
import { useDeliveredOrders } from "@/hooks/useDeliveredOrders";
import { WorkOrder } from "@/hooks/useWorkOrders";
import { useUsersMap, User as UserType } from "@/hooks/useUsers";
import { toNumericIdArray } from "@/utils/ids";
import { AdminOrderDetailReadOnly } from "@/components/AdminOrderDetailReadOnly";
import { OrderCard } from "@/components/OrderCard";

function AdminHistoryPage() {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fecha, setFecha] = useState("");

  const { data: orders, isLoading, error, refetch, isFetching } = useDeliveredOrders(fecha || undefined);
  const usersMap = useUsersMap();

  // Refrescar automáticamente al montar el componente
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Sincronizar URL cuando se selecciona una orden (para router.back() desde order-log)
  useEffect(() => {
    if (selectedOrder) {
      router.push(`/admin/history?selectedOrderId=${selectedOrder.id}`, undefined, { shallow: true });
    }
  }, [selectedOrder]);

  // Restaurar selección desde URL (cuando se vuelve de order-log)
  useEffect(() => {
    const { selectedOrderId } = router.query;
    if (selectedOrderId && orders) {
      const order = orders.find((o) => o.id === Number(selectedOrderId));
      if (order) setSelectedOrder(order);
    }
  }, [router.query, orders]);

  const filteredOrders =
    orders?.filter(
      (o) =>
        o.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  // Si hay una orden seleccionada, mostrar el detalle de solo lectura
  if (selectedOrder !== null) {
    return (
      <Layout>
        <div className='mx-auto max-w-4xl p-6'>
          <AdminOrderDetailReadOnly order={selectedOrder} onBack={() => setSelectedOrder(null)} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='mx-auto max-w-4xl space-y-6 p-6 pb-8'>
        {/* Header */}
        <div>
          <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>Historial de Órdenes Entregadas</h1>
          <p className='mt-1 text-sm text-slate-500'>Consulta el historial completo de órdenes entregadas</p>
        </div>

        {/* Filtros */}
        <CustomCard>
          <div className='flex flex-col gap-4 md:flex-row md:items-end'>
            {/* Búsqueda por placa o cliente */}
            <div className='min-w-0 flex-1'>
              <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Buscar por placa o cliente</label>
              <div className='relative'>
                <CustomInput
                  placeholder='ABC123 o nombre...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pr-10'
                />
                <Search className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
              </div>
            </div>

            {/* Filtro por fecha */}
            <div>
              <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Fecha de creación</label>
              <div className='relative'>
                <input
                  type='date'
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className='input-field pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0'
                />
                <Calendar className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
              </div>
            </div>

            {/* Botón refrescar */}
            <CustomButton
              type='button'
              variant='secondary'
              leftIcon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              Refrescar
            </CustomButton>
          </div>
        </CustomCard>

        {/* Lista de órdenes */}
        <CustomCard>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-6 w-6 animate-spin text-brand-600' />
              <span className='ml-2 text-sm text-slate-500'>Cargando historial...</span>
            </div>
          ) : error ? (
            <div className='flex items-center justify-center py-12 text-red-500'>
              <AlertCircle className='h-6 w-6' />
              <span className='ml-2 text-sm'>Error al cargar el historial</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className='py-12 text-center'>
              <FileText className='mx-auto h-12 w-12 text-slate-300' />
              <p className='mt-3 text-sm font-medium text-slate-400'>
                {fecha || searchQuery ? "No se encontraron órdenes con estos filtros" : "No hay órdenes entregadas"}
              </p>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onSelect={setSelectedOrder}
                  dateLabel='finished'
                  assignedUsers={toNumericIdArray(order.assigned_user_id)
                    .map((id) => usersMap.get(id))
                    .filter((u): u is UserType => !!u)}
                />
              ))}
            </div>
          )}
        </CustomCard>
      </div>
    </Layout>
  );
}

export default withAuth(AdminHistoryPage, {
  roles: ["admin"],
  redirectTo: "/login",
});
