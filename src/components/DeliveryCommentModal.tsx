import { useEffect } from "react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { CustomButton } from "@/components/ui/CustomButton";
import { formatCOP } from "@/utils/currency";

interface PartItem {
  quantity: number;
  unit_price?: number;
  approvalStatus?: string;
}

interface ServiceItem {
  description: string;
  price: number;
}

interface DeliveryCommentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving?: boolean;
  target: "delivered" | "cancelled";
  parts?: PartItem[];
  serviceItems?: ServiceItem[];
  commentValue?: string;
  onCommentChange?: (value: string) => void;
}

export function DeliveryCommentModal({
  open,
  onClose,
  onSave,
  isSaving,
  target,
  parts = [],
  serviceItems = [],
  commentValue = "",
  onCommentChange,
}: DeliveryCommentModalProps): JSX.Element {
  const saving = isSaving ?? false;
  const comment = commentValue ?? "";

  useEffect(() => {
    if (open) onCommentChange?.("");
  }, [open]);

  // Calcular subtotales
  const laborSubtotal = serviceItems.reduce((sum, s) => sum + (s.price || 0), 0);
  const partsSubtotal = parts
    .filter((p) => p.approvalStatus === "accepted" && p.unit_price != null)
    .reduce((sum, p) => sum + p.quantity * (p.unit_price || 0), 0);
  const total = laborSubtotal + partsSubtotal;

  return (
    <CustomDialog
      open={open}
      onClose={onClose}
      title={target === "delivered" ? "Confirmar entrega" : "Confirmar cancelación"}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Desglose de costos (solo para entrega) */}
        {target === "delivered" && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Desglose de costos para el cliente</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Mano de obra</span>
                <span className="font-medium text-slate-800">{formatCOP(laborSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Repuestos</span>
                <span className="font-medium text-slate-800">{formatCOP(partsSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1 border-t-2 border-slate-300 font-semibold">
                <span className="text-slate-800">Total</span>
                <span className="text-brand-600">{formatCOP(total)}</span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Comentario</label>
          <textarea
            value={comment}
            onChange={(e) => onCommentChange?.(e.target.value)}
            rows={4}
            className="input-field resize-none"
            placeholder={
              target === "delivered"
                ? "Ej: Vehículo retirado por el cliente. Se explicaron las reparaciones realizadas."
                : "Ej: El cliente canceló el servicio por motivos personales."
            }
            required
          />
        </div>
        <div className="flex gap-3">
          <CustomButton
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </CustomButton>
          <CustomButton
            type="button"
            className="flex-1"
            onClick={onSave}
            isLoading={saving}
            disabled={saving || !comment.trim()}
          >
            Guardar
          </CustomButton>
        </div>
      </div>
    </CustomDialog>
  );
}