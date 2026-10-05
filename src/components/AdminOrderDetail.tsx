import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  ArrowLeft,
  Save,
  X,
  Car,
  User,
  FileText,
  ClipboardList,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomInput } from '@/components/ui/CustomInput';
import { CustomDialog } from '@/components/ui/CustomDialog';
import { WorkOrder } from '@/hooks/useWorkOrders';
import { useApiClient } from '@/services/apiClient';
import { endpoints } from '@/services/api';
import { formatCOP } from '@/utils/currency';

// --- Tipos ---

interface OrderFormData {
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  failure_description: string;
  mileage: string;
  fuel_level: string;
}

interface PartItem {
  id: string;
  name: string;
  reference: string;
  quantity: number;
  unit_price?: number;
  criticality: string;
  approvalStatus: string;
  requestedByTechnician: boolean;
  notes?: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
}

// --- Componente ---

interface AdminOrderDetailProps {
  order: WorkOrder;
  onBack: () => void;
}

export function AdminOrderDetail({ order, onBack }: AdminOrderDetailProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<OrderFormData | null>(null);
  const [originalData, setOriginalData] = useState<OrderFormData | null>(null);
  const [parts, setParts] = useState<PartItem[]>(Array.isArray(order.parts) ? order.parts : []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(Array.isArray(order.checklist) ? order.checklist : []);
  const [isSaving, setIsSaving] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<PartItem | null>(null);
  const [editingCheckItem, setEditingCheckItem] = useState<ChecklistItem | null>(null);
  const [newPart, setNewPart] = useState({ name: '', reference: '', quantity: 1, notes: '' });
  const [newCheckItem, setNewCheckItem] = useState({ title: '', category: 'DIAGNOSTICO', priority: 'MEDIA' });

  const orderStatuses = [
    { value: 'received', label: 'Recibido' },
    { value: 'diagnosing', label: 'Diagnóstico' },
    { value: 'awaiting_approval', label: 'Esperando aprobación' },
    { value: 'approved', label: 'Aprobado' },
    { value: 'in_progress', label: 'En taller' },
    { value: 'ready', label: 'Listo' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' },
  ];

  useEffect(() => {
    const data: OrderFormData = {
      vehicle_plate: order.vehicle_plate,
      vehicle_make: order.vehicle_make,
      vehicle_model: order.vehicle_model,
      vehicle_year: order.vehicle_year.toString(),
      vehicle_color: (order as { vehicle_color?: string }).vehicle_color || '',
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      status: order.status,
      failure_description: order.failure_description,
      mileage: order.mileage.toString(),
      fuel_level: order.fuel_level,
    };
    setFormData(data);
    setOriginalData(data);
  }, [order]);

  const handleChange = (field: keyof OrderFormData, value: string) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: value });
  };

  const handleCancel = () => {
    if (originalData) {
      setFormData(originalData);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    setIsSaving(true);

    try {
      const payload = {
        id: order.id,
        vehicle_plate: formData.vehicle_plate,
        vehicle_make: formData.vehicle_make,
        vehicle_model: formData.vehicle_model,
        vehicle_year: parseInt(formData.vehicle_year, 10) || 0,
        vehicle_color: formData.vehicle_color,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        status: formData.status,
        failure_description: formData.failure_description,
        mileage: parseInt(formData.mileage, 10) || 0,
        fuel_level: formData.fuel_level,
        parts: JSON.stringify(parts),
        checklist: JSON.stringify(checklist),
      };

      await apiClient.patch(endpoints.orders, payload, {
        successMessage: 'Cambios guardados exitosamente',
      });

      setOriginalData(formData);
      // Invalidar la query para que la lista se actualice
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
    } catch (error) {
      // El error ya se muestra globalmente
    } finally {
      setIsSaving(false);
    }
  };

  // --- Part handlers ---

  const handleAddPart = async () => {
    if (!newPart.name.trim()) return;

    const newPartItem: PartItem = {
      id: crypto.randomUUID(),
      name: newPart.name.trim(),
      reference: newPart.reference.trim() || 'N/A',
      quantity: newPart.quantity,
      criticality: 'preventive',
      approvalStatus: 'pending',
      requestedByTechnician: false,
      notes: newPart.notes.trim() || undefined,
    };

    setParts([...parts, newPartItem]);
    setNewPart({ name: '', reference: '', quantity: 1, notes: '' });
    setIsPartModalOpen(false);
  };

  const handleEditPart = (part: PartItem) => {
    setEditingPart(part);
    setNewPart({
      name: part.name,
      reference: part.reference,
      quantity: part.quantity,
      notes: part.notes || '',
    });
    setIsPartModalOpen(true);
  };

  const handleUpdatePart = async () => {
    if (!editingPart || !newPart.name.trim()) return;

    const updatedParts = parts.map((p) =>
      p.id === editingPart.id
        ? {
            ...p,
            name: newPart.name.trim(),
            reference: newPart.reference.trim() || 'N/A',
            quantity: newPart.quantity,
            notes: newPart.notes.trim() || undefined,
          }
        : p
    );

    setParts(updatedParts);
    setEditingPart(null);
    setNewPart({ name: '', reference: '', quantity: 1, notes: '' });
    setIsPartModalOpen(false);
  };

  const handleDeletePart = (partId: string) => {
    setParts(parts.filter((p) => p.id !== partId));
  };

  // --- Checklist handlers ---

  const handleAddCheckItem = async () => {
    if (!newCheckItem.title.trim()) return;

    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      title: newCheckItem.title.trim(),
      category: newCheckItem.category,
      priority: newCheckItem.priority,
      completed: false,
    };

    setChecklist([...checklist, newItem]);
    setNewCheckItem({ title: '', category: 'DIAGNOSTICO', priority: 'MEDIA' });
    setIsChecklistModalOpen(false);
  };

  const handleEditCheckItem = (item: ChecklistItem) => {
    setEditingCheckItem(item);
    setNewCheckItem({
      title: item.title,
      category: item.category,
      priority: item.priority,
    });
    setIsChecklistModalOpen(true);
  };

  const handleUpdateCheckItem = async () => {
    if (!editingCheckItem || !newCheckItem.title.trim()) return;

    const updatedChecklist = checklist.map((item) =>
      item.id === editingCheckItem.id
        ? {
            ...item,
            title: newCheckItem.title.trim(),
            category: newCheckItem.category,
            priority: newCheckItem.priority,
          }
        : item
    );

    setChecklist(updatedChecklist);
    setEditingCheckItem(null);
    setNewCheckItem({ title: '', category: 'DIAGNOSTICO', priority: 'MEDIA' });
    setIsChecklistModalOpen(false);
  };

  const toggleCheckItem = (itemId: string) => {
    setChecklist(
      checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleDeleteCheckItem = (itemId: string) => {
    setChecklist(checklist.filter((item) => item.id !== itemId));
  };

  // --- Contact handlers ---

  const handleWhatsAppClick = () => {
    const phone = order.customer_phone.replace(/\D/g, '');
    const message = `Hola ${order.customer_name}, te escribimos del taller Mecaflow. Para revisar tu orden, presupuesto y progreso de tu vehículo visita este link: http://localhost:3000/portal?token=${order.public_token}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    // TODO: Implementar llamada al endpoint POST /api/orders/{id}/send-email
    // Por ahora, solo mostrar snackbar simulado
    enqueueSnackbar('Correo enviado', { variant: 'success' });
  };

  const getOrderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
      received: { label: 'Recibido', variant: 'info' },
      diagnosing: { label: 'Diagnóstico', variant: 'warning' },
      awaiting_approval: { label: 'Esperando aprobación', variant: 'warning' },
      approved: { label: 'Aprobado', variant: 'success' },
      in_progress: { label: 'En taller', variant: 'info' },
      ready: { label: 'Listo', variant: 'success' },
      delivered: { label: 'Entregado', variant: 'success' },
      cancelled: { label: 'Cancelado', variant: 'danger' },
    };
    const config = statusMap[status] || { label: status, variant: 'neutral' as const };
    return <CustomBadge variant={config.variant} dot>{config.label}</CustomBadge>;
  };

  const getPartStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <CustomBadge variant="success" dot>Aprobado</CustomBadge>;
      case 'pending':
        return <CustomBadge variant="warning" dot>Pendiente</CustomBadge>;
      case 'rejected':
        return <CustomBadge variant="danger" dot>Rechazado</CustomBadge>;
      default:
        return <CustomBadge variant="neutral">{status}</CustomBadge>;
    }
  };

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-sm text-slate-400">Cargando orden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CustomButton variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
            Volver
          </CustomButton>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Orden #{order.id}
            </h1>
            <p className="text-sm text-slate-500">
              Creada: {new Date(order.created_at).toLocaleDateString('es-CO')}
            </p>
          </div>
        </div>
        {getOrderStatusBadge(formData.status)}
      </div>

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <Car className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Vehículo</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <CustomInput
            label="Placa"
            value={formData.vehicle_plate}
            onChange={(e) => handleChange('vehicle_plate', e.target.value)}
          />
          <CustomInput
            label="Marca"
            value={formData.vehicle_make}
            onChange={(e) => handleChange('vehicle_make', e.target.value)}
          />
          <CustomInput
            label="Modelo"
            value={formData.vehicle_model}
            onChange={(e) => handleChange('vehicle_model', e.target.value)}
          />
          <CustomInput
            label="Año"
            type="number"
            value={formData.vehicle_year}
            onChange={(e) => handleChange('vehicle_year', e.target.value)}
          />
          <CustomInput
            label="Color"
            value={formData.vehicle_color}
            onChange={(e) => handleChange('vehicle_color', e.target.value)}
          />
          <CustomInput
            label="Odómetro (km)"
            type="number"
            value={formData.mileage}
            onChange={(e) => handleChange('mileage', e.target.value)}
          />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Combustible
            </label>
            <select
              value={formData.fuel_level}
              onChange={(e) => handleChange('fuel_level', e.target.value)}
              className="input-field"
            >
              <option value="E">Vacío (E)</option>
              <option value="1/4">1/4</option>
              <option value="1/2">1/2</option>
              <option value="3/4">3/4</option>
              <option value="F">Lleno (F)</option>
            </select>
          </div>
        </div>
      </CustomCard>

      {/* Datos del Cliente */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Cliente</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CustomInput
            label="Nombre"
            value={formData.customer_name}
            onChange={(e) => handleChange('customer_name', e.target.value)}
          />
          <CustomInput
            label="Teléfono"
            value={formData.customer_phone}
            onChange={(e) => handleChange('customer_phone', e.target.value)}
          />
          <CustomInput
            label="Email"
            type="email"
            value={formData.customer_email}
            onChange={(e) => handleChange('customer_email', e.target.value)}
          />
        </div>
        <div className="mt-4 flex gap-3">
          <CustomButton
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<MessageCircle className="h-4 w-4" />}
            onClick={handleWhatsAppClick}
          >
            WhatsApp
          </CustomButton>
          <CustomButton
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Mail className="h-4 w-4" />}
            onClick={handleSendEmail}
          >
            Enviar Correo
          </CustomButton>
        </div>
      </CustomCard>

      {/* Datos de la Orden */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <FileText className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos de la Orden</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Estado
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="input-field"
            >
              {orderStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Descripción de la Falla
            </label>
            <textarea
              value={formData.failure_description}
              onChange={(e) => handleChange('failure_description', e.target.value)}
              rows={3}
              className="input-field resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Fecha de inicio</p>
              <p className="text-sm font-bold text-slate-800">
                {order.started_at ? new Date(order.started_at).toLocaleDateString('es-CO') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Fecha de finalización</p>
              <p className="text-sm font-bold text-slate-800">
                {order.finished_at ? new Date(order.finished_at).toLocaleDateString('es-CO') : '—'}
              </p>
            </div>
          </div>
        </div>
      </CustomCard>

      {/* Repuestos Solicitados - EDITABLE */}
      <CustomCard>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <Package className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Repuestos Solicitados</h2>
          </div>
          <CustomButton
            type="button"
            size="sm"
            leftIcon={<Plus className="h-3 w-3" />}
            onClick={() => {
              setEditingPart(null);
              setNewPart({ name: '', reference: '', quantity: 1, notes: '' });
              setIsPartModalOpen(true);
            }}
          >
            Agregar
          </CustomButton>
        </div>

        <div className="space-y-3">
          {parts.length === 0 ? (
            <p className="text-sm text-slate-400">No hay repuestos solicitados</p>
          ) : (
            parts.map((part) => (
              <div
                key={part.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{part.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    Cant: {part.quantity}
                    {part.unit_price != null && (
                      <span className="ml-2 text-brand-600 font-semibold">
                        {formatCOP(part.unit_price)}
                      </span>
                    )}
                  </p>
                  {part.notes && (
                    <p className="mt-2 text-xs italic text-slate-500">&ldquo;{part.notes}&rdquo;</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getPartStatusBadge(part.approvalStatus)}
                  <button
                    onClick={() => handleEditPart(part)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    title="Editar repuesto"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePart(part.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Eliminar repuesto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CustomCard>

      {/* Checklist de Trabajos - EDITABLE */}
      <CustomCard>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <ClipboardList className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Checklist de Trabajos</h2>
          </div>
          <CustomButton
            type="button"
            size="sm"
            leftIcon={<Plus className="h-3 w-3" />}
            onClick={() => {
              setEditingCheckItem(null);
              setNewCheckItem({ title: '', category: 'DIAGNOSTICO', priority: 'MEDIA' });
              setIsChecklistModalOpen(true);
            }}
          >
            Agregar
          </CustomButton>
        </div>

        <div className="space-y-2">
          {checklist.length === 0 ? (
            <p className="text-sm text-slate-400">No hay items en el checklist</p>
          ) : (
            checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                  item.completed
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <button
                  onClick={() => toggleCheckItem(item.id)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    item.completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  {item.completed && <CheckCircle2 className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <p
                    className={`text-sm font-bold ${
                      item.completed ? 'text-emerald-700 line-through' : 'text-slate-800'
                    }`}
                  >
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{item.category}</span>
                    {item.priority === 'ALTA' && (
                      <CustomBadge variant="danger" dot>
                        Alta
                      </CustomBadge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleEditCheckItem(item)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  title="Editar item"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteCheckItem(item.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Eliminar item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </CustomCard>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <CustomButton
          variant="secondary"
          className="flex-1"
          leftIcon={<X className="h-4 w-4" />}
          onClick={handleCancel}
        >
          Cancelar
        </CustomButton>
        <CustomButton
          className="flex-1"
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          isLoading={isSaving}
        >
          Guardar Cambios
        </CustomButton>
      </div>

      {/* Modal de repuesto */}
      <CustomDialog
        open={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        title={editingPart ? 'Editar Repuesto' : 'Agregar Repuesto'}
      >
        <div className="space-y-4">
          <CustomInput
            label="Nombre del repuesto"
            value={newPart.name}
            onChange={(e) => setNewPart((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ej: Pastillas de freno"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <CustomInput
              label="Referencia"
              value={newPart.reference}
              onChange={(e) => setNewPart((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="PF-2024-TY"
            />
            <CustomInput
              label="Cantidad"
              type="number"
              min={1}
              value={newPart.quantity}
              onChange={(e) =>
                setNewPart((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value, 10) || 1,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Notas
            </label>
            <textarea
              value={newPart.notes}
              onChange={(e) => setNewPart((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas adicionales..."
              rows={3}
              className="input-field resize-none"
            />
          </div>
          <div className="flex gap-3">
            <CustomButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsPartModalOpen(false)}
            >
              Cancelar
            </CustomButton>
            <CustomButton
              className="flex-1"
              onClick={editingPart ? handleUpdatePart : handleAddPart}
            >
              {editingPart ? 'Actualizar' : 'Agregar'}
            </CustomButton>
          </div>
        </div>
      </CustomDialog>

      {/* Modal de checklist */}
      <CustomDialog
        open={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        title={editingCheckItem ? 'Editar Item' : 'Agregar Item al Checklist'}
      >
        <div className="space-y-4">
          <CustomInput
            label="Título del trabajo"
            value={newCheckItem.title}
            onChange={(e) => setNewCheckItem((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Ej: Revisión de frenos"
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Prioridad
            </label>
            <select
              value={newCheckItem.priority}
              onChange={(e) => setNewCheckItem((prev) => ({ ...prev, priority: e.target.value }))}
              className="input-field"
            >
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>
          <div className="flex gap-3">
            <CustomButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsChecklistModalOpen(false)}
            >
              Cancelar
            </CustomButton>
            <CustomButton
              className="flex-1"
              onClick={editingCheckItem ? handleUpdateCheckItem : handleAddCheckItem}
            >
              {editingCheckItem ? 'Actualizar' : 'Agregar'}
            </CustomButton>
          </div>
        </div>
      </CustomDialog>
    </div>
  );
}
