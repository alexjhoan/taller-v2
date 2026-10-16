import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { TechnicianOrderList } from "@/components/TechnicianOrderList";
import { TechnicianOrderDetail } from "@/components/TechnicianOrderDetail";
import { WorkOrder, useWorkOrders } from "@/hooks/useWorkOrders";

export function TechnicianOrderView() {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const { data: workOrders } = useWorkOrders();

  const handleSelectOrder = (order: WorkOrder) => {
    setSelectedOrder(order);
    // Sincronizar URL para que router.back() funcione correctamente
    router.push(`/technician/order?selectedOrderId=${order.id}`, undefined, { shallow: true });
  };

  const handleBack = () => {
    setSelectedOrder(null);
    router.back();
  };

  // Restaurar selección desde URL (cuando se vuelve de order-log o navegación atrás)
  useEffect(() => {
    const { selectedOrderId } = router.query;
    if (selectedOrderId && workOrders) {
      const order = workOrders.find((o) => o.id == Number(selectedOrderId));
      if (order) setSelectedOrder(order);
    } else if (!selectedOrderId) {
      setSelectedOrder(null);
    }
  }, [router.query, workOrders]);

  return (
    <div className='mx-auto max-w-4xl space-y-6 px-4 pb-8 sm:px-6'>
      {selectedOrder === null ? (
        <TechnicianOrderList onSelectOrder={handleSelectOrder} />
      ) : (
        <TechnicianOrderDetail order={selectedOrder} onBack={handleBack} />
      )}
    </div>
  );
}
