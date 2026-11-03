import { ReactNode, useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface CustomDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  hideCloseButton?: boolean;
  disableBackdropClose?: boolean;
  disableEscapeClose?: boolean;
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

const responsiveMaxWidthClasses: Record<string, string> = {
  sm: "w-full max-w-sm sm:max-w-sm",
  md: "w-full max-w-md sm:max-w-md mx-4 sm:mx-auto",
  lg: "w-full max-w-lg sm:max-w-lg mx-4 sm:mx-auto",
  xl: "w-full max-w-xl sm:max-w-xl mx-4 sm:mx-auto",
};

export function CustomDialog({
  open,
  onClose,
  title,
  children,
  maxWidth = "md",
  hideCloseButton = false,
  disableBackdropClose = false,
  disableEscapeClose = false,
}: CustomDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      if (!disableEscapeClose) {
        document.addEventListener("keydown", handleKeyDown);
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown, disableEscapeClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 isolate z-[9999] flex items-center justify-center p-0">
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-slate-900/50 backdrop-blur-sm'
        onClick={disableBackdropClose ? undefined : onClose}
      />

      {/* Dialog */}
      <div
        className={`relative z-10000 w-full mx-auto ${responsiveMaxWidthClasses[maxWidth]} rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-in slide-in-from-bottom-4 duration-300`}
      >
        {/* Header */}
        {title && (
          <div className='flex items-center justify-between border-b border-slate-100 px-6 py-4'>
            <h3 className='text-lg font-bold text-slate-800'>{title}</h3>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
              >
                <X className='h-5 w-5' />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className='px-4 py-4'>{children}</div>
      </div>
    </div>
  );
}
