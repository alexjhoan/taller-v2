import type { Vehicle } from '@/hooks/useVehicles';
import type { User } from '@/hooks/useUsers';

// --- Vehículos ---

export function filterVehiclesByStatus(vehicles: Vehicle[], status: string): Vehicle[] {
  if (!status || status === 'all') return vehicles;
  return vehicles.filter((v) => v.status === status);
}

export function searchVehiclesByPlate(vehicles: Vehicle[], query: string): Vehicle[] {
  if (!query.trim()) return vehicles;
  const q = query.toLowerCase();
  return vehicles.filter((v) => v.plate.toLowerCase().includes(q));
}

export function paginateList<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

// --- Usuarios ---

export function isEmailUnique(users: User[], email: string, excludeId?: number): boolean {
  return !users.some((u) => u.email === email && u.id !== excludeId);
}

export function sortUsersByName(users: User[]): User[] {
  return [...users].sort((a, b) => a.first_name.localeCompare(b.first_name));
}

// --- Formatters ---

export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    received: 'Recibido',
    diagnosing: 'Diagnóstico',
    awaiting_approval: 'Esperando aprobación',
    approved: 'Aprobado',
    in_progress: 'En taller',
    ready: 'Listo',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const colors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    received: 'info',
    diagnosing: 'warning',
    awaiting_approval: 'warning',
    approved: 'success',
    in_progress: 'info',
    ready: 'success',
    delivered: 'success',
    cancelled: 'danger',
  };
  return colors[status] || 'neutral';
}
