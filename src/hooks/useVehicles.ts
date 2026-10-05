import { useQuery } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';

export interface Vehicle {
  id: number;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  customer_id: number;
  status: string;
  created_at: string;
}

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Vehicle[]>>(endpoints.vehicles);
      return response.body;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useVehicleById(id: number) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Vehicle>>(
        `${endpoints.vehicles}?id=${id}`
      );
      return response.body;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
