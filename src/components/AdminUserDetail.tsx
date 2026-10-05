import { useState, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import {
  ArrowLeft,
  Save,
  X,
  User,
  Mail,
  Phone,
  Shield,
  Edit3,
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomInput } from '@/components/ui/CustomInput';
import { User as UserType } from '@/hooks/useUsers';
import { useApiClient } from '@/services/apiClient';
import { endpoints } from '@/services/api';

// --- Tipos ---

interface UserFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: 'admin' | 'mechanic';
  active: number;
}

// --- Componente ---

interface AdminUserDetailProps {
  user: UserType;
  onBack: () => void;
}

export function AdminUserDetail({ user, onBack }: AdminUserDetailProps) {
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<UserFormData | null>(null);
  const [originalData, setOriginalData] = useState<UserFormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const data: UserFormData = {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
    };
    setFormData(data);
    setOriginalData(data);
  }, [user]);

  const handleChange = (field: keyof UserFormData, value: string | number) => {
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
        id: user.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        active: formData.active,
      };

      await apiClient.patch(endpoints.users, payload, {
        successMessage: 'Usuario actualizado exitosamente',
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
        <div className="animate-pulse text-sm text-slate-400">Cargando usuario...</div>
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
              Usuario #{user.id}
            </h1>
            <p className="text-sm text-slate-500">
              {user.first_name} {user.last_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CustomBadge variant={formData.active ? 'success' : 'danger'} dot>
            {formData.active ? 'Activo' : 'Inactivo'}
          </CustomBadge>
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
      </div>

      {/* Datos del Usuario */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Datos del Usuario</h2>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <CustomInput
                label="Nombre"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
              />
              <CustomInput
                label="Apellido"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
              />
            </div>
            <CustomInput
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            <CustomInput
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="input-field"
                >
                  <option value="admin">Admin</option>
                  <option value="mechanic">Mecánico</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Estado
                </label>
                <select
                  value={formData.active}
                  onChange={(e) => handleChange('active', parseInt(e.target.value, 10))}
                  className="input-field"
                >
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Nombre</p>
              <p className="text-sm font-bold text-slate-800">{formData.first_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Apellido</p>
              <p className="text-sm font-bold text-slate-800">{formData.last_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Email</p>
              <p className="text-sm font-bold text-slate-800">{formData.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Teléfono</p>
              <p className="text-sm font-bold text-slate-800">{formData.phone}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Rol</p>
              <CustomBadge variant={formData.role === 'admin' ? 'brand' : 'neutral'}>
                {formData.role === 'admin' ? 'Admin' : 'Mecánico'}
              </CustomBadge>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Estado</p>
              <CustomBadge variant={formData.active ? 'success' : 'danger'} dot>
                {formData.active ? 'Activo' : 'Inactivo'}
              </CustomBadge>
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
