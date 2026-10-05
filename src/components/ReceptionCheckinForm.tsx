import { useState, useCallback } from "react";
import { useSnackbar } from "notistack";
import {
  Camera,
  Mic,
  Square,
  Pause,
  Play,
  Plus,
  Trash2,
  Car,
  Fuel,
  ClipboardList,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { normalizePlate, isValidColombianPlate } from "@/utils/plate";
import { useCreateOrder } from "@/hooks/useCreateOrder";
import { localForage } from "@/services/localForage";

// --- Tipos autocontenidos ---

type FuelLevel = "E" | "1/4" | "1/2" | "3/4" | "F";

type ChecklistPriority = "ALTA" | "MEDIA" | "BAJA";

interface WorkChecklistItem {
  id: string;
  title: string;
  category: string;
  estimatedMinutes?: number;
  priority: ChecklistPriority;
  completed: boolean;
}

interface ReceptionFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  mileage: string;
  fuel_level: FuelLevel;
  failure_description: string;
  checklist: WorkChecklistItem[];
  hide_costs_from_technicians: boolean;
}

// --- Constantes ---

const FUEL_LEVELS: { value: FuelLevel; label: string; icon: string }[] = [
  { value: "E", label: "Vacío", icon: "🔋" },
  { value: "1/4", label: "1/4", icon: "🔋" },
  { value: "1/2", label: "1/2", icon: "🔋" },
  { value: "3/4", label: "3/4", icon: "🔋" },
  { value: "F", label: "Lleno", icon: "⛽" },
];

// --- Componente Principal ---

