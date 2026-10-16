import { useEffect, useRef } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

// --- Tipos ---

interface StatusSliderProps {
  steps: { label: string; description: string }[];
  currentStep: number;
}

// --- Componente ---

export function StatusSlider({ steps, currentStep }: StatusSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll para centrar el paso actual
  useEffect(() => {
    const container = sliderRef.current;
    const currentItem = itemRefs.current[currentStep];
    if (!container || !currentItem) return;

    currentItem.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentStep]);

  const scroll = (direction: "left" | "right") => {
    const container = sliderRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const canScrollLeft = currentStep > 0;
  const canScrollRight = currentStep < steps.length - 1;

  return (
    <div className="relative">
      {/* Botón izquierdo */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Slider */}
      <div
        ref={sliderRef}
        className="scrollbar-hide overflow-x-auto scroll-smooth py-2 px-8"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex items-center gap-1 min-w-max">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div
                key={index}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className="flex items-center"
              >
                {/* Item del paso */}
                <div className="flex flex-col items-center w-20">
                  {/* Círculo con ícono/número */}
                  <div
                    className={`
                      flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300
                      ${
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                            ? "bg-brand-600 text-white ring-4 ring-brand-100"
                            : "bg-slate-100 text-slate-400"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`
                      mt-1.5 text-xs text-center leading-tight truncate max-w-full
                      ${
                        isCurrent
                          ? "font-bold text-brand-700"
                          : isCompleted
                            ? "font-medium text-emerald-600"
                            : "font-medium text-slate-400"
                      }
                    `}
                    title={step.label}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Línea conectora (excepto después del último) */}
                {index < steps.length - 1 && (
                  <div
                    className={`
                      h-0.5 w-6 mx-1 transition-colors duration-300
                      ${index < currentStep ? "bg-emerald-400" : "bg-slate-200"}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Botón derecho */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Dots indicadores */}
      <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
        {steps.map((_, index) => (
          <div
            key={index}
            className={`
              h-1.5 rounded-full transition-all duration-300
              ${
                index === currentStep
                  ? "w-4 bg-brand-600"
                  : index < currentStep
                    ? "w-1.5 bg-emerald-400"
                    : "w-1.5 bg-slate-200"
              }
            `}
          />
        ))}
      </div>
    </div>
  );
}
