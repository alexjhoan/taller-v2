import { ReactNode } from 'react';

interface CustomCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  hoverable?: boolean;
}

const paddingClasses: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function CustomCard({
  children,
  className = '',
  padding = 'md',
  onClick,
  hoverable = false,
}: CustomCardProps) {
  const isClickable = onClick || hoverable;

  return (
    <div
      onClick={onClick}
      className={`card ${paddingClasses[padding]} ${
        isClickable
          ? 'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-300'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
