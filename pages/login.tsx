import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import { Wrench, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomButton } from "@/components/ui/CustomButton";
import { api, endpoints } from "@/services/api";
import { useUserContext } from "@/context/UserContext";

export const dynamic = 'force-dynamic';

// --- Tipos ---

interface LoginResponseBody {
  id: number;
  token: string;
  first_name: string;
  last_name?: string;
  nickname: string;
  role: "admin" | "mechanic";
}

interface LoginResponse {
  status: number;
  body: LoginResponseBody;
  statusText: string;
}

interface LoginFormData {
  email: string;
  password: string;
}

// --- Componente Principal ---

export default function LoginPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated, user, login } = useUserContext();

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Redirigir si ya está autenticado (por rol, igual que handleSubmit)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(user?.role === "mechanic" ? "/technician/order" : "/admin/dashboard");
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // El backend recibe el valor en `email` (acepta usuario o correo)
      const response = await api.post<LoginResponse>(endpoints.login, {
        email: formData.email.trim(),
        password: formData.password,
      });

      const { id, token, first_name, last_name, role } = response.body;

      // login() del contexto persiste la sesión: guarda el JWT y los datos del
      // usuario (id, firstName, lastName, role) en cookies para poder
      // restaurar el nombre real y el rol al refrescar (F5).
      login(
        {
          id,
          firstName: first_name,
          ...(last_name ? { lastName: last_name } : {}),
          role,
        },
        token,
      );

      const fullName = last_name ? `${first_name} ${last_name}` : first_name;
      enqueueSnackbar(`Bienvenido, ${fullName}`, { variant: "success" });

      // Redirigir según el rol
      if (role === "mechanic") {
        router.replace("/technician/order");
      } else {
        // El admin entra a su panel de control
        router.replace("/admin/dashboard");
      }
    } catch (error: unknown) {
      const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
      const name = error instanceof Error ? error.name : "Error";
      const status = apiError.status ? ` ${apiError.status}` : "";
      const detail =
        (typeof apiError.body === "object" && apiError.body && "statusText" in apiError.body
          ? (apiError.body as { statusText: string }).statusText
          : null) ||
        apiError.statusText ||
        (error instanceof Error ? error.message : String(error));

      if (apiError.status === 503) {
        setError("Sin conexión al servidor. Verifica tu red.");
        enqueueSnackbar("Sin conexión al servidor", { variant: "warning" });
      } else if (apiError.status === 401 || apiError.status === 422) {
        setError("Credenciales inválidas. Verifica tu usuario y contraseña.");
        enqueueSnackbar(`[${name}${status}] ${detail}`, { variant: "error" });
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
        enqueueSnackbar(`[${name}${status}] ${detail}`, { variant: "error" });
      }
      // Log completo para depuración (dev tools / consola)
      console.error("[login]", { name, status: apiError.status, detail }, error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-[100dvh] items-center justify-center bg-surface-base p-4'>
      <div className='w-full max-w-md'>
        {/* Logo y título */}
        <div className='mb-8 text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-floating'>
            <Wrench className='h-8 w-8 text-white' />
          </div>
          <h1 className='text-2xl font-extrabold tracking-tight text-slate-900'>Mecaflow Workshop OS</h1>
          <p className='mt-1 text-sm text-slate-500'>Ingresa tus credenciales para continuar</p>
        </div>

        {/* Formulario */}
        <CustomCard padding='lg'>
          <form onSubmit={handleSubmit} className='space-y-5'>
            {/* Error global */}
            {error && (
              <div className='flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600'>
                <AlertCircle className='h-4 w-4 shrink-0' />
                {error}
              </div>
            )}

            {/* Usuario o Email */}
            <div className='relative'>
              <CustomInput
                label='Usuario o Email'
                name='email'
                type='text'
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder='admin@example.com'
                autoComplete='nickname'
                required
              />
              <Mail className='absolute right-3 top-9 h-4 w-4 text-slate-400' />
            </div>

            {/* Password */}
            <div className='relative'>
              <CustomInput
                label='Contraseña'
                name='password'
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder='••••••••'
                autoComplete='current-password'
                className='pr-11'
                required
              />
              <button
                type='button'
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                className='absolute right-3 top-9 flex h-5 w-5 items-center justify-center text-slate-400 transition-colors hover:text-slate-600'
              >
                {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>

            {/* Botón de login */}
            <CustomButton
              type='submit'
              size='lg'
              className='w-full'
              isLoading={isLoading}
              leftIcon={<Wrench className='h-5 w-5' />}
            >
              Iniciar Sesión
            </CustomButton>
          </form>
        </CustomCard>

        {/* Footer */}
        <p className='mt-6 text-center text-xs text-slate-400'>Mecaflow Workshop OS v1.0.0</p>
      </div>
    </div>
  );
}
