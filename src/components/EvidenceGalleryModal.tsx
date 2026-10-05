import { useState } from 'react';
import {
  X,
  Play,
  Pause,
  Camera,
  Mic,
  FileText,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Link2,
} from 'lucide-react';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomButton } from '@/components/ui/CustomButton';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomImage } from '@/components/ui/CustomImage';

// --- Tipos autocontenidos ---

type EvidenceType = 'photo' | 'audio' | 'video';

interface MetricComparison {
  measured: string;
  safeMinimum: string;
  percentageWear: number;
}

interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  fileUrl: string;
  timestamp: string;
  criticality: 'critical' | 'recommended' | 'informative';
  metricComparison?: MetricComparison;
  linkedPartId?: string;
}

interface AudioTranscription {
  text: string;
  timestamp: string;
}

// --- Datos mock ---

const MOCK_EVIDENCE: EvidenceItem[] = [
  {
    id: '1',
    type: 'photo',
    title: 'Pastilla de freno delantera izquierda',
    description: 'Desgaste severo detectado en pastilla delantera izquierda. Se recomienda reemplazo inmediato.',
    fileUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    timestamp: '2026-09-22 11:30:00',
    criticality: 'critical',
    metricComparison: {
      measured: '1.4mm',
      safeMinimum: '3.5mm',
      percentageWear: 60,
    },
    linkedPartId: '2',
  },
  {
    id: '2',
    type: 'photo',
    title: 'Disco de freno delantero',
    description: 'Disco con desgaste irregular y ranuras profundas.',
    fileUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800',
    timestamp: '2026-09-22 11:35:00',
    criticality: 'critical',
    metricComparison: {
      measured: '18.2mm',
      safeMinimum: '20.0mm',
      percentageWear: 9,
    },
    linkedPartId: '3',
  },
  {
    id: '3',
    type: 'audio',
    title: 'Nota de voz del mecánico',
    description: 'Diagnóstico audible de la falla reportada por el cliente.',
    fileUrl: '/audio/diagnostico.mp3',
    timestamp: '2026-09-22 11:40:00',
    criticality: 'informative',
  },
  {
    id: '4',
    type: 'photo',
    title: 'Líquido de frenos',
    description: 'Nivel de líquido de frenos por debajo del mínimo recomendado.',
    fileUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800',
    timestamp: '2026-09-22 11:45:00',
    criticality: 'recommended',
    linkedPartId: '4',
  },
];

const MOCK_TRANSCRIPTION: AudioTranscription = {
  text: 'Se detecta desgaste severo en pastillas delanteras. El cliente reporta vibración al frenar. Se recomienda reemplazo de pastillas y rectificación de discos. Nivel de líquido de frenos bajo, posible fugas en cilindro maestro.',
  timestamp: '2026-09-22 11:40:00',
};

// --- Componente Principal ---

interface EvidenceGalleryModalProps {
  token: string;
}

export function EvidenceGalleryModal({ token }: EvidenceGalleryModalProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const photos = MOCK_EVIDENCE.filter((e) => e.type === 'photo');
  const audios = MOCK_EVIDENCE.filter((e) => e.type === 'audio');

  const getCriticalityBadge = (criticality: EvidenceItem['criticality']) => {
    switch (criticality) {
      case 'critical':
        return (
          <CustomBadge variant="danger" dot>
            Crítico
          </CustomBadge>
        );
      case 'recommended':
        return (
          <CustomBadge variant="warning" dot>
            Recomendado
          </CustomBadge>
        );
      case 'informative':
        return (
          <CustomBadge variant="info" dot>
            Informativo
          </CustomBadge>
        );
    }
  };

  const getWearColor = (percentage: number): string => {
    if (percentage >= 50) return 'bg-red-500';
    if (percentage >= 25) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const handlePlayAudio = () => {
    setIsPlaying(!isPlaying);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    } else {
      setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Evidencias del Taller
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Token: {token.slice(0, 8)}...
        </p>
      </div>

      {/* --- Audio del Mecánico --- */}
      {audios.length > 0 && (
        <CustomCard>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <Mic className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Audio del Mecánico</h2>
          </div>

          {audios.map((audio) => (
            <div key={audio.id} className="space-y-4">
              {/* Player */}
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <button
                  onClick={handlePlayAudio}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{audio.title}</p>
                  <p className="text-xs font-medium text-slate-400">{audio.timestamp}</p>
                  {/* Barra de progreso simulada */}
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-1/3 rounded-full bg-brand-600" />
                  </div>
                </div>
              </div>

              {/* Transcripción */}
              {MOCK_TRANSCRIPTION && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">
                      Transcripción automática
                    </span>
                  </div>
                  <p className="text-sm italic text-slate-600">
                    &ldquo;{MOCK_TRANSCRIPTION.text}&rdquo;
                  </p>
                </div>
              )}
            </div>
          ))}
        </CustomCard>
      )}

      {/* --- Galería Fotográfica --- */}
      <CustomCard>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <Camera className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">
            Fotos de Hallazgos ({photos.length})
          </h2>
        </div>

        <div className="space-y-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="space-y-3">
              {/* Imagen */}
              <div className="relative">
                <CustomImage
                  src={photo.fileUrl}
                  alt={photo.title}
                  className="h-48 w-full"
                  onClick={() => {
                    setSelectedEvidence(photo);
                    setCurrentPhotoIndex(index);
                  }}
                />
                <div className="absolute right-2 top-2">
                  {getCriticalityBadge(photo.criticality)}
                </div>
              </div>

              {/* Info */}
              <div>
                <p className="text-sm font-bold text-slate-800">{photo.title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{photo.description}</p>
              </div>

              {/* Comparador métrico */}
              {photo.metricComparison && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Comparador de desgaste
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {photo.metricComparison.percentageWear}% desgastado
                    </span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${getWearColor(photo.metricComparison.percentageWear)}`}
                      style={{ width: `${photo.metricComparison.percentageWear}%` }}
                    />
                    {/* Marcador de mínimo seguro */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-slate-800"
                      style={{ left: `${100 - photo.metricComparison.percentageWear}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>Medido: {photo.metricComparison.measured}</span>
                    <span>Mínimo seguro: {photo.metricComparison.safeMinimum}</span>
                  </div>
                </div>
              )}

              {/* Vinculación con repuesto */}
              {photo.linkedPartId && (
                <button className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100">
                  <Link2 className="h-3.5 w-3.5" />
                  Vinculado al repuesto del presupuesto
                </button>
              )}
            </div>
          ))}
        </div>
      </CustomCard>

      {/* --- Lightbox de foto --- */}
      {selectedEvidence && selectedEvidence.type === 'photo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          {/* Controles */}
          <button
            onClick={() => setSelectedEvidence(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={() => navigatePhoto('prev')}
            className="absolute left-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            onClick={() => navigatePhoto('next')}
            className="absolute right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Imagen */}
          <img
            src={photos[currentPhotoIndex]?.fileUrl}
            alt={photos[currentPhotoIndex]?.title}
            className="max-h-full max-w-full object-contain"
          />

          {/* Info inferior */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-sm font-bold text-white">
              {photos[currentPhotoIndex]?.title}
            </p>
            <p className="text-xs font-medium text-white/70">
              {currentPhotoIndex + 1} de {photos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
