import { useEffect } from 'react';
import { useWorkOrders, WorkOrder } from '@/hooks/useWorkOrders';
import { useUserContext } from '@/context/UserContext';
import { WorkOrderList } from '@/components/WorkOrderList';
import { filterOrdersByAssignedUser } from '@/utils/orderFilters';

interface TechnicianOrderListProps {
  onSelectOrder: (order: WorkOrder) => void;
}

/**
 * Lista de órdenes del técnico: usa el MISMO componente unificado
 * que el dashboard admin (WorkOrderList); lo único que cambia es
 * que aquí solo llegan las órdenes asignadas al técnico actual.
 */
export function TechnicianOrderList({ onSelectOrder }: TechnicianOrderListProps) {
  const { data: workOrders, isLoading, error, refetch, isFetching } = useWorkOrders();
  const { user } = useUserContext();

  // Refrescar automáticamente al montar el componente
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Filtrar: solo órdenes asignadas al mecánico actual
  const myOrders = filterOrdersByAssignedUser(workOrders, user?.id);

  return (
    <WorkOrderList
      orders={myOrders}
      onSelectOrder={onSelectOrder}
      title='Órdenes de Trabajo'
      isLoading={isLoading}
      error={!!error}
      isFetching={isFetching}
      onRefresh={refetch}
    />
  );
}
