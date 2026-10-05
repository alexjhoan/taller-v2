import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, ChevronRight, LogOut, Wrench } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { navigationItems } from '@/utils/navigation';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();
  const { user, logout } = useUserContext();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const filteredItems = navigationItems.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-800">Mecaflow</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredItems.map((item) => {
          const isActive = router.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? 'bg-brand-100' : 'bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="truncate text-xs text-slate-400">{item.description}</p>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          title={isCollapsed ? 'Cerrar Sesión' : undefined}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <LogOut className="h-4 w-4 text-slate-500" />
          </div>
          {!isCollapsed && <span className="text-sm font-semibold">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
