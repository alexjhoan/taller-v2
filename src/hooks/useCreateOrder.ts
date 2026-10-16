import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';

interface CreateOrderPayload {
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
  /** Lista de repuestos serializada como JSON string (snake_case: name, quantity, unit_price) */
  parts?: string;
  /** ID del usuario asignado (null = no asignado) */
  assigned_user_id?: number | null;
}

interface CreateOrderResponseBody {
  id: number;
  token: string;
}

interface CreateOrderResponse {
  status: number;
  body: CreateOrderResponseBody;
  statusText: string;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const response = await api.post<CreateOrderResponse>(endpoints.orders, payload);
      return response.body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
