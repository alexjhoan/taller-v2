export interface AuditLogEntry {
  id: number;
  order_id: number;
  action: 'created' | 'edited' | 'status_changed' | 'delivered' | 'cancelled';
  user_id: number;
  user_name: string;
  user_role: string;
  changes: Record<string, { from: string; to: string }> | null;
  created_at: string;
}
