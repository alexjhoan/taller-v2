import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Play, Video as VideoIcon, Image as ImageIcon } from "lucide-react";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomImage } from "@/components/ui/CustomImage";
import { CustomDialog } from "@/components/ui/CustomDialog";

export type EvidenceType = 'reception' | 'work_progress' | 'final';

interface EvidenceItem {
  url: string;
  evidence_type: EvidenceType;
  created_at?: string;
}

interface EvidenceGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceItem[];
  initialIndex?: number;
}

const isVideo = (url: string) => {
  return /\.(mp4|mov|webm)($|\?)/i.test(url);
};

export function EvidenceGalleryModal({ isOpen, onClose, evidence, initialIndex = 0 }: EvidenceGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const currentEvidence = evidence[currentIndex];
  const currentUrl = currentEvidence?.url;
  const currentIsVideo = currentUrl ? isVideo(currentUrl) : false;

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? evidence.length - 1 : prev - 1));
    setIsVideoPlaying(false);
  }, [evidence.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === evidence.length - 1 ? 0 : prev + 1));
    setIsVideoPlaying(false);
  }, [evidence.length]);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsVideoPlaying(false);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen || evidence.length === 0) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/95'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-label='Galería de evidencias'
    >
      {/* Close Button */}
      <CustomButton
        variant='ghost'
        size='sm'
        className='absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20'
        onClick={onClose}
        aria-label='Cerrar galería'
      >
        <X className='h-6 w-6' />
      </CustomButton>

      {/* Navigation Arrows */}
      {evidence.length > 1 && (
        <>
          <CustomButton
            variant='ghost'
            size='sm'
            className='absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20'
            onClick={goToPrevious}
            aria-label='Anterior'
          >
            <ChevronLeft className='h-7 w-7' />
          </CustomButton>
          <CustomButton
            variant='ghost'
            size='sm'
            className='absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20'
            onClick={goToNext}
            aria-label='Siguiente'
          >
            <ChevronRight className='h-7 w-7' />
          </CustomButton>
        </>
      )}

      {/* Main Content Area */}
      <div className='relative max-w-full max-h-full px-4 py-8'>
        {currentIsVideo ? (
          <div className='relative max-w-full max-h-[80dvh]'>
            <video
              ref={(el) => {
                if (el && isVideoPlaying) el.play().catch(() => {});
              }}
              src={currentUrl}
              controls
              className='max-w-full max-h-[80dvh] object-contain'
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
            />
          </div>
        ) : (
          <CustomImage
            src={currentUrl}
            alt={`Evidencia ${currentIndex + 1}`}
            className='max-w-full max-h-[80dvh] object-contain'
          />
        )}

        {/* Info Bar at Bottom */}
        <div className='mt-4 flex items-center justify-between text-white'>
          <div>
            <p className='text-sm font-medium'>{currentEvidence?.url?.split("/").pop() || `Evidencia ${currentIndex + 1}`}</p>
            <p className='mt-1 text-xs text-white/60 flex items-center gap-2'>
              {currentIndex + 1} de {evidence.length}
              {currentEvidence?.evidence_type && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                  {currentEvidence.evidence_type === 'reception' && '📥 Recepción'}
                  {currentEvidence.evidence_type === 'work_progress' && '🔧 Progreso'}
                  {currentEvidence.evidence_type === 'final' && '✅ Entrega final'}
                </span>
              )}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {currentIsVideo ? (
              <VideoIcon className='h-5 w-5 text-white/70' />
            ) : (
              <ImageIcon className='h-5 w-5 text-white/70' />
            )}
          </div>
        </div>
      </div>

      {/* Thumbnails Grid at Bottom */}
      {evidence.length > 1 && (
        <div
          className='absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='mx-auto max-w-5xl'>
            <p className='mb-2 text-xs font-medium text-white/70 text-center'>Miniaturas - Click para navegar</p>
            <div className='flex gap-2 overflow-x-auto pb-2 scrollbar-hide'>
              {evidence.map((item, index) => {
                const isVid = isVideo(item.url);
                return (
                  <button
                    key={item.url}
                    onClick={() => handleThumbnailClick(index)}
                    className={`relative flex-shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentIndex
                        ? "border-brand-400 ring-2 ring-brand-400/30"
                        : "border-transparent hover:border-white/30"
                    }`}
                    aria-label={`Ver evidencia ${index + 1}`}
                    aria-current={index === currentIndex ? "true" : "false"}
                  >
                    {isVid ? (
                      <>
                        <video src={item.url} className='w-full h-full object-cover' muted playsInline />
                        <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
                          <Play className='h-5 w-5 text-white' />
                        </div>
                        <div className='absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 px-1'>
                          <span className='inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/60 text-white'>
                            🔧 <span className='hidden xs:inline'>Video</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <CustomImage src={item.url} alt={`Miniatura ${index + 1}`} className='w-full h-full object-cover' />
                        <div className='absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 px-1'>
                          <span className='inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/60 text-white'>
                            {item.evidence_type === 'reception' && '📥'}
                            {item.evidence_type === 'work_progress' && '🔧'}
                            {item.evidence_type === 'final' && '✅'}
                            <span className='capitalize hidden xs:inline'>
                              {item.evidence_type === 'reception' && 'Recepción'}
                              {item.evidence_type === 'work_progress' && 'Progreso'}
                              {item.evidence_type === 'final' && 'Entrega final'}
                            </span>
                          </span>
                        </div>
                      </>
                    )}
                    {index === currentIndex && <div className='absolute inset-0 bg-brand-500/30' />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}