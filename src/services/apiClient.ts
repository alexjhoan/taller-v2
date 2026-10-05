import { useSnackbar } from 'notistack';
import { api, endpoints, ApiError } from '@/services/api';

// --- Tipos ---

interface ApiClientOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccess?: boolean;
  showError?: boolean;
}

// --- Wrapper con notificaciones ---

export function useApiClient() {
  const { enqueueSnackbar } = useSnackbar();

  const handleSuccess = (message?: string) => {
    if (message) {
      enqueueSnackbar(message, { variant: 'success' });
    }
  };

  const handleError = (error: unknown, customMessage?: string) => {
    if (error instanceof ApiError) {
      const apiError = error as ApiError;
      const errorMessage = apiError.body && typeof apiError.body === 'object' && 'statusText' in apiError.body
        ? (apiError.body as { statusText: string }).statusText
        : apiError.message;

      if (apiError.status === 503) {
        enqueueSnackbar('Sin conexión. Se guardó para enviar luego.', { variant: 'warning' });
      } else {
        enqueueSnackbar(customMessage || errorMessage || 'Error en la operación', { variant: 'error' });
      }
    } else {
      enqueueSnackbar(customMessage || 'Error inesperado', { variant: 'error' });
    }
  };

  const get = async <T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> => {
    try {
      const result = await api.get<T>(endpoint);
      if (options.showSuccess !== false) {
        handleSuccess(options.successMessage);
      }
      return result;
    } catch (error) {
      handleError(error, options.errorMessage);
      throw error;
    }
  };

  const post = async <T>(endpoint: string, body?: unknown, options: ApiClientOptions = {}): Promise<T> => {
    try {
      const result = await api.post<T>(endpoint, body);
      if (options.showSuccess !== false) {
        handleSuccess(options.successMessage);
      }
      return result;
    } catch (error) {
      handleError(error, options.errorMessage);
      throw error;
    }
  };

  const patch = async <T>(endpoint: string, body?: unknown, options: ApiClientOptions = {}): Promise<T> => {
    try {
      const result = await api.patch<T>(endpoint, body);
      if (options.showSuccess !== false) {
        handleSuccess(options.successMessage);
      }
      return result;
    } catch (error) {
      handleError(error, options.errorMessage);
      throw error;
    }
  };

  const del = async <T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> => {
    try {
      const result = await api.delete<T>(endpoint);
      if (options.showSuccess !== false) {
        handleSuccess(options.successMessage);
      }
      return result;
    } catch (error) {
      handleError(error, options.errorMessage);
      throw error;
    }
  };

  const upload = async <T>(endpoint: string, formData: FormData, options: ApiClientOptions = {}): Promise<T> => {
    try {
      const result = await api.upload<T>(endpoint, formData);
      if (options.showSuccess !== false) {
        handleSuccess(options.successMessage);
      }
      return result;
    } catch (error) {
      handleError(error, options.errorMessage);
      throw error;
    }
  };

  return {
    get,
    post,
    patch,
    delete: del,
    upload,
  };
}

// --- Endpoints re-exportados ---

export { endpoints };
export { ApiError };
