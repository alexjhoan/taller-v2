import { useState } from "react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import { ArrowLeft, Send, AlertCircle, Lightbulb, Bug } from "lucide-react";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { CustomInput } from "@/components/ui/CustomInput";
import { api } from "@/services/api";
import { Layout } from "@/components/Layout";
import { withAuth } from "@/components/withAuth";

interface CreateTicketPageProps {}

function CreateTicketPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"soporte" | "sugerencia" | "bug">("soporte");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      enqueueSnackbar("Titulo y descripcion son obligatorios", { variant: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createTicket({ title: title.trim(), description: description.trim(), category });
      enqueueSnackbar("Ticket enviado correctamente", { variant: "success" });
      setTitle("");
      setDescription("");
      setCategory("soporte");
    } catch (error: any) {
      const detail = error?.body?.statusText || error?.message || "Error al crear ticket";
      enqueueSnackbar(detail, { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: "soporte", label: "Soporte", icon: AlertCircle, selectedClass: "border-blue-500 bg-blue-50 text-blue-700", iconColor: "text-blue-600" },
    { value: "sugerencia", label: "Sugerencia", icon: Lightbulb, selectedClass: "border-amber-500 bg-amber-50 text-amber-700", iconColor: "text-amber-600" },
    { value: "bug", label: "Bug / Error", icon: Bug, selectedClass: "border-red-500 bg-red-50 text-red-700", iconColor: "text-red-600" },
  ] as const;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl p-6 pb-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CustomButton variant="ghost" size="sm" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" />} className="whitespace-nowrap">
          Volver
        </CustomButton>
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Crear Ticket</h1>
          <p className="mt-0.5 text-sm text-slate-500">Soporte, sugerencias o reportes de errores</p>
        </div>
      </div>

      <CustomCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border-2 ${
                      isSelected ? cat.selectedClass : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${cat.iconColor}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="category" value={category} />
          </div>

          <CustomInput
            label="Titulo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: No puedo acceder al portal de clientes"
            required
            maxLength={255}
          />

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Descripcion</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="input-field resize-none"
              placeholder="Describe tu problema, sugerencia o error con el mayor detalle posible..."
              required
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <CustomButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancelar
            </CustomButton>
            <CustomButton
              type="submit"
              className="flex-1"
              leftIcon={<Send className="h-4 w-4" />}
              isLoading={isSubmitting}
            >
              Enviar Ticket
            </CustomButton>
          </div>
        </form>
      </CustomCard>

      {/* Info */}
      <CustomCard className="bg-blue-50 border-blue-100">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Que pasa despues de enviar?</p>
            <ul className="mt-1.5 list-disc list-inside space-y-1">
              <li>Tu ticket queda en estado <strong>"Abierto"</strong>.</li>
              <li>El equipo de administracion lo revisara y cambiara a <strong>"En proceso"</strong> al responder.</li>
              <li>Recibiras notificacion cuando haya una respuesta.</li>
            </ul>
          </div>
        </div>
      </CustomCard>
    </div>
  </Layout>
  );
}

export default withAuth(CreateTicketPage, { roles: ["admin", "mechanic"], redirectTo: "/login" });