export function ReceptionCheckinForm() {
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<ReceptionFormData>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    vehicle_plate: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    mileage: "",
    fuel_level: "1/2",
    failure_description: "",
    checklist: [],
    hide_costs_from_technicians: true,
  });

  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckPriority, setNewCheckPriority] = useState<ChecklistPriority>("MEDIA");
  const [plateError, setPlateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    isRecording,
    isPaused,
    duration,
    audioUrl,
    error: audioError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecorder,
  } = useAudioRecorder();

  // --- Handlers ---

  const handlePlateChange = (value: string) => {
    const normalized = normalizePlate(value);
    setFormData((prev) => ({ ...prev, vehicle_plate: normalized }));
    setPlateError("");
  };

  const addChecklistItem = useCallback((title: string, priority: ChecklistPriority) => {
    if (!title.trim()) return;
    const newItem: WorkChecklistItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      category: "DIAGNOSTICO",
      priority,
      completed: false,
    };
    setFormData((prev) => ({
      ...prev,
      checklist: [...prev.checklist, newItem],
    }));
    setNewCheckItem("");
  }, []);

  const removeChecklistItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((item) => item.id !== id),
    }));
  };

  const toggleChecklistItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    }));
  };

  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que haya al menos un item en el checklist
    if (formData.checklist.length === 0) {
      enqueueSnackbar("Debe agregar al menos un item al checklist", { variant: "error" });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      customer_email: formData.customer_email,
      vehicle_plate: formData.vehicle_plate,
      vehicle_make: formData.vehicle_make,
      vehicle_model: formData.vehicle_model,
      vehicle_year: parseInt(formData.vehicle_year, 10) || new Date().getFullYear(),
      mileage: parseInt(formData.mileage, 10) || 0,
      fuel_level: formData.fuel_level,
      failure_description: formData.failure_description,
      status: "received",
      checklist: JSON.stringify(formData.checklist),
    };

    createOrder(payload, {
      onSuccess: () => {
        enqueueSnackbar("Orden creada exitosamente", { variant: "success" });
        // Resetear el formulario
        setFormData({
          customer_name: "",
          customer_phone: "",
          customer_email: "",
          vehicle_plate: "",
          vehicle_make: "",
          vehicle_model: "",
          vehicle_year: "",
          mileage: "",
          fuel_level: "1/2",
          failure_description: "",
          checklist: [],
          hide_costs_from_technicians: true,
        });
        setPlateError("");
      },
      onError: (error: unknown) => {
        if (error instanceof Error && "status" in error && (error as { status: number }).status === 503) {
          localForage.addToQueue({
            endpoint: "/api/orders",
            method: "POST",
            body: payload,
          });
          enqueueSnackbar("Sin conexión. Se guardó para enviar luego.", { variant: "warning" });
        } else {
          const apiError = error as { statusText?: string; body?: { statusText?: string } };
          const errorMessage = apiError.body?.statusText || apiError.statusText || "Error al registrar la recepción";
          enqueueSnackbar(errorMessage, { variant: "error" });
        }
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // --- Render ---

  return (
    <div className='mx-auto max-w-md space-y-6 pb-8'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-extrabold tracking-tight text-slate-900'>Recepción de Vehículo</h1>
        <p className='mt-1 text-sm text-slate-500'>Check-in de patio · Paso 1 de 5</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* --- Placa Colombiana --- */}
        <CustomCard className='overflow-hidden'>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Car className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Placa del Vehículo</h2>
          </div>

          <div className='flex-1'>
            <input
              type='text'
              value={formData.vehicle_plate}
              onChange={(e) => handlePlateChange(e.target.value)}
              placeholder='ABC123'
              maxLength={10}
              className='w-full rounded-xl border-2 border-slate-800 bg-amber-300 px-4 py-3.5 text-center text-2xl font-extrabold tracking-[0.2em] text-neutral-900 placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none transition-colors'
            />
            {plateError && <p className='mt-2 text-xs font-medium text-red-500'>{plateError}</p>}
          </div>
        </CustomCard>

        {/* --- Datos del Vehículo --- */}
        <CustomCard>
          <h2 className='mb-4 text-sm font-bold text-slate-800'>Datos del Vehículo</h2>
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-3'>
              <CustomInput
                label='Marca'
                name='vehicle_make'
                value={formData.vehicle_make}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_make: e.target.value }))}
                placeholder='Toyota'
              />
              <CustomInput
                label='Modelo'
                name='vehicle_model'
                value={formData.vehicle_model}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_model: e.target.value }))}
                placeholder='Corolla'
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <CustomInput
                label='Año'
                name='vehicle_year'
                type='number'
                value={formData.vehicle_year}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_year: e.target.value }))}
                placeholder='2020'
              />
              <CustomInput
                label='Odómetro (km)'
                name='mileage'
                type='number'
                value={formData.mileage}
                onChange={(e) => setFormData((prev) => ({ ...prev, mileage: e.target.value }))}
                placeholder='85000'
              />
            </div>
          </div>
        </CustomCard>

        {/* --- Nivel de Combustible --- */}
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Fuel className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Nivel de Combustible</h2>
          </div>
          <div className='flex gap-1.5 rounded-xl bg-slate-100 p-1.5'>
            {FUEL_LEVELS.map((level) => (
              <button
                key={level.value}
                type='button'
                onClick={() => setFormData((prev) => ({ ...prev, fuel_level: level.value }))}
                className={`flex-1 rounded-lg py-2.5 text-center transition-all duration-200 ${
                  formData.fuel_level === level.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-white hover:shadow-sm"
                }`}
              >
                <div className='text-lg leading-none'>{level.icon}</div>
                <div className='mt-1 text-xs font-bold'>{level.value}</div>
              </button>
            ))}
          </div>
        </CustomCard>

        {/* --- Datos del Cliente --- */}
        <CustomCard>
          <h2 className='mb-4 text-sm font-bold text-slate-800'>Datos del Cliente</h2>
          <div className='space-y-4'>
            <CustomInput
              label='Nombre completo'
              name='customer_name'
              value={formData.customer_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder='Juan Pérez'
            />
            <div className='grid grid-cols-2 gap-3'>
              <CustomInput
                label='Teléfono'
                name='customer_phone'
                type='tel'
                value={formData.customer_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))}
                placeholder='+58 412 123 4567'
              />
              <CustomInput
                label='Email'
                name='customer_email'
                type='email'
                value={formData.customer_email}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer_email: e.target.value }))}
                placeholder='juan@email.com'
              />
            </div>
          </div>
        </CustomCard>

        {/* --- Nota de Voz (OCULTA) --- */}
        {/* Sección de nota de voz oculta por ahora. El componente useAudioRecorder sigue disponible para uso futuro. */}

        {/* --- Checklist de Patio --- */}
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <ClipboardList className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Checklist</h2>
          </div>

          {/* Input manual */}
          <div className='mb-4 flex gap-2'>
            <input
              type='text'
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              placeholder='Agregar item manual...'
              className='input-field flex-1'
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChecklistItem(newCheckItem, newCheckPriority);
                }
              }}
            />
            <CustomButton
              type='button'
              size='md'
              leftIcon={<Plus className='h-4 w-4' />}
              onClick={() => addChecklistItem(newCheckItem, newCheckPriority)}
            >
              +
            </CustomButton>
          </div>

          {/* Lista de items */}
          {formData.checklist.length > 0 && (
            <div className='space-y-2'>
              {formData.checklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    item.completed ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <button
                    type='button'
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                      item.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white hover:border-slate-400"
                    }`}
                  >
                    {item.completed && <CheckCircle2 className='h-4 w-4' />}
                  </button>
                  <div className='flex-1'>
                    <p
                      className={`text-sm font-medium ${
                        item.completed ? "text-slate-400 line-through" : "text-slate-700"
                      }`}
                    >
                      {item.title}
                    </p>
                    <div className='mt-0.5 flex items-center gap-2'>
                      <span className='text-xs font-medium text-slate-400'>{item.category}</span>
                      {item.priority === "ALTA" && (
                        <CustomBadge variant='danger' dot>
                          Prioridad alta
                        </CustomBadge>
                      )}
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={() => removeChecklistItem(item.id)}
                    className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Descripción textual */}
          <div className='mt-4'>
            <CustomInput
              label='Descripción de la falla'
              name='failure_description'
              value={formData.failure_description}
              onChange={(e) => setFormData((prev) => ({ ...prev, failure_description: e.target.value }))}
              placeholder='El vehículo vibra al frenar...'
            />
          </div>
        </CustomCard>

        {/* --- Switch de seguridad --- */}
        <CustomCard>
          <div className='flex items-start gap-3'>
            <ShieldAlert className='mt-0.5 h-5 w-5 shrink-0 text-brand-600' />
            <div className='flex-1'>
              <CustomSwitch
                checked={formData.hide_costs_from_technicians}
                onChange={(checked) => setFormData((prev) => ({ ...prev, hide_costs_from_technicians: checked }))}
                label='Ocultar costos comerciales a técnicos'
                description='Los técnicos no verán precios COP ni márgenes'
              />
            </div>
          </div>
        </CustomCard>

        {/* --- Botón de envío --- */}
        <CustomButton
          type='submit'
          size='lg'
          className='w-full'
          isLoading={isSubmitting || isCreating}
          leftIcon={<Wrench className='h-5 w-5' />}
        >
          Registrar Recepción
        </CustomButton>
      </form>
    </div>
  );
}
