import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Expand, Play, Pause, Video as VideoIcon, MessageSquare } from 'lucide-react';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomImage } from '@/components/ui/CustomImage';
import { CustomDialog } from '@/components/ui/CustomDialog';
import { EvidenceGalleryModal } from '@/components/EvidenceGalleryModal';

export type EvidenceType = 'reception' | 'work_progress' | 'final';

export interface EvidenceItem {
  url: string;
  evidence_type: EvidenceType;
  created_at?: string;
}

// Type for evidence that can be either a string (legacy) or EvidenceItem
export type EvidenceInput = string | EvidenceItem;

interface EvidenceGalleryProps {
  evidence: EvidenceInput[];
  className?: string;
  /** Tipos de evidencia permitidos para mostrar. Default: todos */
  allowedTypes?: Array<'reception' | 'work_progress' | 'final'>;
  /** Tipo de evidencia seleccionado por defecto. Default: el primero en allowedTypes */
  defaultType?: 'reception' | 'work_progress' | 'final';
}

export function EvidenceGallery({ 
  evidence, 
  className = '',
  allowedTypes = ['reception', 'work_progress', 'final'],
  defaultType = 'reception',
}: EvidenceGalleryProps) {
  // Normalize evidence to EvidenceItem[]
  const normalizedEvidence = useMemo(() => 
    evidence.map(item => 
      typeof item === 'string' 
        ? { url: item, evidence_type: 'work_progress' as EvidenceType, created_at: undefined }
        : item
    ),
    [evidence]
  );
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
  const isVideo = (url: string) => {
    return /\.(mp4|mov|webm)($|\?)/i.test(url);
  };

  const [activeType, setActiveType] = useState(() => 
    allowedTypes.includes(defaultType) ? defaultType : allowedTypes[0]
  );

  // Filtrar evidencias por tipo activo
  const filteredEvidence = useMemo(() => 
    normalizedEvidence.filter(e => e.evidence_type === activeType),
    [normalizedEvidence, activeType]
  );

  // Evidencias ordenadas: primero por tipo (reception -> work_progress -> final), luego por fecha ascendente
  const sortedEvidence = useMemo(() => {
    const typeOrder: Record<string, number> = {
      reception: 0,
      work_progress: 1,
      final: 2,
    };
    return [...filteredEvidence].sort((a, b) => {
      const typeDiff = (typeOrder[a.evidence_type] ?? 99) - (typeOrder[b.evidence_type] ?? 99);
      if (typeDiff !== 0) return typeDiff;
      // Dentro del mismo tipo, ordenar por fecha ascendente
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });
  }, [filteredEvidence]);

  const currentEvidence = sortedEvidence[currentIndex];
  const currentUrl = currentEvidence?.url;
  const currentIsVideo = currentUrl ? isVideo(currentUrl) : false;
  const currentEvidenceType = currentEvidence?.evidence_type;

  // Pause auto-play on hover
  const handleMouseEnter = useCallback(() => setAutoPlay(false), []);
  const handleMouseLeave = useCallback(() => setAutoPlay(true), []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? sortedEvidence.length - 1 : prev - 1));
  }, [sortedEvidence.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === sortedEvidence.length - 1 ? 0 : prev + 1));
  }, [sortedEvidence.length]);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  if (normalizedEvidence.length === 0) return null;

  return (
    <div className={className}>
      {/* Type Tabs - Desktop */}
      {allowedTypes.length > 1 && (
        <div className="mb-3 hidden sm:flex gap-1" role="tablist" aria-label="Tipos de evidencia">
          {allowedTypes.map((type) => (
            <button
              key={type}
              role="tab"
              aria-selected={activeType === type}
              aria-controls={`panel-${type}`}
              id={`tab-${type}`}
              onClick={() => setActiveType(type)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeType === type
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="hidden sm:inline">{type === 'reception' && '📥 '}{type === 'work_progress' && '🔧 '}{type === 'final' && '✅ '}</span>
              <span className="hidden sm:inline capitalize">{type === 'reception' && 'Recepción'}{type === 'work_progress' && 'Progreso'}{type === 'final' && 'Final'}</span>
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-5 text-xs px-1.5 rounded-full bg-slate-100 text-slate-500">
                {(() => {
                  const count = normalizedEvidence.filter(e => e.evidence_type === type).length;
                  return count > 0 ? count : null;
                })()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Type Select - Mobile */}
      {allowedTypes.length > 1 && (
        <div className="mb-3 sm:hidden">
          <label htmlFor="evidence-type-select" className="sr-only">Tipo de evidencia</label>
          <select
            id="evidence-type-select"
            value={activeType}
            onChange={(e) => setActiveType(e.target.value as 'reception' | 'work_progress' | 'final')}
            className="input-field w-full"
          >
            {allowedTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'reception' && '📥 Recepción'}
                {type === 'work_progress' && '🔧 Progreso'}
                {type === 'final' && '✅ Entrega final'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Carousel */}
      <div
        ref={carouselRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative rounded-xl overflow-hidden bg-slate-100"
      >
        {/* Carousel Content */}
        <div className="relative aspect-video">
          {sortedEvidence.length === 0 ? (
            // Empty state for selected type
            <div className="flex h-full w-full items-center justify-center bg-slate-50">
              <div className="text-center px-4">
                <div className="mb-3 text-4xl">
                  {activeType === 'reception' && '📥'}
                  {activeType === 'work_progress' && '🔧'}
                  {activeType === 'final' && '✅'}
                </div>
                <p className="text-lg font-medium text-slate-700 capitalize">
                  {activeType === 'reception' && 'Sin evidencias de recepción'}
                  {activeType === 'work_progress' && 'Sin evidencias de progreso'}
                  {activeType === 'final' && 'Sin evidencias de entrega'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Las evidencias de este tipo aparecerán aquí cuando se carguen.
                </p>
              </div>
            </div>
          ) : (
            <>
              {currentIsVideo ? (
                <video
                  src={currentUrl}
                  controls
                  className="w-full h-full object-contain bg-black"
                  poster={sortedEvidence.find((e) => !isVideo(e.url))?.url}
                />
              ) : (
                <CustomImage
                  src={currentUrl}
                  alt={`Evidencia ${currentIndex + 1}`}
                  className="w-full h-full object-contain"
                />
              )}
            </>
          )}
        </div>

        {/* Navigation Arrows */}
        {sortedEvidence.length > 1 && (
          <div>
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
          </div>
        )}

        {/* Dots Indicators */}
        {sortedEvidence.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {sortedEvidence.map((item, idx) => (
              <button
                key={item.url}
                onClick={() => goToIndex(idx)}
                className={`h-2 w-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'bg-white w-6 shadow-md'
                    : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`Ir a evidencia ${idx + 1}`}
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
        {sortedEvidence.length > 1 && (
          <div className="absolute left-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {currentIndex + 1} / {sortedEvidence.length}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute left-2 top-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-white/90 shadow-sm">
            <span className="text-slate-500">
              {sortedEvidence[currentIndex]?.evidence_type === 'reception' && '📥 '}
              {sortedEvidence[currentIndex]?.evidence_type === 'work_progress' && '🔧 '}
              {sortedEvidence[currentIndex]?.evidence_type === 'final' && '✅ '}
            </span>
            <span className="text-slate-700 capitalize">
              {sortedEvidence[currentIndex]?.evidence_type === 'reception' && 'Recepción'}
              {sortedEvidence[currentIndex]?.evidence_type === 'work_progress' && 'Progreso'}
              {sortedEvidence[currentIndex]?.evidence_type === 'final' && 'Entrega final'}
            </span>
          </span>
        </div>

        {/* Counter by type */}
        <div className="absolute right-2 bottom-2 text-xs text-slate-500">
          {(() => {
            const currentType = sortedEvidence[currentIndex]?.evidence_type;
            const totalOfType = normalizedEvidence.filter(e => e.evidence_type === currentType).length;
            const indexOfType = sortedEvidence
              .slice(0, currentIndex + 1)
              .filter(e => e.evidence_type === currentType).length;
            return `${indexOfType} / ${totalOfType}`;
          })()}
        </div>
      </div>

      {/* Thumbnails Strip */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sortedEvidence.map((item, idx) => {
          const isVid = isVideo(item.url);
          return (
            <button
              key={item.url}
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
              {isVideo(item.url) ? (
                <div>
                  <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                </div>
              ) : (
                <CustomImage src={item.url} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 px-1">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/60 text-white">
                  {item.evidence_type === 'reception' && '📥'}
                  {item.evidence_type === 'work_progress' && '🔧'}
                  {item.evidence_type === 'final' && '✅'}
                  <span className="capitalize hidden xs:inline">
                    {item.evidence_type === 'reception' && 'Recepción'}
                    {item.evidence_type === 'work_progress' && 'Progreso'}
                    {item.evidence_type === 'final' && 'Entrega final'}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Full-screen Modal */}
      <EvidenceGalleryModal
        isOpen={isModalOpen}
        onClose={closeModal}
        evidence={sortedEvidence}
        initialIndex={currentIndex}
      />
    </div>
  );
}