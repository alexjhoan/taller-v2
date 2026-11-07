import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, LogOut, Wrench, X, Bell, Zap } from "lucide-react";
import { useUserContext } from "@/context/UserContext";
import { navigationItems } from "@/utils/navigation";
import { api } from "@/services/api";
import { useSnackbar } from "notistack";

interface SidebarProps {
  /** Estado compartido con Layout (≥425px). */
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Drawer off-canvas (<425px). */
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse, isDrawerOpen, onCloseDrawer }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useUserContext();
  const { enqueueSnackbar } = useSnackbar();
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  // Test push notification button (solo admins)
  const isAdmin = user?.role === 'admin';

  const handleTestPush = async () => {
    if (!isAdmin) return;
    
    setIsSendingTestPush(true);
    try {
      enqueueSnackbar("Enviando notificación de prueba...", { variant: "info" });
      
      // Obtener el ID del usuario actual
      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error('ID de usuario no disponible');
      }

      // Enviar payload según especificación del backend
      await api.post('/api/push/test', {
        user_ids: [currentUserId],
        title: '🧪 Prueba de notificación',
        body: 'Esta es una notificación de prueba desde el sidebar',
        order_id: 0
      });
      
      enqueueSnackbar("Notificación de prueba enviada", { variant: "success" });
    } catch (error) {
      console.error("[Sidebar] Error enviando push de prueba:", error);
      const apiError = error as { status?: number; statusText?: string; body?: { statusText?: string } };
      
      if (apiError?.status === 503) {
        enqueueSnackbar("Configuración VAPID faltante en el servidor", { variant: "error" });
      } else if (apiError?.status === 403) {
        enqueueSnackbar("Solo administradores pueden enviar notificaciones de prueba", { variant: "error" });
      } else if (apiError?.status === 401) {
        enqueueSnackbar("Sesión expirada. Inicie sesión nuevamente.", { variant: "error" });
      } else if (apiError?.status === 500) {
        enqueueSnackbar("Error interno del servidor. Revise los logs del contenedor.", { variant: "error" });
      } else {
        enqueueSnackbar("Error al enviar notificación de prueba", { variant: "error" });
      }
    } finally {
      setIsSendingTestPush(false);
    }
  };
  useEffect(() => {
    const handleRouteChange = () => onCloseDrawer();
    router.events.on("routeChangeStart", handleRouteChange);
    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events, onCloseDrawer]);

  // Escape cierra el drawer
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseDrawer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, onCloseDrawer]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const filteredItems = navigationItems.filter((item) => !item.adminOnly || user?.role === "admin");

  const itemClasses = (isActive: boolean) =>
    `flex items-center py-2 transition-all ${isCollapsed ? "justify-center px-1" : "gap-2.5 px-2.5"} rounded-xl ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
    }`;

  return (
    <aside
      id='sidebar-navigation'
      aria-label='Menú de navegación'
      className={`fixed left-0 top-0 z-20 flex h-dvh flex-col border-r border-slate-200 bg-white transition-all duration-300 ${
        isDrawerOpen ? "translate-x-0" : "max-xs:-translate-x-full max-xs:invisible"
      } ${isCollapsed ? "w-56 xs:w-14" : "w-56"}`}
    >
      {/* Header */}
      <div className='flex h-14 items-center justify-between border-b border-slate-100 px-3'>
        {!isCollapsed && (
          <div className='flex items-center gap-2'>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600'>
              <Wrench className='h-4 w-4 text-white' />
            </div>
            <span className='text-[13px] font-bold text-slate-800'>Mecaflow</span>
          </div>
        )}
        <div className='ml-auto flex items-center gap-1'>
          {/* Cerrar drawer (solo <425px) */}
          <button
            type='button'
            onClick={onCloseDrawer}
            aria-label='Cerrar menú'
            className='hidden max-xs:flex rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
          >
            <X className='h-5 w-5' />
          </button>
          {/* Colapsar/expandir (solo ≥425px) */}
          <button
            type='button'
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            className='flex max-xs:hidden rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
          >
            {isCollapsed ? <ChevronRight className='h-5 w-5' /> : <ChevronLeft className='h-5 w-5' />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className='flex-1 space-y-1 overflow-y-auto p-2.5'>
        {filteredItems.map((item) => {
          const isActive = router.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseDrawer}
              className={itemClasses(isActive)}
              title={isCollapsed ? item.label : undefined}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-brand-100" : "bg-slate-100"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-brand-600" : "text-slate-500"}`} />
              </div>
              {!isCollapsed && (
                <div className='min-w-0'>
                  <p className='truncate text-[13px] font-semibold'>{item.label}</p>
                  <p className='truncate text-[11px] text-slate-400'>{item.description}</p>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className='border-t border-slate-100 p-2.5 space-y-2'>
        {/* Botón de prueba de notificación push (solo admins) */}
        {isAdmin && (
          <button
            type='button'
            onClick={handleTestPush}
            disabled={isSendingTestPush}
            className={`flex w-full items-center gap-2.5 rounded-xl py-2 px-2.5 text-slate-600 transition-colors hover:bg-purple-50 hover:text-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed ${isCollapsed ? "justify-center" : "gap-2.5 px-2.5"}`}
            title={isCollapsed ? "Enviar notificación de prueba" : undefined}
          >
            <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100'>
              <Zap className='h-4 w-4 text-purple-600' />
            </div>
            {!isCollapsed && (
              <span className='text-[13px] font-semibold'>
                {isSendingTestPush ? 'Enviando...' : 'Enviar push de prueba'}
              </span>
            )}
          </button>
        )}

        <button
          type='button'
          onClick={handleLogout}
          className={`flex w-full items-center rounded-xl py-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 ${isCollapsed ? "justify-center px-1" : "gap-2.5 px-2.5"}`}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100'>
            <LogOut className='h-4 w-4 text-slate-500' />
          </div>
          {!isCollapsed && <span className='text-[13px] font-semibold'>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
