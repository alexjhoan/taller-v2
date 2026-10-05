import { ReactNode, createContext, useContext, useState } from 'react';
import type { WorkOrder } from '@/types';

interface WorkshopContextType {
  activeOrder: WorkOrder | null;
  setActiveOrder: (order: WorkOrder | null) => void;
  orders: WorkOrder[];
  setOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
}

const initialContext: WorkshopContextType = {
  activeOrder: null,
  setActiveOrder: () => {},
  orders: [],
  setOrders: () => {},
};

const WorkshopContext = createContext<WorkshopContextType>(initialContext);

export function WorkshopProvider({ children }: { children: ReactNode }) {
  const [activeOrder, setActiveOrder] = useState<WorkOrder | null>(null);
  const [orders, setOrders] = useState<WorkOrder[]>([]);

  const globalState: WorkshopContextType = {
    activeOrder,
    setActiveOrder,
    orders,
    setOrders,
  };

  return (
    <WorkshopContext.Provider value={globalState}>
      {children}
    </WorkshopContext.Provider>
  );
}

export const useWorkshopContext = () => useContext(WorkshopContext);
