import { useState, useEffect } from 'react';
import { TechnicianOrderList } from '@/components/TechnicianOrderList';
import { TechnicianOrderDetail } from '@/components/TechnicianOrderDetail';
import { WorkOrder } from '@/hooks/useWorkOrders';

export function TechnicianOrderView() {
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  // Manejar navegación atrás del navegador / gesto swipe
  useEffect(() => {
    const handlePopState = () => {
      if (selectedOrder) {
        setSelectedOrder(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedOrder]);

  const handleSelectOrder = (order: WorkOrder) => {
    setSelectedOrder(order);
    // Push a dummy state to enable back button navigation
    window.history.pushState({ detail: "order", id: order.id }, "", "");
  };

  const handleBack = () => {
    setSelectedOrder(null);
    window.history.back();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-8 sm:px-6">
      {selectedOrder === null ? (
        <TechnicianOrderList onSelectOrder={handleSelectOrder} />
      ) : (
        <TechnicianOrderDetail order={selectedOrder} onBack={handleBack} />
      )}
    </div>
  );
}
