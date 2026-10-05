import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { ClientQuotationPortal } from '@/components/ClientQuotationPortal';

export default function PortalPage() {
  const router = useRouter();
  const { token } = router.query;

  // Si no hay token, mostrar mensaje de error
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Token requerido</h1>
          <p className="mt-2 text-sm text-slate-500">
            El acceso al portal requiere un token válido. Revisa el enlace que recibiste por WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return <ClientQuotationPortal token={token as string} />;
}
