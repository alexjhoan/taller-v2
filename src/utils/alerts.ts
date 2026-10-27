import { Bell, Check, FileText, RefreshCw, Wrench, XCircle } from 'lucide-react';

/**
 * Tipos de alerta conocidos (nuevos de Spec 009 + legacy tolerado).
 * El backend emite estos valores exactos en `type`.
 */
export type AlertType =
  | 'order_created'
  | 'order_status_changed'
  | 'part_requested'
  | 'budget_accepted'
  | 'budget_rejected'
  | 'customer_decision' // legacy, ya existe en BD
  | string;              // fallback para tipos desconocidos futuros

/** Alerta tal como llega del backend (campos como string, tolerando null). */
export interface Alert {
  id: string;
  order_id: string | null;
  type: AlertType;
  message: string;
  read_at: string | null;
  created_at: string;
}

/**
 * Devuelve la etiqueta visible y el icono de Lucide para un tipo de alerta.
 * Cubre los 5 tipos nuevos + legacy `customer_decision` + desconocido.
 */
export function getAlertTypeInfo(type: AlertType): { label: string; icon: React.ComponentType<{ className?: string }> } {
  switch (type) {
    case 'order_created':
      return { label: 'Orden nueva', icon: FileText };
    case 'order_status_changed':
      return { label: 'Orden actualizada', icon: RefreshCw };
    case 'part_requested':
      return { label: 'Repuesto solicitado', icon: Wrench };
    case 'budget_accepted':
      return { label: 'Presupuesto aceptado', icon: Check };
    case 'budget_rejected':
      return { label: 'Ítems rechazados', icon: XCircle };
    case 'customer_decision':
      return { label: 'Decisión del cliente', icon: Bell };
    default:
      return { label: 'Notificación', icon: Bell };
  }
}

/**
 * Formatea la fecha de creación de la alerta a `dd/mm/aaaa hh:mm` (locale es-VE, 24h).
 * Acepta ISO (`2026-10-23T09:41:00.000Z`) o el formato MySQL (`2026-10-23 09:41:00`).
 * Si no se puede parsear, devuelve la cadena original como fallback seguro.
 */
export function formatAlertDate(createdAt: string): string {
  if (!createdAt) return '--/--/---- --:--';

  const date = new Date(createdAt.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return createdAt; // fallback: muestra lo que vino

  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formatea el contador de no leídas para el badge de la campana.
 * - 0 → `''` (vacío, el badge no se renderiza)
 * - 1–49 → el número como string
 * - ≥50 → `'50+'` (tope visible, no miente sobre el total real)
 */
export function formatUnreadCount(count: number): string {
  if (count <= 0) return '';
  if (count >= 50) return '50+';
  return String(count);
}

/**
 * Mapea un tipo de alerta al `variant` de `CustomBadge` para mantener
 * consistencia visual con el resto de la app.
 */
export function getAlertBadgeVariant(type: AlertType): 'brand' | 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  switch (type) {
    case 'order_created':
      return 'brand';
    case 'order_status_changed':
      return 'info';
    case 'part_requested':
      return 'warning';
    case 'budget_accepted':
      return 'success';
    case 'budget_rejected':
      return 'danger';
    case 'customer_decision':
      return 'neutral';
    default:
      return 'neutral';
  }
}