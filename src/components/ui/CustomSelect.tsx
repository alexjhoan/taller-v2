import { forwardRef, SelectHTMLAttributes } from 'react';

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: CustomSelectOption[];
}

export const CustomSelect = forwardRef<HTMLSelectElement, CustomSelectProps>(
  ({ label, error, helperText, className = '', id, children, options, ...props }, ref) => {
    const selectId = id || props.name || label;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`input-field ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`}
          {...props}
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

CustomSelect.displayName = 'CustomSelect';