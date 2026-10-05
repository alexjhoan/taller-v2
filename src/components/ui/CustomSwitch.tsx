interface CustomSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function CustomSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}: CustomSwitchProps) {
  const toggle = () => {
    if (!disabled) onChange(!checked);
  };

  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
    md: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
  };

  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={toggle}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ${s.track} ${
          checked ? 'bg-brand-600' : 'bg-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block transform rounded-full bg-white shadow-sm transition-transform duration-200 ${s.thumb} ${
            checked ? s.translate : 'translate-x-0.5'
          }`}
        />
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && (
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          )}
          {description && (
            <span className="text-xs text-slate-400">{description}</span>
          )}
        </span>
      )}
    </button>
  );
}
