import { useCallback, useRef, useState } from 'react';
import { api, endpoints, ApiError, getApiToken } from '@/services/api';
import { useSnackbar } from 'notistack';
import { generateShortUid } from '@/utils/uid';

export const EVIDENCE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
];
export const EVIDENCE_MAX_SIZE = 50 * 1024 * 1024; // 50 MB
export const EVIDENCE_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  responseUrl?: string;
}

interface UseEvidenceUploadOptions {
  orderId: number;
  onAllCompleted?: (urls: string[]) => void;
}

export function useEvidenceUpload({ orderId, onAllCompleted }: UseEvidenceUploadOptions) {
  const { enqueueSnackbar } = useSnackbar();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const filesRef = useRef(files);

  // Keep ref in sync
  filesRef.current = files;

  const validateFile = (file: File): string | null => {
    if (!EVIDENCE_ALLOWED_TYPES.includes(file.type)) {
      return 'Formato no permitido. Use JPG, PNG, WebP, MP4 o MOV.';
    }
    if (file.size > EVIDENCE_MAX_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return `Archivo de ${sizeMb} MB. El máximo permitido es 50 MB.`;
    }
    return null;
  };

  const uploadSingleFile = useCallback(
    async (file: UploadFile): Promise<UploadFile> => {
      const validationError = validateFile(file.file);
      if (validationError) {
        return { ...file, status: 'error', error: validationError };
      }

      const formData = new FormData();
      formData.append('file', file.file);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}${endpoints.evidence(orderId)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getApiToken() || ''}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new ApiError(
            response.status,
            errorBody.statusText || response.statusText,
            errorBody
          );
        }

        const data = await response.json();
        return {
          ...file,
          status: 'completed',
          progress: 100,
          responseUrl: data.body?.url,
        };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            ...file,
            status: 'error',
            error: `[ApiError ${error.status}] ${error.message}`,
          };
        }
        return { ...file, status: 'error', error: String(error) };
      }
    },
    [orderId]
  );

  const uploadSequentially = useCallback(async () => {
    // Get fresh pending files from ref
    const pendingFiles = filesRef.current.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    const completedUrls: string[] = [];

    for (const file of pendingFiles) {
      // Update to uploading
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f))
      );

      try {
        const formData = new FormData();
        formData.append('file', file.file);

        // Use XMLHttpRequest for real progress
        const uploadedFile = await new Promise<UploadFile>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const token = getApiToken() || '';

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setFiles((prev) =>
                prev.map((f) => (f.id === file.id ? { ...f, progress } : f))
              );
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve({
                  ...file,
                  status: 'completed',
                  progress: 100,
                  responseUrl: data.body?.url,
                });
              } catch {
                resolve({ ...file, status: 'error', error: 'Respuesta inválida del servidor' });
              }
            } else {
              try {
                const errorBody = JSON.parse(xhr.responseText);
                reject(new ApiError(xhr.status, errorBody.statusText || xhr.statusText, errorBody));
              } catch {
                reject(new ApiError(xhr.status, 'Error desconocido', {}));
              }
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Error de red')));
          xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

          xhr.open('POST', `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}${endpoints.evidence(orderId)}`);
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });

        // Update completed file
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? uploadedFile : f))
        );
        completedUrls.push(uploadedFile.responseUrl!);

        // Update overall progress based on current ref state
        const completedCount = filesRef.current.filter((f) => f.status === 'completed').length;
        const totalFiles = filesRef.current.length;
        setOverallProgress(Math.round((completedCount / totalFiles) * 100));
      } catch (error) {
        let errorMsg = 'Error desconocido';
        if (error instanceof ApiError) {
          errorMsg = `[ApiError ${error.status}] ${error.message}`;
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: 'error', error: errorMsg } : f))
        );
        // Continue with next file
      }
    }

    if (completedUrls.length > 0) {
      enqueueSnackbar(`${completedUrls.length} archivo(s) subido(s) correctamente`, { variant: 'success' });
      onAllCompleted?.(completedUrls);
    }

    setIsUploading(false);
    setOverallProgress(0);
  }, [orderId, onAllCompleted]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const newUploadFiles: UploadFile[] = fileArray.map((file) => ({
      file,
      id: generateShortUid(),
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newUploadFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  }, []);

  const retryFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f))
    );
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setOverallProgress(0);
  }, []);

  return {
    files,
    isUploading,
    overallProgress,
    addFiles,
    removeFile,
    clearCompleted,
    retryFile,
    clearAll,
    uploadSequentially,
  };
}