import { useQuery } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';

export interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
}

export interface PartItem {
  id: string;
  name: string;
  reference: string;
  quantity: number;
  unit_price?: number;
  criticality: string;
  approvalStatus: string;
  requestedByTechnician: boolean;
  notes?: string;
}

export interface WorkOrder {
  id: number;
  public_token: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  mileage: number;
  fuel_level: string;
  failure_description: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  withdrawal_comment: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  checklist?: ChecklistItem[] | string;
  parts?: PartItem[] | string;
}

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

export function parseWorkOrder(order: WorkOrder): WorkOrder {
  return {
    ...order,
    checklist: typeof order.checklist === 'string' ? JSON.parse(order.checklist) : order.checklist,
    parts: typeof order.parts === 'string' ? JSON.parse(order.parts) : order.parts,
  };
}

export function useWorkOrders() {
  return useQuery({
    queryKey: ['work_orders'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<WorkOrder[]>>(endpoints.orders);
      return response.body.map(parseWorkOrder);
    },
    staleTime: 1000 * 60 * 5,
  });
}
