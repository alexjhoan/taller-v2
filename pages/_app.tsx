import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { UserProvider } from '@/context/UserContext';
import { DialogsProvider } from '@/context/DialogsContext';
import { WorkshopProvider } from '@/context/WorkshopContext';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { apiGetVersionApp } from '@/services/api';
import { VERSION_APP_KEY } from '@/utils/const';
import '@/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
    },
  },
});

/**
 * Verificación de versión de la app (solo la primera carga del browser):
 * 1. GET /get-version-app → body.version (ej. "0.0.1")
 * 2. localStorage sin valor → solo guardar, NO recargar
 * 3. versión igual a la guardada → no hacer nada
 * 4. versión distinta → guardar la nueva y recargar la página
 */
async function checkAppVersion(): Promise<void> {
  const latest = await apiGetVersionApp();
  if (!latest) return; // fallo de red / formato inesperado: no tocar nada
  const stored = localStorage.getItem(VERSION_APP_KEY);
  if (!stored) {
    // Primera visita: solo se guarda, sin recarga
    localStorage.setItem(VERSION_APP_KEY, latest);
    return;
  }
  if (stored === latest) return; // misma versión: no hacer nada
  // Versión distinta: guardar la nueva y recargar para traer assets frescos
  localStorage.setItem(VERSION_APP_KEY, latest);
  // reload(true) ya no está tipado en las librerías actuales (0 args), pero
  // su semántica de recarga "forzada" es la pedida: se llama vía cast.
  (window.location as unknown as { reload: (force?: boolean) => void }).reload(true);
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // _app munta una vez por carga de página (las navegaciones SPA no lo
    // remontan), así que esto corre solo en la primera carga.
    void checkAppVersion();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        autoHideDuration={4000}
      >
        <UserProvider>
          <DialogsProvider>
            <WorkshopProvider>
              <Component {...pageProps} />
              <PWAInstallPrompt autoShowDelay={30000} mobileOnly={true} />
            </WorkshopProvider>
          </DialogsProvider>
        </UserProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
