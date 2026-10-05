import { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { withAuth } from '@/components/withAuth';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomInput } from '@/components/ui/CustomInput';
import { Layout } from '@/components/Layout';
import { useDeliveredOrders } from '@/hooks/useDeliveredOrders';
import { WorkOrder } from '@/hooks/useWorkOrders';
import { AdminOrderDetailReadOnly } from '@/components/AdminOrderDetailReadOnly';

function AdminHistoryPage() {
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fecha, setFecha] = useState('');

  const { data: orders, isLoading, error, refetch, isFetching } = useDeliveredOrders(fecha || undefined);

  // Refrescar automáticamente al montar el componente
  useEffect(() => {
    refetch();
  }, [refetch]);

  const getOrderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
      received: { label: 'Recibido', variant: 'info' },
      diagnosing: { label: 'Diagnóstico', variant: 'warning' },
      awaiting_approval: { label: 'Esperando aprobación', variant: 'warning' },
      approved: { label: 'Aprobado', variant: 'success' },
      in_progress: { label: 'En taller', variant: 'info' },
      ready: { label: 'Listo', variant: 'success' },
      delivered: { label: 'Entregado', variant: 'success' },
      cancelled: { label: 'Cancelado', variant: 'danger' },
    };
    const config = statusMap[status] || { label: status, variant: 'neutral' as const };
    return <CustomBadge variant={config.variant} dot>{config.label}</CustomBadge>;
  };

  const filteredOrders = orders?.filter(
    (o) =>
      o.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Si hay una orden seleccionada, mostrar el detalle de solo lectura
  if (selectedOrder !== null) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl p-6">
          <AdminOrderDetailReadOnly order={selectedOrder} onBack={() => setSelectedOrder(null)} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 p-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Historial de Órdenes Entregadas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta el historial completo de órdenes entregadas
          </p>
        </div>

        {/* Filtros */}
        <CustomCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Búsqueda por placa o cliente */}
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Buscar por placa o cliente
              </label>
              <div className="relative">
                <CustomInput
                  placeholder="ABC123 o nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-9 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Filtro por fecha */}
            <div className="sm:w-48">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Fecha de creación
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="input-field"
                />
                <Calendar className="absolute right-3 top-9 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Botón refrescar */}
            <CustomButton
              type="button"
              variant="secondary"
              leftIcon={<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />}
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              <span className="ml-2 text-sm text-slate-500">Cargando historial...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="h-6 w-6" />
              <span className="ml-2 text-sm">Error al cargar el historial</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-400">
                {fecha || searchQuery
                  ? 'No se encontraron órdenes con estos filtros'
                  : 'No hay órdenes entregadas'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Placa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Vehículo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">#{order.id}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{order.vehicle_plate}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.vehicle_make} {order.vehicle_model}
                      </td>
                      <td className="px-4 py-3">
                        {getOrderStatusBadge(order.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CustomCard>
      </div>
    </Layout>
  );
}

export default withAuth(AdminHistoryPage, {
  roles: ['admin'],
  redirectTo: '/login',
});
