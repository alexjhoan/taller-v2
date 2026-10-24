// ============================================================
// Filtro de estado de órdenes (unificado admin + técnico)
// (persistencia en localStorage + filtrado de la lista)
// ============================================================

import { toNumericIdArray } from '@/utils/ids';

/**
 * Clave en localStorage para la selección del filtro de estado.
 * Compartida entre el dashboard admin y la vista del técnico:
 * el mismo componente (WorkOrderList) usa la misma preferencia.
 */
export const STATUS_FILTER_STORAGE_KEY = 'work_orders_status_filter';

/** Valor por defecto la primera vez que se carga (sin selección guardada). */
export const DEFAULT_STATUS_FILTER = 'in_progress';

/** Valor del primer item del select: "Todos" (sin filtro). */
export const ALL_STATUSES_VALUE = 'all';

export interface OrderStatusOption {
  value: string;
  label: string;
}

/** Opciones del select, en el orden del flujo de la OT. */
export const ORDER_STATUS_OPTIONS: OrderStatusOption[] = [
  { value: ALL_STATUSES_VALUE, label: 'Todos' },
  { value: 'received', label: 'Recibido' },
  { value: 'diagnosing', label: 'Diagnóstico' },
  { value: 'awaiting_approval', label: 'Esperando aprobación' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'in_progress', label: 'En taller' },
  { value: 'ready', label: 'Listo' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const VALID_STATUS_VALUES = new Set(ORDER_STATUS_OPTIONS.map((o) => o.value));

/**
 * Opciones para el select de CAMBIO de estado (detalle de la orden):
 * los mismos estados del filtro, sin el "Todos" ('all').
 */
export const ORDER_STATUS_SELECT_OPTIONS: OrderStatusOption[] = ORDER_STATUS_OPTIONS.filter(
  (o) => o.value !== ALL_STATUSES_VALUE
);

/** Mínimo de Storage usado para poder testear sin navegador. */
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Lee la selección persistida en localStorage.
 * Si no hay nada guardado (primera visita) o el valor no es válido,
 * devuelve DEFAULT_STATUS_FILTER ('in_progress').
 * Nunca lanza: acepta storage null (SSR) o que lance (modo privado).
 */
export function readStatusFilter(storage: StorageLike | null | undefined): string {
  if (!storage) return DEFAULT_STATUS_FILTER;
  try {
    const stored = storage.getItem(STATUS_FILTER_STORAGE_KEY);
    if (stored && VALID_STATUS_VALUES.has(stored)) return stored;
    return DEFAULT_STATUS_FILTER;
  } catch {
    return DEFAULT_STATUS_FILTER;
  }
}

/** Guarda la selección actual en localStorage. Nunca lanza. */
export function persistStatusFilter(storage: StorageLike | null | undefined, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(STATUS_FILTER_STORAGE_KEY, value);
  } catch {
    // sin persistencia disponible: el filtro sigue funcionando en memoria
  }
}

/**
 * Filtra workOrders por estado. 'all' (Todos) → sin filtro.
 * Acepta undefined/null porque los datos de React Query llegan después del render.
 */
export function filterOrdersByStatus<T extends { status: string }>(
  orders: T[] | null | undefined,
  status: string
): T[] {
  if (!orders) return [];
  if (!status || status === ALL_STATUSES_VALUE) return orders;
  return orders.filter((o) => o.status === status);
}

/**
 * Filtra las órdenes asignadas al usuario (vista del técnico);
 * ahora assigned_user_id es un array de IDs de mecánicos y se filtra
 * por inclusión (el técnico ve todas las órdenes donde participa).
 * toNumericIdArray tolera JSON string ("[3,5]"), array o FK legacy ("3").
 * Sin userId (null/undefined) → lista vacía: no se muestran órdenes ajenas.
 */
export function filterOrdersByAssignedUser<T extends { assigned_user_id: number[] | number | null | string }>(
  orders: T[] | null | undefined,
  userId: number | null | undefined
): T[] {
  if (!orders || userId === null || userId === undefined) return [];
  return orders.filter((o) => toNumericIdArray(o.assigned_user_id).includes(userId));
}
