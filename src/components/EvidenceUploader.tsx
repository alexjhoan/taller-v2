import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image,
  Video,
  Camera,
  Images,
  RotateCcw,
  Trash2,
  Play,
  MessageSquare,
  Maximize2,
} from "lucide-react";
import { useEvidenceUpload, EVIDENCE_ACCEPT } from "@/hooks/useEvidenceUpload";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { CustomDialog } from "@/components/ui/CustomDialog";

const FILE_ICONS: Record<string, typeof FileText> = {
  "image/jpeg": Image,
  "image/png": Image,
  "image/webp": Image,
  "video/mp4": Video,
  "video/quicktime": Video,
};

// Tipos de evidencia
export type EvidenceType = "reception" | "work_progress" | "final";

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  reception: "Recepción",
  work_progress: "Progreso de trabajo",
  final: "Entrega final",
};

const EVIDENCE_TYPE_ICONS: Record<EvidenceType, typeof MessageSquare> = {
  reception: MessageSquare,
  work_progress: MessageSquare,
  final: MessageSquare,
};

const EVIDENCE_TYPE_DESCRIPTIONS: Record<EvidenceType, string> = {
  reception: "Fotos/videos al recibir el vehículo",
  work_progress: "Fotos/videos durante la reparación",
  final: "Fotos finales al entregar el vehículo",
};

