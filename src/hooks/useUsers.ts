import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: 'admin' | 'mechanic';
  active: number;
  created_at: string;
}

interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<User[]>>(endpoints.users);
      return response.body;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: {
      first_name: string;
      last_name: string;
      email: string;
      password: string;
      phone: string;
      role: 'admin' | 'mechanic';
    }) => {
      const response = await api.post<ApiResponse<{ id: number }>>(endpoints.users, userData);
      return response.body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: {
      id: number;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      role?: 'admin' | 'mechanic';
    }) => {
      const response = await api.patch<ApiResponse<{ updated: boolean }>>(
        endpoints.users,
        userData
      );
      return response.body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, active }: { id: number; active: number }) => {
      const response = await api.patch<ApiResponse<{ updated: boolean }>>(
        endpoints.users,
        { id, active }
      );
      return response.body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
