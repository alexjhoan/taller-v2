import { useEffect, useRef, useState } from 'react';
import { Clock, Menu } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { CustomBadge } from '@/components/ui/CustomBadge';

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
 * - Móvil (<425px): hamburguesa (izq) | reloj + avatar (der). Al tocar el
 *   avatar se despliega un menú con nombre completo y, debajo, el rol.
 * - Desktop (≥425px): avatar + nombre + badge de rol (izq) | reloj (der),
 *   sin hamburguesa (la navegación vive en el sidebar).
 */
export function TopBar({ onOpenMenu, isMenuOpen }: TopBarProps) {
  const { user } = useUserContext();
  // null en el primer render (SSR + hidratación) para evitar mismatch; se rellena en el mount
  const [time, setTime] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTime(formatTime(new Date()));
    const intervalId = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Cerrar el menú de usuario al hacer clic fuera o con Escape
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

  const roleLabel = user ? roleLabels[user.role] ?? user.role : '';
  // Nombre completo (firstName + lastName); si no hay datos, "Usuario"
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const initial = (user?.firstName ?? '?').charAt(0).toUpperCase();

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

      {/* Derecha: reloj + avatar (móvil) */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums" aria-label="Hora actual">
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
