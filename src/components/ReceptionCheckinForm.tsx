import { useState, useCallback } from "react";
import { useSnackbar } from "notistack";
import { useUserContext } from "@/context/UserContext";
import { generateShortUid } from "@/utils/uid";
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
  Package,
  ClipboardList,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  User,
  FileText,
  Palette,
} from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { NumericInput } from "@/components/ui/NumericInput";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { normalizePlate, isValidColombianPlate } from "@/utils/plate";
import { useCreateOrder } from "@/hooks/useCreateOrder";
import { useUsers } from "@/hooks/useUsers";
import { localForage } from "@/services/localForage";
import { formatCOP } from "@/utils/currency";
import { EvidenceUploader } from "@/components/EvidenceUploader";

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

interface PartItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number | null;
}

interface ReceptionFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  mileage: string;
  fuel_level: FuelLevel;
  failure_description: string;
  vehicle_details: string;
  checklist: WorkChecklistItem[];
  parts: PartItem[];
  hide_costs_from_technicians: boolean;
  assigned_user_id: number | null;
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
  const { user } = useUserContext();
  const { data: users } = useUsers();
  const [formData, setFormData] = useState<ReceptionFormData>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    vehicle_plate: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_color: "",
    mileage: "",
    fuel_level: "1/2",
    failure_description: "",
    vehicle_details: "",
    checklist: [],
    parts: [],
    hide_costs_from_technicians: true,
    assigned_user_id: null,
  });

  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckPriority, setNewCheckPriority] = useState<ChecklistPriority>("MEDIA");
  const [newPartName, setNewPartName] = useState("");
  const [newPartQuantity, setNewPartQuantity] = useState("");
  const [newPartUnitPrice, setNewPartUnitPrice] = useState("");
  const [plateError, setPlateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

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

  // --- Repuestos ---
  // Recibe los valores en crudo (strings) porque provienen de los inputs y se
  // coercen aquí: cantidad no numérica o < 1 → 1; precio vacío → null.
  const addPart = useCallback(
    (name: string, quantity: string, unit_price: string) => {
      const trimmedName = name.trim();

      // RF-2: el nombre es obligatorio para agregar el repuesto
      if (!trimmedName) {
        enqueueSnackbar("El nombre del repuesto es obligatorio", { variant: "error" });
        return;
      }

      // Caso límite: cantidad no numérica o menor a 1 → forzar a 1.
      // Vacío = estado por defecto del campo (se limpia tras agregar) → sin aviso.
      const parsedQuantity = parseInt(quantity, 10);
      let quantityValue = parsedQuantity;
      if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
        quantityValue = 1;
        if (quantity.trim() !== "") {
          enqueueSnackbar("Cantidad inválida: se usará 1", { variant: "warning" });
        }
      }

      // Caso límite: precio vacío o no numérico → null
      const parsedPrice = parseFloat(unit_price);
      const unitPriceValue = unit_price.trim() === "" || !Number.isFinite(parsedPrice) ? null : parsedPrice;

      const newPart: PartItem = {
        id: generateShortUid(),
        name: trimmedName,
        quantity: quantityValue,
        unit_price: unitPriceValue,
      };

      setFormData((prev) => ({ ...prev, parts: [...prev.parts, newPart] }));
      // Limpiar los campos del formulario de repuesto tras agregar
      setNewPartName("");
      setNewPartQuantity("");
      setNewPartUnitPrice("");
    },
    [enqueueSnackbar],
  );

  const removePart = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      parts: prev.parts.filter((part) => part.id !== id),
    }));
  };

  // Enter en los campos de repuesto agrega el repuesto. Además evita el
  // submit implícito del formulario, que crearía la orden sin querer.
  const handlePartInputEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPart(newPartName, newPartQuantity, newPartUnitPrice);
    }
  };

  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que haya al menos un item en el checklist
    if (formData.checklist.length === 0) {
      enqueueSnackbar("Debe agregar al menos un item al checklist", { variant: "error" });
      return;
    }

    // RF-6: validación no bloqueante de repuestos. Solo aviso visual,
    // el envío NO se interrumpe.
    const hasInvalidPart = formData.parts.some((part) => !part.name.trim() || part.quantity < 1);
    if (hasInvalidPart) {
      enqueueSnackbar("Revisa los repuestos: nombre y cantidad son obligatorios", {
        variant: "warning",
      });
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
      vehicle_color: formData.vehicle_color || null,
      mileage: parseInt(formData.mileage, 10) || 0,
      fuel_level: formData.fuel_level,
      failure_description: formData.failure_description,
      vehicle_details: formData.vehicle_details || null,
      status: "received",
      checklist: JSON.stringify(formData.checklist),
      // RF-5/RF-10: lista de repuestos como JSON string en snake_case.
      // Lista vacía → "[]".
      parts: JSON.stringify(
        formData.parts.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unit_price: p.unit_price,
        })),
      ),
      assigned_user_id: formData.assigned_user_id,
    };

    createOrder(payload, {
      onSuccess: async (response) => {
        const orderId = response?.id;
        enqueueSnackbar("Orden creada exitosamente", { variant: "success" });

        // Subir evidencias pendientes si hay archivos y orderId válido
        if (orderId && pendingFiles.length > 0) {
          try {
            let successCount = 0;
            for (const file of pendingFiles) {
              const formData = new FormData();
              formData.append("file", file);
              const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
              const { getApiToken } = await import("@/services/api");
              const token = getApiToken() || "";
              const uploadResponse = await fetch(`${apiBaseUrl}/api/orders/${orderId}/evidence`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              });
              if (uploadResponse.ok) {
                successCount++;
              } else {
                console.error("Error subiendo evidencia:", await uploadResponse.text());
              }
            }
            if (successCount > 0) {
              enqueueSnackbar(`${successCount} evidencia(s) subida(s) correctamente`, { variant: "success" });
            }
            if (successCount < pendingFiles.length) {
              enqueueSnackbar(`${pendingFiles.length - successCount} evidencia(s) fallaron`, { variant: "warning" });
            }
          } catch (uploadError) {
            console.error("Error subiendo evidencias:", uploadError);
            enqueueSnackbar("Orden creada pero hubo error subiendo evidencias", { variant: "warning" });
          }
        }

        // Resetear el formulario
        setFormData({
          customer_name: "",
          customer_phone: "",
          customer_email: "",
          vehicle_plate: "",
          vehicle_make: "",
          vehicle_model: "",
          vehicle_year: "",
          vehicle_color: "",
          mileage: "",
          fuel_level: "1/2",
          failure_description: "",
          vehicle_details: "",
          checklist: [],
          parts: [],
          hide_costs_from_technicians: true,
          assigned_user_id: null,
        });
        setPendingFiles([]);
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
          const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
          const detail = apiError.body?.statusText || apiError.statusText || "Error al registrar la recepción";
          const status = apiError.status ? ` [${apiError.status}]` : "";
          const name = error instanceof Error ? error.name : "Error";
          enqueueSnackbar(`${name}${status}: ${detail}`, { variant: "error" });
          console.error("[checkin]", error);
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
    <div className='mx-auto max-w-md space-y-6 px-4 pb-8 sm:px-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-extrabold tracking-tight text-slate-900 pt-4'>Recepción de Vehículo</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className='space-y-6'
      >
        {/* --- Placa --- */}
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
                label='Color'
                name='vehicle_color'
                value={formData.vehicle_color}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_color: e.target.value }))}
                placeholder='Rojo'
              />
              <CustomInput
                label='Año'
                name='vehicle_year'
                value={formData.vehicle_year}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_year: e.target.value }))}
                placeholder='2020'
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <NumericInput
                label='Odómetro (km)'
                name='mileage'
                value={formData.mileage}
                onChange={(_, numericValue) =>
                  setFormData((prev) => ({ ...prev, mileage: numericValue !== null ? String(numericValue) : "" }))
                }
                placeholder='85000'
                allowDecimal={false}
                min={0}
              />
            </div>
          </div>
        </CustomCard>

        {/* --- Detalles del Vehículo (textarea) --- */}
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <FileText className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Detalles del Vehículo</h2>
          </div>
          <label className='mb-1.5 block text-sm font-semibold text-slate-700'>
            Observaciones adicionales (color, accesorios, daños visibles, etc.)
          </label>
          <textarea
            value={formData.vehicle_details}
            onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_details: e.target.value }))}
            placeholder='Ej: Color rojo, alerón trasero, rayón en puerta derecha, llantas de aleación...'
            rows={3}
            className='input-field resize-none'
          />
          <p className='mt-1.5 text-xs text-slate-400'>
            Color, accesorios, daños visibles, características especiales...
          </p>
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

        {/* --- Usuario Asignado --- */}
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <User className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Asignar a</h2>
          </div>
          <div>
            <label className='mb-1.5 block text-sm font-semibold text-slate-700'>Usuario responsable</label>
            <select
              value={formData.assigned_user_id ?? ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  assigned_user_id: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
              className='input-field'
            >
              <option value=''>Sin asignar</option>
              {(users || [])
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.role === "admin" ? "Admin" : "Mecánico"})
                  </option>
                ))}
            </select>
            <p className='mt-1.5 text-xs text-slate-400'>Opcional — quién se encarga de esta orden</p>
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
              aria-label='Agregar item al checklist'
              leftIcon={<Plus className='h-4 w-4' />}
              onClick={() => addChecklistItem(newCheckItem, newCheckPriority)}
            />
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
                    {item.priority === "ALTA" && (
                      <div className='mt-0.5'>
                        <CustomBadge variant='danger' dot>
                          Prioridad alta
                        </CustomBadge>
                      </div>
                    )}
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

        {/* --- Repuestos solicitados --- */}
        <CustomCard>
          <div className='mb-4 flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
              <Package className='h-4 w-4 text-brand-600' />
            </div>
            <h2 className='text-sm font-bold text-slate-800'>Repuestos solicitados</h2>
          </div>

          {/* Formulario "Agregar repuesto" */}
          <div className='space-y-3'>
            <CustomInput
              label='Nombre del repuesto'
              name='new_part_name'
              value={newPartName}
              onChange={(e) => setNewPartName(e.target.value)}
              placeholder='Filtro de aceite'
              helperText='Obligatorio'
              autoComplete='off'
              onKeyDown={handlePartInputEnter}
            />
            <div className='grid grid-cols-2 gap-3'>
              <NumericInput
                label='Cantidad'
                name='new_part_quantity'
                value={newPartQuantity}
                onChange={(_, numericValue) => setNewPartQuantity(numericValue !== null ? String(numericValue) : "")}
                placeholder='1'
                allowDecimal={false}
                min={1}
              />
              <NumericInput
                label='Precio unitario'
                name='new_part_unit_price'
                value={newPartUnitPrice}
                onChange={(_, numericValue) => setNewPartUnitPrice(numericValue !== null ? String(numericValue) : "")}
                placeholder='150000'
                helperText='Opcional (COP)'
                allowDecimal={true}
                min={0}
                isCurrency={true}
              />
            </div>
            <CustomButton
              type='button'
              size='md'
              className='w-full'
              leftIcon={<Plus className='h-4 w-4' />}
              onClick={() => addPart(newPartName, newPartQuantity, newPartUnitPrice)}
            >
              Agregar repuesto
            </CustomButton>
          </div>

          {/* Lista de repuestos */}
          {formData.parts.length > 0 && (
            <div className='space-y-2'>
              {formData.parts.map((part) => (
                <div
                  key={part.id}
                  className='flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all'
                >
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-slate-700'>{part.name}</p>
                    <p className='mt-0.5 text-xs text-slate-500'>
                      Cant: {part.quantity}
                      {part.unit_price !== null ? ` · ${formatCOP(part.unit_price)} c/u` : " · Sin precio"}
                    </p>
                    {part.unit_price !== null && (
                      <p className='mt-0.5 text-xs font-semibold text-slate-700'>
                        Total: {formatCOP(part.quantity * part.unit_price)}
                      </p>
                    )}
                  </div>
                  <button
                    type='button'
                    onClick={() => removePart(part.id)}
                    aria-label={`Eliminar repuesto ${part.name}`}
                    className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CustomCard>

        {/* --- Switch de seguridad --- */}
        {user?.role === "admin" && (
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
        )}

        {/* --- Cargar Evidencias (fuera del form para evitar submit al cerrar modal cámara) --- */}
        <EvidenceUploader
          orderId={0}
          selectionOnly
          onFilesSelected={(files) => setPendingFiles((prev) => [...prev, ...files])}
        />

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
