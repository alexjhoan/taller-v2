import { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Loader2, AlertCircle, Filter } from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomInput } from '@/components/ui/CustomInput';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { useUsersMap, User as UserType } from '@/hooks/useUsers';
import { WorkOrder } from '@/hooks/useWorkOrders';
import { OrderCard } from '@/components/OrderCard';
import { toNumericIdArray } from '@/utils/ids';
import { countOrdersWithPendingParts, hasPendingParts } from '@/utils/parts';
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
  /**
   * RF-8 — Muestra el contador de órdenes con repuestos pendientes
   * junto al título. Solo lo pasa el dashboard admin; la vista del
   * técnico NO lo ve (por defecto false).
   */
  showPendingPartsCounter?: boolean;
}

export function WorkOrderList({
  orders,
  onSelectOrder,
  isLoading,
  error,
  isFetching,
  onRefresh,
  title = 'Lista de Órdenes',
  showPendingPartsCounter = false,
}: WorkOrderListProps) {
  const usersMap = useUsersMap();
  const [searchQuery, setSearchQuery] = useState('');
  // Filtro de estado: localStorage si ya hay selección, si no "En taller" (primera vez)
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    readStatusFilter(typeof window !== 'undefined' ? window.localStorage : null)
  );

  // Filtro de solicitudes pendientes - guarda el filtro anterior para restaurar
  const [pendingFilter, setPendingFilter] = useState<boolean>(false);
  const [previousStatusFilter, setPreviousStatusFilter] = useState<string>(statusFilter);

  // Toggle del filtro de pendientes
  const handlePendingFilterToggle = () => {
    if (!pendingFilter) {
      // Guardar filtro actual antes de activar filtro pendiente
      setPreviousStatusFilter(statusFilter);
      setPendingFilter(true);
    } else {
      // Restaurar filtro anterior
      setStatusFilter(previousStatusFilter);
      persistStatusFilter(typeof window !== 'undefined' ? window.localStorage : null, previousStatusFilter);
      setPendingFilter(false);
    }
  };

  // Cambiar filtro: persiste en localStorage y filtra la lista
  const handleStatusFilterChange = (value: string) => {
    // Si estamos en filtro pendiente y cambiamos manualmente el estado, salimos del filtro pendiente
    if (pendingFilter && value !== previousStatusFilter) {
      setPendingFilter(false);
    }
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

  // Filtro adicional: solo órdenes con repuestos pendientes
  const filteredOrders = pendingFilter
    ? visibleOrders.filter((o) => hasPendingParts(o))
    : visibleOrders;

  // RF-8 — Órdenes (de las ya cargadas por props) con al menos un
  // repuesto en "pending"; se recalcula solo al refrescar la lista.
  // Si el padre no lo pidió (vista del técnico) no se calcula ni se pinta.
  const pendingPartsCount = showPendingPartsCounter
    ? countOrdersWithPendingParts(orders)
    : 0;

  return (
    <CustomCard>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-sm font-bold text-slate-800'>{title}</h3>
          {/* RF-8 — Aviso al admin de solicitudes de repuesto pendientes.
              Con 0 no se muestra nada: no hay nada que actuar.
              Click para alternar filtro de pendientes. */}
          {showPendingPartsCounter && pendingPartsCount > 0 && (
            <CustomButton
              type='button'
              variant={pendingFilter ? 'primary' : 'secondary'}
              size='sm'
              leftIcon={<Filter className='h-3.5 w-3.5' />}
              onClick={handlePendingFilterToggle}
              className='whitespace-nowrap gap-1.5'
              title={pendingFilter
                ? `Quitar filtro y volver a "${ORDER_STATUS_OPTIONS.find(o => o.value === previousStatusFilter)?.label || 'Todos'}"`
                : `${pendingPartsCount === 1 ? '1 solicitud' : `${pendingPartsCount} solicitudes`} de repuesto pendiente${pendingPartsCount > 1 ? 's' : ''}`}
            >
              <span className="flex items-center gap-1">
                <span className="hidden sm:inline">{pendingPartsCount === 1 ? '1 solicitud' : `${pendingPartsCount} solicitudes`}</span>
                <span className="hidden sm:inline">de repuesto</span>
                <span className="hidden sm:inline">pendiente{pendingPartsCount > 1 ? 's' : ''}</span>
              </span>
            </CustomButton>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <select
            id='work-orders-status-filter'
            aria-label='Filtrar por estado'
            value={pendingFilter ? previousStatusFilter : statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className='input-field w-auto py-2'
            disabled={pendingFilter}
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
      ) : filteredOrders.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onSelect={onSelectOrder}
              dateLabel='created'
              assignedUsers={toNumericIdArray(order.assigned_user_id)
                .map((id) => usersMap.get(id))
                .filter((u): u is UserType => !!u)}
            />
          ))}
        </div>
      ) : (
        <div className='py-12 text-center'>
          <FileText className='mx-auto h-12 w-12 text-slate-300' />
          <p className='mt-3 text-sm font-medium text-slate-400'>
            {query
              ? 'No se encontraron órdenes'
              : pendingFilter
                ? 'No hay órdenes con solicitudes pendientes'
                : statusFilter !== ALL_STATUSES_VALUE && orders.length > 0
                  ? 'No hay órdenes con este estado'
                  : 'No hay órdenes de trabajo'}
          </p>
        </div>
      )}
    </CustomCard>
  );
}
