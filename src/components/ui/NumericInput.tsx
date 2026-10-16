import { forwardRef, InputHTMLAttributes, useState, useEffect, useRef } from 'react';

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'onBlur' | 'defaultValue'> {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string | number;
  onChange?: (value: string, numericValue: number | null) => void;
  onBlur?: (value: string, numericValue: number | null) => void;
  isCurrency?: boolean;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  defaultValue?: string | number;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      label,
      error,
      helperText,
      value,
      onChange,
      onBlur,
      isCurrency = false,
      allowDecimal = false,
      min,
      max,
      placeholder,
      className = '',
      id,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const inputId = id || props.name || label;
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Valor interno sin formato (raw)
    const [rawValue, setRawValue] = useState<string>('');
    const [isFocused, setIsFocused] = useState(false);

    // Inicializar rawValue desde value o defaultValue
    useEffect(() => {
      const initialValue = value !== undefined ? value : defaultValue;
      if (initialValue === undefined || initialValue === null) return;
      // Controlado: valor vacío → limpiar el interno (p. ej. al resetear el formulario)
      if (initialValue === '') {
        setRawValue('');
        return;
      }
      const num = Number(String(initialValue).replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) {
        setRawValue(allowDecimal ? num.toString() : Math.floor(num).toString());
      }
    }, [value, defaultValue, allowDecimal]);

    // Valor numérico parseado
    const numericValue = rawValue !== '' ? Number(rawValue) : null;

    // Valor para mostrar (formateado cuando no está enfocado)
    const displayValue = isFocused 
      ? rawValue 
      : (numericValue !== null 
          ? numericValue.toLocaleString('es-VE', {
              minimumFractionDigits: allowDecimal ? 2 : 0,
              maximumFractionDigits: allowDecimal ? 2 : 0,
            })
          : '');

    const handleFocus = () => setIsFocused(true);
    
    const handleBlurEvent = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Formatear al perder foco
      const sanitized = e.target.value.replace(allowDecimal ? /[^\d.-]/g : /[^\d-]/g, '');
      const parts = sanitized.split('.');
      const cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
      const numericVal = cleanValue === '' || cleanValue === '-' ? null : Number(cleanValue);
      onBlur?.(cleanValue, numericVal);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Permitir solo números, punto decimal opcional, signo negativo
      let sanitized = e.target.value.replace(allowDecimal ? /[^\d.-]/g : /[^\d-]/g, '');
      
      // Evitar múltiples puntos decimales
      const parts = sanitized.split('.');
      const cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
      
      // Validar min/max mientras se escribe (solo si es un número válido)
      const numericVal = cleanValue === '' || cleanValue === '-' ? null : Number(cleanValue);
      if (numericVal !== null) {
        if (min !== undefined && numericVal < min) return;
        if (max !== undefined && numericVal > max) return;
      }
      
      setRawValue(cleanValue);
      onChange?.(cleanValue, numericVal);
    };

    const suffix = isCurrency ? ' COP' : '';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            value={displayValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlurEvent}
            placeholder={placeholder}
            min={min !== undefined ? String(min) : undefined}
            max={max !== undefined ? String(max) : undefined}
            className={`input-field pr-8 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

NumericInput.displayName = 'NumericInput';