import { useEffect } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Loader2, AlertCircle, FileText } from "lucide-react";
import { withAuth } from "@/components/withAuth";
import { CustomCard } from "@/components/ui/CustomCard";
import { CustomButton } from "@/components/ui/CustomButton";
import { Layout } from "@/components/Layout";
import { AdminOrderDetail } from "@/components/AdminOrderDetail";
import { useOrderById } from "@/hooks/useOrderById";

export const dynamic = 'force-dynamic';

/**
 * Detalle de UNA orden cargada por id vía `?order-id=N`.
 *
 * Existe para entrar al detalle desde sitios que NO tienen la lista de
 * órdenes en memoria (p. ej. la lista de pagos): hace GET
 * /api/orders/{id} y renderiza el mismo AdminOrderDetail del dashboard.
 * "Volver" hace router.back(), así se regresa a la página de origen.
 */
function AdminOrderDetailPage() {
  const router = useRouter();
  const orderIdParam = router.query["order-id"];
  const orderId = orderIdParam ? parseInt(orderIdParam as string, 10) : null;

  const { data: order, isLoading, error } = useOrderById(orderId);

  // Redirigir si no hay order-id válido en la URL
  useEffect(() => {
    if (orderIdParam && isNaN(Number(orderIdParam))) {
      router.replace("/admin/dashboard");
    }
  }, [orderIdParam, router]);

  if (!orderId || isNaN(orderId)) {
    return null;
  }

  return (
    <Layout>
      <div className='mx-auto max-w-4xl p-6'>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-brand-600' />
            <span className='ml-2 text-sm text-slate-500'>Cargando orden...</span>
          </div>
        ) : error ? (
          <CustomCard>
            <div className='flex flex-col items-center py-12 text-center'>
              <AlertCircle className='h-12 w-12 text-red-400' />
              <p className='mt-4 text-sm font-medium text-slate-700'>
                No se pudo cargar la orden #{orderId}
              </p>
              <p className='mt-1 text-xs text-slate-400'>
                El backend aún no implementa el GET individual de órdenes, o la orden no existe.
              </p>
              <CustomButton
                variant='secondary'
                size='sm'
                className='mt-4'
                leftIcon={<ArrowLeft className='h-4 w-4' />}
                onClick={() => router.back()}
              >
                Volver
              </CustomButton>
            </div>
          </CustomCard>
        ) : !order ? (
          <CustomCard>
            <div className='flex flex-col items-center py-12 text-center'>
              <FileText className='h-12 w-12 text-slate-300' />
              <p className='mt-4 text-sm font-medium text-slate-400'>
                Orden #{orderId} no encontrada
              </p>
              <CustomButton
                variant='secondary'
                size='sm'
                className='mt-4'
                leftIcon={<ArrowLeft className='h-4 w-4' />}
                onClick={() => router.back()}
              >
                Volver
              </CustomButton>
            </div>
          </CustomCard>
        ) : (
          <AdminOrderDetail
            order={order}
            onBack={() => router.back()}
          />
        )}
      </div>
    </Layout>
  );
}

export default withAuth(AdminOrderDetailPage, {
  roles: ["admin"],
  redirectTo: "/login",
});
