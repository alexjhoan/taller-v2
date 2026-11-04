import { useRouter } from 'next/router';
import { withAuth } from '@/components/withAuth';
import { Layout } from '@/components/Layout';
import { ChevronLeft } from 'lucide-react';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomButton } from '@/components/ui/CustomButton';
import { NotificationTabs } from '@/components/NotificationTabs';
import { AlertList } from '@/components/AlertList';
import { useUnreadAlerts, useReadAlerts, useMarkAlertAsRead, useMarkAllAlertsAsRead, useMechanicUnreadAlerts } from '@/hooks/useAlerts';
import { formatUnreadCount } from '@/utils/alerts';
import { useUserContext } from '@/context/UserContext';

export const dynamic = 'force-dynamic';

function NotificationsPage() {
  const router = useRouter();
  const { user } = useUserContext();
  const tab = (router.query.tab as 'unread' | 'read') ?? 'unread';

  const isAdmin = user?.role === 'admin';
  const isMechanic = user?.role === 'mechanic';

  // Admin usa useUnreadAlerts, Mecánico usa useMechanicUnreadAlerts
  const {
    data: unreadAlerts,
    isLoading: unreadLoading,
    isError: unreadError,
    error: unreadErrorObj,
    refetch: refetchUnread,
  } = isAdmin ? useUnreadAlerts(true) : useMechanicUnreadAlerts(true);

  const {
    data: readAlerts,
    isLoading: readLoading,
    isError: readError,
    error: readErrorObj,
    refetch: refetchRead,
  } = useReadAlerts(true);

  const unreadCount = unreadAlerts?.length ?? 0;
  const readCount = readAlerts?.length ?? 0;

  const { mutate: markAsRead } = useMarkAlertAsRead();
  const { mutate: markAllAsRead } = useMarkAllAlertsAsRead();

  const handleTabChange = (newTab: 'unread' | 'read') => {
    router.push(`/notifications?tab=${newTab}`, undefined, { shallow: true });
  };

  const handleMarkRead = (alertId: string, orderId: string | null) => {
    const doNavigate = () => {
      if (orderId) {
        // Mecánico va a su vista de orden, admin al dashboard
        const targetUrl = isMechanic
          ? `/technician/order?selectedOrderId=${orderId}`
          : `/admin/dashboard?selectedOrderId=${orderId}`;
        router.push(targetUrl, undefined, { shallow: true });
      }
    };
    markAsRead(alertId, { onSuccess: doNavigate, onError: doNavigate });
  };

  const handleMarkAllRead = () => { markAllAsRead(); };

  const handleRetry = (isUnread: boolean) => { if (isUnread) refetchUnread(); else refetchRead(); };

  const activeAlerts = tab === 'unread' ? (unreadAlerts ?? []) : (readAlerts ?? []);
  const isLoading = tab === 'unread' ? unreadLoading : readLoading;
  const isError = tab === 'unread' ? unreadError : readError;
  const error = tab === 'unread' ? unreadErrorObj : readErrorObj;
  const emptyMessage = tab === 'unread' ? 'No tienes notificaciones pendientes' : 'No hay notificaciones leídas';

  return (
    <Layout>
      <div className="mx-auto max-w-4xl p-6 pb-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CustomButton variant="ghost" size="sm" onClick={() => router.push(user?.role === 'mechanic' ? '/technician/order' : '/admin/dashboard', undefined, { shallow: true })} leftIcon={<ChevronLeft className="h-4 w-4" />} className="whitespace-nowrap">Volver</CustomButton>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Notificaciones</h1>
              <p className="mt-0.5 text-sm text-slate-500">Gestiona las alertas del sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CustomBadge variant="brand" className="text-sm">{formatUnreadCount(unreadCount + readCount)}</CustomBadge>
          </div>
        </div>

        <NotificationTabs activeTab={tab} onChange={(newTab) => router.push(`/notifications?tab=${newTab}`, undefined, { shallow: true })} unreadCount={unreadCount} readCount={readCount} />

        <div id={tab === 'unread' ? 'panel-unread' : 'panel-read'} role="tabpanel" aria-labelledby={tab === 'unread' ? 'tab-unread' : 'tab-read'}>
          <AlertList
            alerts={activeAlerts}
            emptyMessage={tab === 'unread' ? 'No tienes notificaciones pendientes' : 'No hay notificaciones leídas'}
            onMarkRead={tab === 'unread' ? (id, orderId) => {
              const doNavigate = () => {
                if (orderId) {
                  const targetUrl = user?.role === 'mechanic'
                    ? `/technician/order?selectedOrderId=${orderId}`
                    : `/admin/dashboard?selectedOrderId=${orderId}`;
                  router.push(targetUrl, undefined, { shallow: true });
                }
              };
              markAsRead(id, { onSuccess: doNavigate, onError: doNavigate });
            } : undefined}
            onClickAlert={(orderId) => {
              if (orderId) {
                const targetUrl = user?.role === 'mechanic'
                  ? `/technician/order?selectedOrderId=${orderId}`
                  : `/admin/dashboard?selectedOrderId=${orderId}`;
                router.push(targetUrl, undefined, { shallow: true });
              }
            }}
            onMarkAllRead={tab === 'unread' ? () => markAllAsRead() : undefined}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={() => { if (tab === 'unread') refetchUnread(); else refetchRead(); }}
            showActions={tab === 'unread'}
          />
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(NotificationsPage, { roles: ['admin', 'mechanic'], redirectTo: '/login' });