import { useRouter } from 'next/router';
import { ShieldAlert } from 'lucide-react';
import { CustomButton } from '@/components/ui/CustomButton';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <ShieldAlert className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Acceso no autorizado
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          No tienes permisos para acceder a esta sección.
        </p>
        <div className="mt-6">
          <CustomButton
            variant="secondary"
            onClick={() => router.replace('/')}
          >
            Volver al inicio
          </CustomButton>
        </div>
      </div>
    </div>
  );
}
