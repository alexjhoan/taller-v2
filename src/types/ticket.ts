// src/types/ticket.ts
// Tipos para el sistema de tickets de soporte/sugerencias

export type TicketCategory = 'soporte' | 'sugerencia' | 'bug';
export type TicketStatus = 'abierto' | 'en_proceso' | 'cerrado';

export interface Ticket {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  created_at: string;
  updated_at: string;
  replies_count?: number;
  replies?: TicketReply[];
}

export interface TicketReply {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  category?: TicketCategory;
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  category?: TicketCategory;
  assigned_admin_id?: number | null;
}

export interface ReplyTicketPayload {
  message: string;
}

export interface TicketsListResponse {
  data: Ticket[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface TicketFilters {
  page?: number;
  per_page?: number;
  status?: TicketStatus;
  category?: TicketCategory;
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
  search?: string;
}