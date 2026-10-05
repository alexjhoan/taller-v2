import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useCookies } from "react-cookie";
import { useSnackbar } from "notistack";
import { Wrench, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomInput } from "@/components/ui/CustomInput";
import { CustomButton } from "@/components/ui/CustomButton";
import { api, endpoints, setApiToken } from "@/services/api";
import { useUserContext } from "@/context/UserContext";
import { AUTH_COOKIE_NAME } from "@/utils/const";

// --- Tipos ---

interface LoginResponseBody {
  id: number;
  token: string;
  first_name: string;
  nickname: string;
  role: 'admin' | 'mechanic';
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
  const [cookies, setCookie] = useCookies([AUTH_COOKIE_NAME]);
  const { isAuthenticated, login } = useUserContext();

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await api.post<LoginResponse>(endpoints.login, {
        email: formData.email,
        password: formData.password,
      });

      const { id, token, first_name, role } = response.body;

      // Guardar token en cookie (httpOnly=false para que React pueda leerlo si es necesario)
      setCookie(AUTH_COOKIE_NAME, token, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 días
        sameSite: "strict",
      });

      // Guardar token en el cliente API para futuras peticiones
      setApiToken(token);

      // Actualizar contexto de usuario con el role del backend
      login(
        {
          id,
          firstName: first_name,
          role,
        },
        token,
      );

      enqueueSnackbar(`Bienvenido, ${first_name}`, { variant: "success" });
      
      // Redirigir según el rol
      if (role === 'mechanic') {
        router.replace("/technician/order");
      } else {
        router.replace("/");
      }
    } catch (error: unknown) {
      const apiError = error as { status?: number; statusText?: string };

      if (apiError.status === 503) {
        setError("Sin conexión al servidor. Verifica tu red.");
        enqueueSnackbar("Sin conexión al servidor", { variant: "warning" });
      } else if (apiError.status === 401 || apiError.status === 422) {
        setError("Credenciales inválidas. Verifica tu email y contraseña.");
        enqueueSnackbar("Credenciales inválidas", { variant: "error" });
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
        enqueueSnackbar("Error al iniciar sesión", { variant: "error" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-surface-base p-4'>
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

            {/* Email */}
            <div className='relative'>
              <CustomInput
                label='Email'
                name='email'
                type='text'
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder='admin@example.com'
                required
              />
              <Mail className='absolute right-3 top-9 h-4 w-4 text-slate-400' />
            </div>

            {/* Password */}
            <div className='relative'>
              <CustomInput
                label='Contraseña'
                name='password'
                type='password'
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder='••••••••'
                required
              />
              <Lock className='absolute right-3 top-9 h-4 w-4 text-slate-400' />
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
