import { useEffect } from 'react';
import { formatUnreadCount } from '@/utils/alerts';

interface NotificationTabsProps {
  /** Tab activa: 'unread' | 'read' */
  activeTab: 'unread' | 'read';
  /** Callback al cambiar tab */
  onChange: (tab: 'unread' | 'read') => void;
  /** Contador de no leídas */
  unreadCount: number;
  /** Contador de leídas */
  readCount: number;
}

const tabs = [
  { key: 'unread' as const, label: 'No leídas', id: 'tab-unread', panelId: 'panel-unread' },
  { key: 'read' as const, label: 'Leídas', id: 'tab-read', panelId: 'panel-read' },
] as const;

/**
 * Tabs accesibles para notificaciones (No leídas / Leídas).
 * - role="tablist" + role="tab" + aria-selected + aria-controls
 * - Teclado: ←/→ navega, Enter/Space activa, Tab entra al panel
 * - URL sync se maneja en el padre (router.push shallow)
 */
export function NotificationTabs({
  activeTab,
  onChange,
  unreadCount,
  readCount,
}: NotificationTabsProps) {
  // Manejo de teclado para navegación entre tabs
  const handleKeyDown = (e: React.KeyboardEvent, tabKey: 'unread' | 'read') => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const newTab = tabKey === 'unread' ? 'read' : 'unread';
      onChange(newTab);
      // Foco al botón del nuevo tab
      document.getElementById(tabs.find(t => t.key === newTab)?.id ?? '')?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange('unread');
      document.getElementById('tab-unread')?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange('read');
      document.getElementById('tab-read')?.focus();
    }
  };

  return (
    <div role="tablist" className="flex border-b border-slate-200 mb-4" aria-label="Filtro de notificaciones">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = tab.key === 'unread' ? unreadCount : readCount;
        return (
          <button
            key={tab.key}
            id={tab.id}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={tab.panelId}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-5 text-xs px-1.5 rounded-full ${
                isActive
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
              aria-label={`${tab.label}, ${formatUnreadCount(tab.key === 'unread' ? unreadCount : readCount)}`}
            >
              {tab.key === 'unread' ? formatUnreadCount(unreadCount) : formatUnreadCount(readCount)}
            </span>
          </button>
        );
      })}
    </div>
  );
}