import { useState, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import {
  ArrowLeft,
  Save,
  X,
  Car,
  Edit3,
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomInput } from '@/components/ui/CustomInput';
import { Vehicle } from '@/hooks/useVehicles';
import { useApiClient } from '@/services/apiClient';
import { endpoints } from '@/services/api';

// --- Tipos ---

interface VehicleFormData {
  plate: string;
  make: string;
  model: string;
  year: string;
  color: string;
}

// --- Componente ---

interface AdminVehicleDetailProps {
  vehicle: Vehicle;
  onBack: () => void;
}

export function AdminVehicleDetail({ vehicle, onBack }: AdminVehicleDetailProps) {
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<VehicleFormData | null>(null);
  const [originalData, setOriginalData] = useState<VehicleFormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const data: VehicleFormData = {
      plate: vehicle.plate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year.toString(),
      color: vehicle.color,
    };
    setFormData(data);
    setOriginalData(data);
  }, [vehicle]);

  const handleChange = (field: keyof VehicleFormData, value: string) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: value });
  };

  const handleCancel = () => {
    if (originalData) {
      setFormData(originalData);
      setIsEditing(false);
      enqueueSnackbar('Cambios cancelados', { variant: 'info' });
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    setIsSaving(true);

    try {
      const payload = {
        id: vehicle.id,
        plate: formData.plate,
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year, 10) || 0,
        color: formData.color,
      };

      await apiClient.patch(endpoints.vehicles, payload, {
        successMessage: 'Vehículo actualizado exitosamente',
      });

      setOriginalData(formData);
      setIsEditing(false);
    } catch (error) {
      // El error ya se muestra globalmente
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-sm text-slate-400">Cargando vehículo...</div>
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
              Vehículo #{vehicle.id}
            </h1>
            <p className="text-sm text-slate-500">
              {vehicle.plate}
            </p>
          </div>
        </div>
        {!isEditing && (
          <CustomButton
            variant="secondary"
            size="sm"
            leftIcon={<Edit3 className="h-4 w-4" />}
            onClick={() => setIsEditing(true)}
          >
            Editar
          </CustomButton>
        )}
      </div>

      {/* Datos del Vehículo */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <Car className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Vehículo</h2>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <CustomInput
              label="Placa"
              value={formData.plate}
              onChange={(e) => handleChange('plate', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <CustomInput
                label="Marca"
                value={formData.make}
                onChange={(e) => handleChange('make', e.target.value)}
              />
              <CustomInput
                label="Modelo"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CustomInput
                label="Año"
                type="number"
                value={formData.year}
                onChange={(e) => handleChange('year', e.target.value)}
              />
              <CustomInput
                label="Color"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Placa</p>
              <p className="text-sm font-bold text-slate-800">{formData.plate}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Marca</p>
              <p className="text-sm font-bold text-slate-800">{formData.make}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Modelo</p>
              <p className="text-sm font-bold text-slate-800">{formData.model}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Año</p>
              <p className="text-sm font-bold text-slate-800">{formData.year}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Color</p>
              <p className="text-sm font-bold text-slate-800">{formData.color || '—'}</p>
            </div>
          </div>
        )}
      </CustomCard>

      {/* Botones de acción (solo en modo edición) */}
      {isEditing && (
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
      )}
    </div>
  );
}
