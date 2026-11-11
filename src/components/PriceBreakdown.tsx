import { CustomCard } from "@/components/ui/CustomCard";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { formatCOP } from "@/utils/currency";

interface PriceBreakdownProps {
  parts: Array<{
    quantity: number;
    unit_price?: number;
    approvalStatus?: string;
  }>;
  serviceItems: Array<{
    description: string;
    price: number;
  }>;
}

export function PriceBreakdown({ parts, serviceItems }: PriceBreakdownProps) {
  // Solo sumar repuestos ACEPTADOS (que el cliente aprobó)
  const partsSubtotal = parts
    .filter((p) => p.approvalStatus === "accepted" && p.unit_price != null)
    .reduce((sum, p) => sum + p.quantity * (p.unit_price ?? 0), 0);

  const laborSubtotal = serviceItems.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const total = partsSubtotal + laborSubtotal;

  if (partsSubtotal === 0 && laborSubtotal === 0) return null;

  return (
    <CustomCard className="border-brand-200 bg-brand-50">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
          <svg className="h-4 w-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-sm font-bold text-brand-700">Desglose de Precios</h2>
      </div>

      <div className="space-y-2">
        {partsSubtotal > 0 && (
          <div className="flex items-center justify-between py-2 border-b border-brand-100">
            <div className="flex items-center gap-2">
              <CustomBadge variant="success" className="text-xs">
                Repuestos
              </CustomBadge>
              <span className="text-sm text-slate-600">({parts.filter(p => p.approvalStatus === "accepted" && p.unit_price).length} ítems)</span>
            </div>
            <span className="text-sm font-bold text-slate-800">{formatCOP(partsSubtotal)}</span>
          </div>
        )}

        {laborSubtotal > 0 && (
          <div className="flex items-center justify-between py-2 border-b border-brand-100">
            <div className="flex items-center gap-2">
              <CustomBadge variant="info" className="text-xs">
                Mano de obra
              </CustomBadge>
              <span className="text-sm text-slate-600">({serviceItems.filter(s => s.price > 0).length} servicios)</span>
            </div>
            <span className="text-sm font-bold text-slate-800">{formatCOP(laborSubtotal)}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t-2 border-brand-200">
          <span className="text-lg font-extrabold text-brand-600">Total</span>
          <span className="text-xl font-extrabold text-brand-600">{formatCOP(total)}</span>
        </div>
      </div>
    </CustomCard>
  );
}