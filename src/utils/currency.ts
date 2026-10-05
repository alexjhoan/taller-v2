import type { CurrencyFormatOptions } from '@/types';

const defaultOptions: CurrencyFormatOptions = {
  currency: 'COP',
  locale: 'es-CO',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

/**
 * Formatea un valor numérico como moneda colombiana (COP) sin decimales.
 * Ej: 180000 -> "$ 180.000"
 */
export function formatCOP(
  value: number,
  options: CurrencyFormatOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  return new Intl.NumberFormat(opts.locale, {
    style: 'currency',
    currency: opts.currency,
    minimumFractionDigits: opts.minimumFractionDigits,
    maximumFractionDigits: opts.maximumFractionDigits,
  }).format(value);
}

/**
 * Parsea un string de moneda COP a número.
 * Ej: "$ 180.000" -> 180000
 */
export function parseCOP(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}
