import { useEffect, useRef, useState, useMemo } from 'react';
import { Bell, Clock, Menu, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { CustomBadge } from '@/components/ui/CustomBadge';
import { CustomButton } from '@/components/ui/CustomButton';
import { useUnreadAlerts, useMarkAlertAsRead, useMarkAllAlertsAsRead, useMechanicUnreadAlerts } from '@/hooks/useAlerts';
import { NotificationModal } from '@/components/NotificationModal';
import { formatUnreadCount } from '@/utils/alerts';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  mechanic: 'Mecánico',
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

interface TopBarProps {
  /**
   * Abre el drawer del menú (solo móvil). Si no se pasa, no se renderiza
   * la hamburguesa. La provee el Layout.
   */
  onOpenMenu?: () => void;
  /** Estado del drawer, para `aria-expanded` de la hamburguesa. */
  isMenuOpen?: boolean;
}

/**
 * Única barra superior (sticky, top-0). La renderiza el Layout.
 *
 * - Móvil (<425px): hamburguesa (izq) | campana + reloj + avatar (der).
 * - Desktop (≥425px): avatar + nombre + badge de rol (izq) | campana + reloj (der),
 *   sin hamburguesa (la navegación vive en el sidebar).
 * - La campana SOLO se renderiza para rol `admin`.
 */
export function TopBar({ onOpenMenu, isMenuOpen }: TopBarProps) {
  const { user } = useUserContext();
  const router = useRouter();

  // Hora local (null en primer render para evitar mismatch SSR/hidratación)
  const [time, setTime] = useState<string | null>(null);

  // Menú de usuario (solo móvil)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Campana de notificaciones (admin y mechanic)
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Determinar si mostrar campana
  const isAdmin = user?.role === 'admin';
  const isMechanic = user?.role === 'mechanic';
  const showNotifications = isAdmin || isMechanic;

  // Datos de alertas no leídas según rol
  const {
    data: adminAlerts,
    isLoading: adminLoading,
    isError: adminIsError,
    error: adminError,
    refetch: adminRefetch,
  } = useUnreadAlerts(isAdmin);

  const {
    data: mechanicAlerts,
    isLoading: mechanicLoading,
    isError: mechanicIsError,
    error: mechanicError,
    refetch: mechanicRefetch,
  } = useMechanicUnreadAlerts(isMechanic);

  // Unificar alertas y estados según rol
  const alerts = isAdmin ? adminAlerts : mechanicAlerts;
  const isLoading = isAdmin ? adminLoading : mechanicLoading;
  const isError = isAdmin ? adminIsError : mechanicIsError;
  const error = isAdmin ? adminError : mechanicError;
  const refetch = isAdmin ? adminRefetch : mechanicRefetch;

  const unreadCount = alerts?.length ?? 0;

  // Mutaciones (compartidas)
  const { mutate: markAsRead } = useMarkAlertAsRead();
  const { mutate: markAllAsRead } = useMarkAllAlertsAsRead();

  // Hora actual
  useEffect(() => {
    setTime(formatTime(new Date()));
    const intervalId = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Cerrar menú de usuario al click fuera o Escape
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  // Cerrar modal de notificaciones al click fuera (lo maneja CustomDialog con disableBackdropClose=false)
  // Pero aseguramos que Escape también lo cierre y devuelva foco a la campana
  useEffect(() => {
    if (!isNotificationModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationModalOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isNotificationModalOpen]);

  const roleLabel = user ? roleLabels[user.role] ?? user.role : '';
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const initial = (user?.firstName ?? '?').charAt(0).toUpperCase();

  // Handlers de notificaciones
  const handleMarkRead = (alertId: string, orderId: string | null) => {
    // Según spec: click = marcar leída + navegar. Si el PATCH falla, navega igual.
    const doNavigate = () => {
      if (orderId) {
        router.push(`/admin/dashboard?selectedOrderId=${orderId}`, undefined, { shallow: true });
      }
    };
    markAsRead(alertId, {
      onSuccess: doNavigate,
      onError: doNavigate, // navega aunque falle el marcado (spec: navega igual)
    });
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
  };

  const handleRetry = () => {
    refetch();
  };

  const handleViewAll = () => {
    router.push('/notifications?tab=unread', undefined, { shallow: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-soft">
      {/* Izquierda */}
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Hamburguesa (solo móvil) */}
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menú"
            aria-expanded={isMenuOpen}
            aria-controls="sidebar-navigation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-soft transition-colors hover:bg-slate-50 xs:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Desktop: avatar + nombre + rol */}
        <div className="hidden min-w-0 items-center gap-2.5 xs:flex">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">
              {fullName || 'Usuario'}
            </p>
            {user && (
              <CustomBadge variant={user.role === 'admin' ? 'brand' : 'neutral'}>
                {roleLabel}
              </CustomBadge>
            )}
          </div>
        </div>
      </div>

      {/* Derecha: campana (admin y mechanic) + reloj + avatar (móvil) */}
      <div className="flex shrink-0 items-center gap-3">
        {/* Campana de notificaciones — admin y mechanic */}
        {showNotifications && (
          <div className="relative">
            <button
              ref={bellRef}
              type="button"
              onClick={() => setIsNotificationModalOpen((prev) => !prev)}
              aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
              aria-haspopup="dialog"
              aria-expanded={isNotificationModalOpen}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-soft transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <Bell className="h-5 w-5" />
              {formatUnreadCount(unreadCount) && (
                <CustomBadge
                  variant="danger"
                  dot
                  className="absolute -top-1 -right-1 min-w-[18px] h-5 text-xs px-1.5"
                >
                  {formatUnreadCount(unreadCount)}
                </CustomBadge>
              )}
            </button>

            {/* Modal de notificaciones */}
            <NotificationModal
              open={isNotificationModalOpen}
              onClose={() => setIsNotificationModalOpen(false)}
              alerts={alerts ?? []}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
              onViewAll={handleViewAll}
              isLoading={isLoading}
              isError={isError}
              error={error}
              onRetry={handleRetry}
              bellRef={bellRef}
              userRole={user?.role ?? 'admin'}
              userId={user?.id}
            />
          </div>
        )}

        {/* Reloj */}
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums xs:hidden" aria-label={time ? `Hora actual: ${time}` : 'Hora actual'}>
            {time ?? '--:--'}
          </span>
        </div>

        {/* Avatar con menú desplegable (solo móvil) */}
        <div className="relative xs:hidden" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            aria-label="Menú de usuario"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-soft"
          >
            {initial}
          </button>
          {isUserMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-floating"
            >
              <p className="truncate text-sm font-bold text-slate-800">
                {fullName || 'Usuario'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{roleLabel}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}