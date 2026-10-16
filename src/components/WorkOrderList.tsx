import { useState } from 'react';
import { FileText, Search, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomInput } from '@/components/ui/CustomInput';
import { CustomButton } from '@/components/ui/CustomButton';
import { useUsersMap } from '@/hooks/useUsers';
import { WorkOrder } from '@/hooks/useWorkOrders';
import { OrderCard } from '@/components/OrderCard';
import {
  ORDER_STATUS_OPTIONS,
  ALL_STATUSES_VALUE,
  readStatusFilter,
  persistStatusFilter,
  filterOrdersByStatus,
} from '@/utils/orderFilters';

// ============================================================
// Lista de órdenes UNIFICADA (admin y técnico).
// El padre decide qué órdenes llegan (admin: todas;
// técnico: solo las suyas con filterOrdersByAssignedUser);
// aquí vive lo común: filtro de estado (localStorage
// work_orders_status_filter), búsqueda, grid de OrderCard y
// estados de carga / error / vacío.
// ============================================================

interface WorkOrderListProps {
  /** Órdenes ya filtradas por el padre (todas en admin, asignadas en técnico). */
  orders: WorkOrder[];
  onSelectOrder: (order: WorkOrder) => void;
  /** React Query isLoading de useWorkOrders. */
  isLoading?: boolean;
  /** React Query error de useWorkOrders. */
  error?: boolean;
  /** React Query isFetching (refresco en curso). */
  isFetching?: boolean;
  /** Refresca la lista; si no se pasa, no se muestra el botón. */
  onRefresh?: () => void;
  title?: string;
}

export function WorkOrderList({
  orders,
  onSelectOrder,
  isLoading,
  error,
  isFetching,
  onRefresh,
  title = 'Lista de Órdenes',
}: WorkOrderListProps) {
  const usersMap = useUsersMap();
  const [searchQuery, setSearchQuery] = useState('');
  // Filtro de estado: localStorage si ya hay selección, si no "En taller" (primera vez)
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    readStatusFilter(typeof window !== 'undefined' ? window.localStorage : null)
  );

  // Cambiar filtro: persiste en localStorage y filtra la lista
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    persistStatusFilter(typeof window !== 'undefined' ? window.localStorage : null, value);
  };

  // Filtro de estado + búsqueda por placa o cliente
  const statusFiltered = filterOrdersByStatus(orders, statusFilter);
  const query = searchQuery.trim().toLowerCase();
  const visibleOrders = query
    ? statusFiltered.filter(
        (o) =>
          o.vehicle_plate.toLowerCase().includes(query) ||
          o.customer_name.toLowerCase().includes(query)
      )
    : statusFiltered;

  return (
    <CustomCard>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <h3 className='text-sm font-bold text-slate-800'>{title}</h3>
        <div className='flex items-center gap-2'>
          <select
            id='work-orders-status-filter'
            aria-label='Filtrar por estado'
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className='input-field w-auto py-2'
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {onRefresh && (
            <CustomButton
              type='button'
              variant='secondary'
              size='sm'
              leftIcon={<RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />}
              onClick={onRefresh}
              isLoading={isFetching}
            >
              Refrescar
            </CustomButton>
          )}
        </div>
      </div>

      {/* Búsqueda por placa o cliente */}
      <div className='relative mb-4'>
        <CustomInput
          placeholder='Buscar por placa o cliente...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='pr-10'
        />
        <Search className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
      </div>

      {/* Grid de órdenes */}
      {isLoading ? (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-6 w-6 animate-spin text-brand-600' />
          <span className='ml-2 text-sm text-slate-500'>Cargando órdenes...</span>
        </div>
      ) : error ? (
        <div className='flex items-center justify-center py-12 text-red-500'>
          <AlertCircle className='h-6 w-6' />
          <span className='ml-2 text-sm'>Error al cargar órdenes</span>
        </div>
      ) : visibleOrders.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onSelect={onSelectOrder}
              dateLabel='created'
              assignedUser={order.assigned_user_id ? (usersMap.get(order.assigned_user_id) ?? null) : null}
            />
          ))}
        </div>
      ) : (
        <div className='py-12 text-center'>
          <FileText className='mx-auto h-12 w-12 text-slate-300' />
          <p className='mt-3 text-sm font-medium text-slate-400'>
            {query
              ? 'No se encontraron órdenes'
              : statusFilter !== ALL_STATUSES_VALUE && orders.length > 0
                ? 'No hay órdenes con este estado'
                : 'No hay órdenes de trabajo'}
          </p>
        </div>
      )}
    </CustomCard>
  );
}
