import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { EvidenceGallery, EvidenceItem } from "@/components/EvidenceGallery";

export const dynamic = 'force-dynamic';

export default function EvidencePage() {
  const router = useRouter();
  const { token } = router.query;
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Durante el prerender (SSG) router.query está vacío: esperamos a que
  // el query param `token` esté disponible para no romper el build.
  if (typeof token !== "string" || token.length === 0) {
    return (
      <div className='flex min-h-[50dvh] items-center justify-center px-4'>
        <p className='text-sm text-slate-500'>Cargando evidencias…</p>
      </div>
    );
  }

  useEffect(() => {
    let mounted = true;
    const fetchEvidence = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API || "";
        const response = await fetch(`${baseUrl}/api/public/order/${token}`);
        if (!response.ok) throw new Error("Error al cargar la orden");
        const data = await response.json();
        if (mounted) {
          // El backend devuelve evidence como array de objetos { url, evidence_type }
          setEvidence(data.body?.evidence || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEvidence();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className='flex min-h-[50dvh] items-center justify-center px-4'>
        <p className='text-sm text-slate-500'>Cargando evidencias…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex min-h-[50dvh] items-center justify-center px-4 text-red-600'>
        <p className='text-sm'>{error}</p>
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className='flex min-h-[50dvh] items-center justify-center px-4 text-slate-500'>
        <p className='text-sm'>No hay evidencias disponibles para esta orden.</p>
      </div>
    );
  }

  return (
    <div className='p-4 max-w-4xl mx-auto'>
      <h1 className='mb-6 text-2xl font-bold text-slate-900'>Evidencias de la Orden</h1>
      <EvidenceGallery evidence={evidence} />
    </div>
  );
}