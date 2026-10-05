import { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw } from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomInput } from '@/components/ui/CustomInput';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomButton } from '@/components/ui/CustomButton';
import { useWorkOrders, WorkOrder } from '@/hooks/useWorkOrders';

interface TechnicianOrderListProps {
  onSelectOrder: (order: WorkOrder) => void;
}

export function TechnicianOrderList({ onSelectOrder }: TechnicianOrderListProps) {
  const { data: workOrders, isLoading, refetch, isFetching } = useWorkOrders();
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredOrders = workOrders?.filter(
    (o) =>
      o.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <CustomCard>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <FileText className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Órdenes de Trabajo</h2>
        </div>
        <CustomButton
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />}
          onClick={() => refetch()}
          isLoading={isFetching}
        >
          Refrescar
        </CustomButton>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <CustomInput
          placeholder="Buscar por placa o cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Search className="absolute right-3 top-9 h-4 w-4 text-slate-400" />
      </div>

      {/* Lista de órdenes */}
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="animate-pulse text-sm text-slate-400">Cargando órdenes...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-400">
            {searchQuery ? 'No se encontraron órdenes' : 'No hay órdenes de trabajo'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 text-left transition-all hover:border-slate-200 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">
                  #{order.id} — {order.vehicle_plate}
                </p>
                <p className="text-xs text-slate-400">
                  {order.customer_name} · {order.vehicle_make} {order.vehicle_model}
                </p>
              </div>
              {getOrderStatusBadge(order.status)}
            </button>
          ))}
        </div>
      )}
    </CustomCard>
  );
}
