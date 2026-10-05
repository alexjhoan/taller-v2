import { useState } from 'react';
import { TechnicianOrderList } from '@/components/TechnicianOrderList';
import { TechnicianOrderDetail } from '@/components/TechnicianOrderDetail';
import { WorkOrder } from '@/hooks/useWorkOrders';

export function TechnicianOrderView() {
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  const handleSelectOrder = (order: WorkOrder) => {
    setSelectedOrder(order);
  };

  const handleBack = () => {
    setSelectedOrder(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      {selectedOrder === null ? (
        <TechnicianOrderList onSelectOrder={handleSelectOrder} />
      ) : (
        <TechnicianOrderDetail order={selectedOrder} onBack={handleBack} />
      )}
    </div>
  );
}
