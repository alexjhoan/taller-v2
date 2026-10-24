// ============================================================
// Mecaflow Workshop OS — Tipos TypeScript estrictos
// ============================================================

// --- Enums / Union Types ---

export type OrderStatus =
  | 'received'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'approved'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type FuelLevel = 'E' | '1/4' | '1/2' | '3/4' | 'F';

export type PartApprovalStatus = 'accepted' | 'pending' | 'rejected';

export type PartCriticality = 'critical' | 'preventive' | 'recommended';

export type BudgetItemType = 'labor' | 'part';

export type CustomerDecision = 'pending' | 'accepted' | 'rejected';

export type EvidenceType = 'photo' | 'audio' | 'video';

export type ChecklistCategory =
  | 'FRENOS'
  | 'DIAGNOSTICO'
  | 'MANTENIMIENTO'
  | 'SUSPENSION'
  | 'ELECTRICO';

export type ChecklistPriority = 'ALTA' | 'MEDIA' | 'BAJA';

// --- Interfaces ---

export interface Customer {
  id: string;
  name: string;
  documentType: 'CC' | 'NIT' | 'CE' | 'PASAPORTE';
  documentNumber: string;
  phoneWhatsapp: string;
  email: string;
  isFrequentOrFleet: boolean;
}

export interface Vehicle {
  plate: string;
  city: string;
  brandLine: string;
  year: number;
  color: string;
  odometer: number;
  fuelLevel: FuelLevel;
}

export interface WorkChecklistItem {
  id: string;
  title: string;
  category: ChecklistCategory;
  estimatedMinutes?: number;
  priority: ChecklistPriority;
  completed: boolean;
}

export interface RequiredPart {
  id: string;
  name: string;
  reference: string;
  quantity: number;
  unitPriceCOP: number;
  criticality: PartCriticality;
  approvalStatus: PartApprovalStatus;
  requestedByTechnician: boolean;
  notes?: string;
}

export interface PhotoEvidence {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  criticality: 'critical' | 'recommended' | 'informative';
  timestamp: string;
  metricComparison?: {
    measured: string;
    safeMinimum: string;
    percentageWear: number;
  };
  linkedPartId?: string;
}

export interface AudioEvidence {
  id: string;
  title: string;
  audioUrl: string;
  duration: string;
  transcription?: string;
  timestamp: string;
}

export interface BudgetItem {
  id: string;
  type: BudgetItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  customerDecision: CustomerDecision;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;
  customer: Customer;
  vehicle: Vehicle;
  status: OrderStatus;
  entryReason: string;
  audioNoteUrl?: string;
  audioDuration?: string;
  audioTranscription?: string;
  checklist: WorkChecklistItem[];
  requiredParts: RequiredPart[];
  laborCostCOP: number;
  taxRate: number;
  assignedBay: string;
  assignedTechnician: {
    id: string;
    name: string;
    specialty: string;
    avatarUrl?: string;
  };
  publicToken: string;
}

// --- API Response Types (snake_case) ---

export interface ApiWorkOrder {
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
  status: OrderStatus;
  started_at: string | null;
  finished_at: string | null;
  withdrawal_comment: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ApiBudgetItem {
  id: number;
  order_id: number;
  type: BudgetItemType;
  description: string;
  quantity: string;
  unit_price: string;
  supplier_cost?: string;
  customer_decision: CustomerDecision;
  created_at: string;
}

export interface ApiEvidence {
  id: number;
  order_id: number;
  type: EvidenceType;
  file_url: string;
  uploaded_by: number;
  created_at: string;
}

export interface ApiResponse<T> {
  status: number;
  body: T;
  statusText: string;
  total?: number;
}

// --- Form / Component State Types ---

export interface ReceptionFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  mileage: string;
  fuelLevel: FuelLevel;
  failureDescription: string;
  checklist: WorkChecklistItem[];
  hideCostsFromTechnicians: boolean;
}

export interface TechnicianPartRequest {
  name: string;
  reference: string;
  quantity: number;
  notes?: string;
}

export interface QuotationDecision {
  itemId: string;
  decision: CustomerDecision;
}

// --- Utility Types ---

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}
