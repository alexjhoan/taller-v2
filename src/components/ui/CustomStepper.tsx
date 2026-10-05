import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface CustomStepperProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

export function CustomStepper({
  steps,
  currentStep,
  className = '',
}: CustomStepperProps) {
  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: solo paso actual */}
      <div className="flex items-center justify-center sm:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {currentStep + 1}
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {steps[currentStep]?.label}
          </span>
        </div>
      </div>

      {/* Desktop: stepper completo */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : isCurrent
                        ? 'border-brand-600 bg-white text-brand-600'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-bold">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-semibold text-center max-w-[80px] ${
                    isCurrent
                      ? 'text-brand-600'
                      : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded-full ${
                    isCompleted ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
