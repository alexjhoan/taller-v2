import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { UserProvider } from '@/context/UserContext';
import { DialogsProvider } from '@/context/DialogsContext';
import { WorkshopProvider } from '@/context/WorkshopContext';
import '@/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
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
            </WorkshopProvider>
          </DialogsProvider>
        </UserProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
