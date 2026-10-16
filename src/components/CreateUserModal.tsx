import { useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import { Eye, EyeOff, UserPlus, X } from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
import { api, endpoints, ApiError } from "@/services/api";

// --- Tipos ---

interface CreateUserFormData {
  first_name: string;
  last_name: string;
  nickname: string;
  email: string;
  password: string;
  phone: string;
  role: "admin" | "mechanic";
  active: boolean;
}

type CreateUserFormErrors = Partial<Record<keyof CreateUserFormData, string>>;

interface CreateUserApiResponse {
  status: number;
  body: { id: number };
  statusText: string;
}

// --- Validación (función pura) ---

export function validateCreateUserForm(data: CreateUserFormData): CreateUserFormErrors {
  const errors: CreateUserFormErrors = {};

  if (!data.first_name.trim()) {
    errors.first_name = "El nombre es obligatorio";
  }
  if (!data.last_name.trim()) {
    errors.last_name = "El apellido es obligatorio";
  }
  if (!data.nickname.trim()) {
    errors.nickname = "El usuario es obligatorio";
  }

  const email = data.email.trim();
  if (!email) {
    errors.email = "El email es obligatorio";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Ingresa un email válido";
  }

  if (!data.password) {
    errors.password = "La contraseña es obligatoria";
  } else if (data.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres";
  }

  return errors;
}

const emptyCreateUserForm = (): CreateUserFormData => ({
  first_name: "",
  last_name: "",
  nickname: "",
  email: "",
  password: "",
  phone: "",
  role: "mechanic",
  active: true,
});

function getCreateUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { statusText?: string } | null | undefined;
    const detail =
      body && typeof body === "object" && typeof body.statusText === "string" && body.statusText
        ? body.statusText
        : null;
    console.error("[createUser]", error);
    if (detail) return `[ApiError ${error.status}] ${detail}`;
    if (error.status === 409) return "[ApiError 409] El email o el usuario ya está registrado";
    return `[ApiError ${error.status}] No se pudo crear el usuario`;
  }
  console.error("[createUser]", error);
  const name = error instanceof Error ? error.name : "Error";
  const msg = error instanceof Error ? error.message : String(error);
  return `[${name}] ${msg}`;
}

// --- Componente ---

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  /** Se ejecuta después de crear el usuario, para refrescar la lista */
  onCreated?: () => void;
}

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<CreateUserFormData>(emptyCreateUserForm);
  const [errors, setErrors] = useState<CreateUserFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reiniciar el formulario cada vez que se abre el modal
  useEffect(() => {
    if (open) {
      setFormData(emptyCreateUserForm());
      setErrors({});
      setShowPassword(false);
    }
  }, [open]);

  const handleChange = (field: keyof CreateUserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleRequestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    const validationErrors = validateCreateUserForm(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await api.post<CreateUserApiResponse>(endpoints.users, {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        nickname: formData.nickname.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        role: formData.role,
        active: formData.active,
      });

      enqueueSnackbar("Usuario creado exitosamente", { variant: "success" });
      setFormData(emptyCreateUserForm());
      setErrors({});
      onCreated?.();
      onClose();
    } catch (error) {
      enqueueSnackbar(getCreateUserErrorMessage(error), { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomDialog open={open} onClose={handleRequestClose} title='Crear Nuevo Usuario' maxWidth='md'>
      <div className='max-h-[75dvh] space-y-4 overflow-y-auto pr-1'>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <CustomInput
            label='Nombre'
            name='first_name'
            value={formData.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            error={errors.first_name}
            placeholder='Ej: Juan'
            disabled={isSubmitting}
            required
          />
          <CustomInput
            label='Apellido'
            name='last_name'
            value={formData.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            error={errors.last_name}
            placeholder='Ej: Pérez'
            disabled={isSubmitting}
            required
          />
        </div>

        <CustomInput
          label='Usuario'
          name='nickname'
          value={formData.nickname}
          onChange={(e) => handleChange("nickname", e.target.value)}
          error={errors.nickname}
          placeholder='Ej: jperez'
          autoComplete='off'
          disabled={isSubmitting}
          required
        />

        <CustomInput
          label='Email'
          name='email'
          type='email'
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={errors.email}
          placeholder='juan@example.com'
          disabled={isSubmitting}
          required
        />

        <div>
          <label htmlFor='create-user-password' className='mb-1.5 block text-sm font-semibold text-slate-700'>
            Contraseña
          </label>
          <div className='relative'>
            <CustomInput
              id='create-user-password'
              name='password'
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              error={errors.password}
              helperText='Mínimo 8 caracteres'
              autoComplete='new-password'
              className='pr-11'
              disabled={isSubmitting}
              required
            />
            <button
              type='button'
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              className='absolute right-3 top-0 flex h-10 items-center justify-center text-slate-400 transition-colors hover:text-slate-600'
            >
              {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <CustomInput
            label='Teléfono'
            name='phone'
            type='tel'
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            error={errors.phone}
            placeholder='04121234567'
            helperText='Formato: 04121234567'
            disabled={isSubmitting}
          />
          <div>
            <label htmlFor='create-user-role' className='mb-1.5 block text-sm font-semibold text-slate-700'>
              Rol
            </label>
            <select
              id='create-user-role'
              value={formData.role}
              onChange={(e) => handleChange("role", e.target.value)}
              className='input-field'
              disabled={isSubmitting}
            >
              <option value='admin'>Admin</option>
              <option value='mechanic'>Mecánico</option>
            </select>
          </div>
        </div>

        <div className='rounded-xl border border-slate-100 bg-slate-50 px-4 py-3'>
          <CustomSwitch
            checked={formData.active}
            onChange={(checked) => {
              setFormData((prev) => ({ ...prev, active: checked }));
            }}
            label='Activo'
            description={formData.active ? "El usuario podrá iniciar sesión" : "Usuario inactivo"}
            disabled={isSubmitting}
          />
        </div>

        <div className='flex gap-3 border-t border-slate-100 pt-4'>
          <CustomButton
            type='button'
            variant='secondary'
            className='flex-1'
            leftIcon={<X className='h-4 w-4' />}
            onClick={handleRequestClose}
            disabled={isSubmitting}
          >
            Cancelar
          </CustomButton>
          <CustomButton
            type='button'
            className='flex-1'
            leftIcon={<UserPlus className='h-4 w-4' />}
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            Crear Usuario
          </CustomButton>
        </div>
      </div>
    </CustomDialog>
  );
}
