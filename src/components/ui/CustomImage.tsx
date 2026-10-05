import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface CustomImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  enableLightbox?: boolean;
}

export function CustomImage({
  src,
  alt,
  className = '',
  onClick,
  enableLightbox = true,
}: CustomImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (enableLightbox) {
      setLightboxOpen(true);
    }
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-xl ${className}`}
        onClick={handleClick}
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
        />
        {enableLightbox && !onClick && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/20 hover:opacity-100">
            <ZoomIn className="h-6 w-6 text-white" />
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
