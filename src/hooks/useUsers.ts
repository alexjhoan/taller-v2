import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, endpoints } from '@/services/api';
import { toNumericId } from '@/utils/ids';

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

/**
 * Mapa id → User para match O(1) con assigned_user_id (ahora un array de
 * IDs de mecánicos; se compara con toNumericIdArray / usersMap.get(id)).
 * React Query ya cachea la respuesta (staleTime 5 min), así que
 * funciona como un "contexto" de usuarios sin estado extra ni IndexedDB.
 */
export function useUsersMap() {
  const { data: users } = useUsers();
  return useMemo(() => {
    const map = new Map<number, User>();
    users?.forEach((u) => {
      // El backend puede devolver id como string ("3"); la clave debe ser
      // numérica para que usersMap.get(id) coincida con los IDs del array
      // normalizado de assigned_user_id (toNumericIdArray).
      const id = toNumericId(u.id);
      if (id !== null) map.set(id, u);
    });
    return map;
  }, [users]);
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
