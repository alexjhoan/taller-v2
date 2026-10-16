import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Expand, Play, Pause, Video as VideoIcon } from 'lucide-react';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomImage } from '@/components/ui/CustomImage';
import { EvidenceGalleryModal } from '@/components/EvidenceGalleryModal';

interface EvidenceGalleryProps {
  evidence: string[];
  className?: string;
}

export function EvidenceGallery({ evidence, className = '' }: EvidenceGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Auto-play logic
  useEffect(() => {
    if (!autoPlay || evidence.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev === evidence.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, evidence.length]);

  // Pause auto-play on hover
  const handleMouseEnter = useCallback(() => setAutoPlay(false), []);
  const handleMouseLeave = useCallback(() => setAutoPlay(true), []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? evidence.length - 1 : prev - 1));
  }, [evidence.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === evidence.length - 1 ? 0 : prev + 1));
  }, [evidence.length]);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const isVideo = (url: string) => {
    return /\.(mp4|mov|webm)($|\?)/i.test(url);
  };

  if (evidence.length === 0) return null;

  const currentUrl = evidence[currentIndex];
  const currentIsVideo = isVideo(currentUrl);

  return (
    <div className={className}>
      {/* Main Carousel */}
      <div
        ref={carouselRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative rounded-xl overflow-hidden bg-slate-100"
      >
        {/* Carousel Content */}
        <div className="relative aspect-video">
          {currentIsVideo ? (
            <video
              src={currentUrl}
              controls
              className="w-full h-full object-contain bg-black"
              poster={evidence.find((url) => !isVideo(url))}
            />
          ) : (
            <CustomImage
              src={currentUrl}
              alt={`Evidencia ${currentIndex + 1}`}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Navigation Arrows */}
        {evidence.length > 1 && (
          <>
            <CustomButton
              variant="ghost"
              size="sm"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-md hover:bg-white p-1.5"
              onClick={goToPrevious}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </CustomButton>
            <CustomButton
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-md hover:bg-white p-1.5"
              onClick={goToNext}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </CustomButton>
          </>
        )}

        {/* Dots Indicators */}
        {evidence.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {evidence.map((url) => (
              <button
                key={url}
                onClick={() => goToIndex(evidence.indexOf(url))}
                className={`h-2 w-2 rounded-full transition-all ${
                  url === currentUrl
                    ? 'bg-white w-6 shadow-md'
                    : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`Ir a evidencia ${evidence.indexOf(url) + 1}`}
              />
            ))}
          </div>
        )}

        {/* Expand Button - Top Right */}
        <CustomButton
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 rounded-full bg-white/90 shadow-md hover:bg-white p-1.5"
          onClick={openModal}
          aria-label="Ver en pantalla completa"
        >
          <Expand className="h-5 w-5 text-slate-700" />
        </CustomButton>

        {/* Counter */}
        {evidence.length > 1 && (
          <div className="absolute left-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {currentIndex + 1} / {evidence.length}
          </div>
        )}
      </div>

      {/* Thumbnails Strip */}
      {evidence.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {evidence.map((url) => {
            const isVid = isVideo(url);
            const idx = evidence.indexOf(url);
            return (
              <button
                key={url}
                onClick={() => {
                  goToIndex(idx);
                  setAutoPlay(false);
                }}
                className={`relative flex-shrink-0 h-20 w-28 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex
                    ? 'border-brand-500 ring-2 ring-brand-500/20'
                    : 'border-transparent hover:border-slate-300'
                }`}
                aria-label={`Evidencia ${idx + 1}`}
                aria-current={idx === currentIndex ? 'true' : 'false'}
              >
                {isVid ? (
                  <>
                    <video src={url} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                  </>
                ) : (
                  <CustomImage src={url} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Full-screen Modal */}
      <EvidenceGalleryModal
        isOpen={isModalOpen}
        onClose={closeModal}
        evidence={evidence}
        initialIndex={currentIndex}
      />
    </div>
  );
}