// Hook para gestionar object URLs de archivos (miniaturas)
function useObjectUrls(files: UploadFile[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const newUrls = new Map<string, string>();
    files.forEach((f) => {
      if (f.file.type.startsWith("image/") || f.file.type.startsWith("video/")) {
        newUrls.set(f.id, URL.createObjectURL(f.file));
      }
    });
    setUrls(newUrls);
    return () => {
      newUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  return urls;
}

interface EvidenceUploaderProps {
  orderId: number;
  onUploadComplete?: (urls: string[]) => void;
  onFilesSelected?: (files: File[]) => void;
  selectionOnly?: boolean;
  /** Tipos de evidencia permitidos. Default: todos los tipos. */
  allowedTypes?: EvidenceType[];
}

export function EvidenceUploader({
  orderId,
  onUploadComplete,
  onFilesSelected,
  selectionOnly = false,
  allowedTypes = ["reception", "work_progress", "final"],
}: EvidenceUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  // Input de la zona de drop / botón "Seleccionar de galería" (sin capture)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Camera modal state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Evidence type state
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(allowedTypes[0] || "work_progress");

  // Image preview modal state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const { files, isUploading, overallProgress, addFiles, removeFile, clearCompleted, retryFile, uploadSequentially } =
    useEvidenceUpload({ orderId, onAllCompleted: onUploadComplete, evidenceType });

  // Miniaturas con object URLs
  const objectUrls = useObjectUrls(files);

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  // En modo selección, todos los archivos son "seleccionados"
  const selectedCount = selectionOnly ? files.length : pendingCount;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      addFiles(e.dataTransfer.files);
      onFilesSelected?.(filesArray);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      addFiles(e.target.files);
      onFilesSelected?.(filesArray);
      e.target.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: UploadFile["status"]) => {
    switch (status) {
      case "uploading":
        return <Loader2 className='h-4 w-4 animate-spin text-brand-600' />;
      case "completed":
        return <CheckCircle2 className='h-4 w-4 text-emerald-600' />;
      case "error":
        return <AlertCircle className='h-4 w-4 text-red-600' />;
      default:
        return <Upload className='h-4 w-4 text-slate-400' />;
    }
  };

  const getStatusBadge = (status: UploadFile["status"]) => {
    if (selectionOnly) {
      return (
        <CustomBadge variant='info' dot>
          Seleccionado
        </CustomBadge>
      );
    }
    switch (status) {
      case "uploading":
        return (
          <CustomBadge variant='info' dot>
            Subiendo...
          </CustomBadge>
        );
      case "completed":
        return (
          <CustomBadge variant='success' dot>
            Completado
          </CustomBadge>
        );
      case "error":
        return (
          <CustomBadge variant='danger' dot>
            Error
          </CustomBadge>
        );
      default:
        return (
          <CustomBadge variant='neutral' dot>
            Pendiente
          </CustomBadge>
        );
    }
  };

  // --- Camera Modal Logic ---
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setCameraError("Permiso de cámara denegado. Habilita el permiso en la configuración del navegador.");
        } else if (err.name === "NotFoundError") {
          setCameraError("No se encontró ninguna cámara en este dispositivo.");
        } else if (err.name === "NotReadableError") {
          setCameraError("La cámara está en uso por otra aplicación.");
        } else if (err.name === "OverconstrainedError") {
          setCameraError("No se pudo acceder a la cámara trasera. Intentando con la frontal...");
          setFacingMode("user");
          // Retry with user-facing camera
          setTimeout(() => startCamera(), 100);
        } else {
          setCameraError(`Error al acceder a la cámara: ${err.message}`);
        }
      } else {
        setCameraError("Error desconocido al acceder a la cámara.");
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    // Restart camera with new facingMode after a brief delay
    setTimeout(startCamera, 100);
  }, [stopCamera, startCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // Create a file from blob
          const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
          addFiles([file]);
          onFilesSelected?.([file]);
          closeCameraModal();
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [addFiles, onFilesSelected]);

  const openCameraModal = useCallback(() => {
    setIsCameraModalOpen(true);
    // Start camera after modal opens (to ensure video element is mounted)
    setTimeout(startCamera, 100);
  }, [startCamera]);

  const closeCameraModal = useCallback(() => {
    stopCamera();
    setIsCameraModalOpen(false);
    setCameraError(null);
  }, [stopCamera]);

  return (
    <CustomCard className={isDragOver ? "border-brand-300 bg-brand-50" : ""}>
      <div className='mb-4 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50'>
            <Upload className='h-4 w-4 text-brand-600' />
          </div>
          <h2 className='text-sm font-bold text-slate-800'>Cargar Evidencias</h2>
        </div>
        {files.length > 0 && !selectionOnly && (
          <div className='flex items-center gap-2'>
            {completedCount > 0 && (
              <CustomButton variant='secondary' size='sm' onClick={clearCompleted} disabled={isUploading}>
                <X className='h-3.5 w-3.5' />
                Limpiar completados
              </CustomButton>
            )}
            <CustomButton
              size='sm'
              leftIcon={<Upload className='h-3.5 w-3.5' />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Agregar archivos
            </CustomButton>
          </div>
        )}
        {files.length > 0 && selectionOnly && (
          <CustomButton
            size='sm'
            leftIcon={<Upload className='h-3.5 w-3.5' />}
            onClick={() => fileInputRef.current?.click()}
          >
            Agregar más
          </CustomButton>
        )}
      </div>

      {/* Zona de drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed ${
          isDragOver ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-300"
        } transition-colors p-6 text-center`}
      >
        {/* Desktop / selector del SO (en algunos Android ofrece Cámara y Galería) */}
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={EVIDENCE_ACCEPT}
          onChange={handleFileSelect}
          className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
        />
        <div className='relative z-10'>
          <Upload className='mx-auto h-12 w-12 text-slate-300' />
          <p className='mt-3 text-sm font-medium text-slate-600'>
            <span className='hidden sm:inline'>Arrastra archivos aquí o usa los botones para agregar evidencia</span>
            <span className='sm:hidden'>Agrega evidencia desde la cámara o la galería</span>
          </p>
          {/* Selector de tipo de evidencia (solo si hay más de 1 tipo permitido) */}
          {allowedTypes.length > 1 && (
            <div className='mt-3 mb-2'>
              <label className='block text-xs font-medium text-slate-600 mb-1'>Tipo de evidencia</label>
              <select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                className='input-field w-full sm:w-auto'
              >
                {allowedTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "reception" && "📥 Recepción — Fotos al recibir el vehículo"}
                    {type === "work_progress" && "🔧 Progreso de trabajo — Fotos durante la reparación"}
                    {type === "final" && "✅ Entrega final — Fotos al entregar"}
                  </option>
                ))}
              </select>
              <p className='mt-1 text-xs text-slate-500'>{EVIDENCE_TYPE_DESCRIPTIONS[evidenceType]}</p>
            </div>
          )}

          <div className='mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center'>
            <CustomButton
              type='button'
              size='md'
              leftIcon={<Camera className='h-4 w-4' />}
              onClick={openCameraModal}
              disabled={isUploading && !selectionOnly}
            >
              Tomar foto con cámara
            </CustomButton>
            <CustomButton
              type='button'
              variant='secondary'
              size='md'
              leftIcon={<Images className='h-4 w-4' />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading && !selectionOnly}
            >
              Seleccionar de galería
            </CustomButton>
          </div>
          <p className='mt-3 text-xs text-slate-400'>JPG, PNG, WebP, MP4, MOV · Máx. 50 MB c/u</p>
        </div>
      </div>

      {/* Barra de progreso general (solo en modo subida) */}
      {!selectionOnly && (isUploading || pendingCount > 0) && (
        <div className='mt-4'>
          <div className='flex items-center justify-between text-xs mb-1'>
            <span className='font-medium text-slate-600'>Progreso general</span>
            <span className='font-bold text-brand-600'>{overallProgress}%</span>
          </div>
          <div className='h-2 overflow-hidden rounded-full bg-slate-100'>
            <div
              className='h-full rounded-full bg-brand-600 transition-all duration-300 ease-out'
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className='mt-1 text-xs text-slate-400'>
            {uploadingCount > 0
              ? `Subiendo ${uploadingCount} de ${files.length}...`
              : pendingCount > 0
                ? `${pendingCount} archivo(s) en cola`
                : "Completado"}
          </p>
        </div>
      )}

      {/* Lista de archivos */}
      {files.length > 0 && (
        <div className='mt-4 space-y-3 max-h-80 overflow-y-auto'>
          {files.map((file) => {
            const Icon = FILE_ICONS[file.file.type] || FileText;
            const isSelectedMode = selectionOnly;
            const thumbnailUrl = objectUrls.get(file.id);
            const isImage = file.file.type.startsWith("image/");
            const isVideo = file.file.type.startsWith("video/");
            return (
              <div
                key={file.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  isSelectedMode
                    ? "border-slate-100 bg-white"
                    : file.status === "completed"
                      ? "border-emerald-200 bg-emerald-50"
                      : file.status === "error"
                        ? "border-red-200 bg-red-50"
                        : file.status === "uploading"
                          ? "border-brand-200 bg-brand-50"
                          : "border-slate-100 bg-white"
                }`}
              >
                {/* Miniatura del archivo */}
                <div className='h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100'>
                  {isImage && thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={file.file.name}
                      className='h-full w-full object-cover cursor-zoom-in'
                      onClick={() => setPreviewImageUrl(thumbnailUrl)}
                    />
                  ) : isVideo && thumbnailUrl ? (
                    <div className='relative h-full w-full'>
                      <video
                        src={thumbnailUrl}
                        muted
                        playsInline
                        preload='metadata'
                        className='h-full w-full object-cover'
                      />
                      <div className='absolute inset-0 flex items-center justify-center bg-black/20'>
                        <Play className='h-5 w-5 text-white drop-shadow-md' fill='white' />
                      </div>
                    </div>
                  ) : (
                    <div className='flex h-full w-full items-center justify-center'>
                      <Icon className='h-5 w-5 text-slate-500' />
                    </div>
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-slate-800 truncate'>{file.file.name}</p>
                  <div className='mt-1 flex items-center gap-2 text-xs text-slate-400'>
                    <span>{formatFileSize(file.file.size)}</span>
                    <span>·</span>
                    <span>{file.file.type.startsWith("image/") ? "Imagen" : "Video"}</span>
                  </div>
                  {!selectionOnly && file.status === "uploading" && (
                    <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 w-48'>
                      <div
                        className='h-full rounded-full bg-brand-600 transition-all duration-200'
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                  {file.status === "error" && file.error && <p className='mt-1 text-xs text-red-600'>{file.error}</p>}
                </div>
                <div className='flex flex-col items-end gap-2'>
                  {getStatusBadge(file.status)}
                  <div className='flex items-center gap-1'>
                    {!selectionOnly && file.status === "error" && (
                      <CustomButton variant='ghost' size='sm' onClick={() => retryFile(file.id)} className='h-8 px-2'>
                        <RotateCcw className='h-3.5 w-3.5' />
                      </CustomButton>
                    )}
                    {file.status !== "uploading" && (
                      <CustomButton
                        variant='ghost'
                        size='sm'
                        onClick={() => removeFile(file.id)}
                        className='h-8 px-2 text-red-500 hover:bg-red-50'
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </CustomButton>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón de subida (solo en modo subida) */}
      {!selectionOnly && pendingCount > 0 && !isUploading && (
        <div className='mt-4'>
          <CustomButton
            size='lg'
            className='w-full'
            leftIcon={<Upload className='h-5 w-5' />}
            onClick={uploadSequentially}
          >
            Subir {pendingCount} archivo(s)
          </CustomButton>
        </div>
      )}

      {/* Resumen */}
      {files.length > 0 && (
        <div className='mt-4 flex items-center justify-between text-xs text-slate-400'>
          <span>
            {selectionOnly
              ? `Total: ${files.length} archivo(s) seleccionado(s)`
              : `Total: ${files.length} · Pendientes: ${pendingCount} · Subiendo: ${uploadingCount}`}
          </span>
          <span>{selectionOnly ? "" : `Completados: ${completedCount} · Errores: ${errorCount}`}</span>
        </div>
      )}

      {/* Camera Modal */}
      <CustomDialog open={isCameraModalOpen} onClose={closeCameraModal} title='Tomar foto con cámara' maxWidth='md'>
        <div className='space-y-4'>
          {cameraError && (
            <div className='rounded-lg bg-red-50 p-3 text-sm text-red-700' role='alert'>
              {cameraError}
              {cameraError.includes("trasera") && (
                <CustomButton
                  variant='secondary'
                  size='sm'
                  className='mt-2'
                  onClick={() => {
                    setFacingMode("user");
                    startCamera();
                  }}
                >
                  Usar cámara frontal
                </CustomButton>
              )}
            </div>
          )}

          <div className='relative aspect-video bg-black rounded-lg overflow-hidden'>
            <video ref={videoRef} className='w-full h-full object-cover' autoPlay playsInline muted />
            {!cameraStream && !cameraError && (
              <div className='absolute inset-0 flex items-center justify-center text-white'>
                <Loader2 className='h-8 w-8 animate-spin' />
                <span className='ml-2'>Iniciando cámara...</span>
              </div>
            )}
            {cameraError && (
              <div className='absolute inset-0 flex items-center justify-center text-white p-4 text-center'>
                <AlertCircle className='h-8 w-8' />
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className='hidden' />

          <div className='flex items-center justify-center gap-4'>
            <CustomButton
              variant='secondary'
              size='sm'
              onClick={switchCamera}
              disabled={!cameraStream}
              aria-label='Cambiar cámara'
              className='p-2'
            >
              <RotateCcw className='h-5 w-5' />
            </CustomButton>
            <CustomButton
              type='button'
              size='lg'
              leftIcon={<Camera className='h-5 w-5' />}
              onClick={capturePhoto}
              disabled={!cameraStream || (isUploading && !selectionOnly)}
              className='min-w-[160px]'
            >
              Capturar
            </CustomButton>
            <CustomButton
              variant='secondary'
              size='sm'
              onClick={closeCameraModal}
              aria-label='Cerrar cámara'
              className='p-2'
            >
              <X className='h-5 w-5' />
            </CustomButton>
          </div>

          <p className='text-center text-xs text-slate-400'>La foto se guardará como JPG (calidad 90%)</p>
        </div>
      </CustomDialog>

      {/* Image Preview Modal */}
      <CustomDialog
        open={previewImageUrl !== null}
        onClose={() => setPreviewImageUrl(null)}
        title='Vista previa'
        maxWidth='xl'
      >
        <div className='relative aspect-square max-h-[80vh]'>
          <img src={previewImageUrl!} alt='Vista previa' className='w-full h-full object-contain' />
        </div>
      </CustomDialog>
    </CustomCard>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadFile = {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  responseUrl?: string;
};
