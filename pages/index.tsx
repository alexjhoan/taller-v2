import { useRouter } from 'next/router';
import { Calendar, Clock } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { withAuth } from '@/components/withAuth';
import { Layout } from '@/components/Layout';
import { CustomCard } from '@/components/ui/CustomCard';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { navigationItems, NavItem } from '@/utils/navigation';

export const dynamic = 'force-dynamic';

// Clases de Tailwind literales (las dinámicas no se compilan)
const colorStyles: Record<string, { box: string; iconWrap: string; icon: string }> = {
  purple: { box: 'bg-purple-50 border-purple-200 hover:border-purple-300', iconWrap: 'bg-purple-100', icon: 'text-purple-600' },
  rose: { box: 'bg-rose-50 border-rose-200 hover:border-rose-300', iconWrap: 'bg-rose-100', icon: 'text-rose-600' },
  brand: { box: 'bg-brand-50 border-brand-200 hover:border-brand-300', iconWrap: 'bg-brand-100', icon: 'text-brand-600' },
  emerald: { box: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300', iconWrap: 'bg-emerald-100', icon: 'text-emerald-600' },
  blue: { box: 'bg-blue-50 border-blue-200 hover:border-blue-300', iconWrap: 'bg-blue-100', icon: 'text-blue-600' },
};

const defaultStyle = colorStyles.brand;

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Contador por box: órdenes relevantes a cada acceso, según su href */
function buildCountConfig(
  href: string,
  userId: number | undefined,
  orders: { status: string; assigned_user_id: number[] }[],
): { count: number; label: string } {
  const active = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  switch (href) {
    case '/admin/dashboard':
      return { count: active.length, label: 'Órdenes activas' };
    case '/admin/history':
      return { count: orders.filter((o) => o.status === 'delivered').length, label: 'Entregadas' };
    case '/reception/checkin':
      return { count: orders.filter((o) => o.status === 'received').length, label: 'En patio' };
    case '/technician/order':
      return {
        count: active.filter((o) => userId !== undefined && o.assigned_user_id.includes(userId)).length,
        label: 'Asignadas a mí',
      };
    default:
      return { count: 0, label: '' };
  }
}

function HomePage() {
  const router = useRouter();
  const { user } = useUserContext();
  const { data: workOrders, isLoading, isError } = useWorkOrders();

  const now = new Date();
  const dateLabel = `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`;
  const timeLabel = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Mismo filtro que el Sidebar: los items adminOnly solo se muestran al admin
  const accessibleItems = navigationItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  const handleNavigate = (item: NavItem) => {
    router.push(item.href);
  };

  return (
    <Layout>
      <div className='mx-auto max-w-4xl space-y-6 p-6 pb-8'>
        {/* Header - User Info Section */}
        <CustomCard className='bg-gradient-to-r from-brand-50 to-brand-100 border-brand-200'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg'>
                <span className='text-2xl font-extrabold text-white'>
                  {(user?.firstName || 'M').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>
                  Mecaflow Workshop OS
                </h1>
                <p className='mt-1 text-sm text-slate-600'>
                  Bienvenido, <span className='font-semibold text-slate-900'>{user?.firstName || 'Usuario'}</span>
                </p>
              </div>
            </div>
            <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:text-left'>
              <div className='flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-slate-200'>
                <Calendar className='h-4 w-4 text-slate-500' />
                <span className='text-sm font-medium text-slate-700'>{dateLabel}</span>
              </div>
              <div className='flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-slate-200'>
                <Clock className='h-4 w-4 text-slate-500' />
                <span className='text-sm font-medium text-slate-700'>{timeLabel}</span>
              </div>
              <CustomBadge variant='brand' dot className='px-3 py-1.5 text-sm'>
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'mechanic' ? 'Mecánico' : 'Usuario'}
              </CustomBadge>
            </div>
          </div>
        </CustomCard>

        {/* Accesos Rápidos - items del sidebar con contador */}
        <div>
          <h3 className='mb-4 text-sm font-bold text-slate-800'>Accesos Rápidos</h3>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            {accessibleItems.map((item) => {
              const style = colorStyles[item.color] ?? defaultStyle;
              const Icon = item.icon;
              const countInfo = buildCountConfig(item.href, user?.id, workOrders ?? []);
              const countContent = (() => {
                if (isLoading) {
                  return <div className='mx-auto h-7 w-10 animate-pulse rounded bg-slate-200/70' aria-hidden />;
                }
                if (isError) {
                  return <span className='text-xl font-extrabold text-slate-300'>—</span>;
                }
                return <span className='text-2xl font-extrabold text-slate-900'>{countInfo.count}</span>;
              })();

              return (
                <CustomCard
                  key={item.href}
                  padding='md'
                  hoverable
                  onClick={() => handleNavigate(item)}
                  className={`text-center border transition-all duration-200 ${style.box} hover:shadow-md hover:scale-[1.02]`}
                >
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${style.iconWrap}`}>
                    <Icon className={`h-6 w-6 ${style.icon}`} />
                  </div>
                  <p className='text-sm font-semibold text-slate-800'>{item.label}</p>
                  <p className='mt-0.5 text-[11px] text-slate-500'>{item.description}</p>
                  <div className='mt-2'>
                    {countContent}
                    <p className='text-[10px] font-medium uppercase tracking-wide text-slate-400'>{countInfo.label}</p>
                  </div>
                </CustomCard>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(HomePage, {
  roles: ['admin', 'mechanic'],
  redirectTo: '/login',
});
