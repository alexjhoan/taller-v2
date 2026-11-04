import { ReactNode, useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/TopBar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // Estado compartido entre Layout y Sidebar (props simples, sin context)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => setIsCollapsed((prev) => !prev), []);
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Auto-colapso: 425–640px arranca colapsado (solo iconos, ~370px de contenido);
  // ≥640px expandido; <425px drawer (el colapso no aplica). Se re-aplica solo al cruzar de rango.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq425 = window.matchMedia("(min-width: 425px)");
    const mq768 = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      if (mq425.matches && !mq768.matches) setIsCollapsed(true);
      else setIsCollapsed(false);
    };
    apply();
    mq425.addEventListener("change", apply);
    mq768.addEventListener("change", apply);
    return () => {
      mq425.removeEventListener("change", apply);
      mq768.removeEventListener("change", apply);
    };
  }, []);

  return (
    <div className='flex min-h-dvh bg-surface-base'>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={handleCloseDrawer}
      />

      {/* Backdrop del drawer (solo <425px) */}
      {isDrawerOpen && (
        <div
          onClick={handleCloseDrawer}
          aria-hidden='true'
          className='fixed inset-0 z-[19] hidden animate-fade-in bg-slate-900/40 max-xs:block'
        />
      )}

      <main className={`min-w-0 ml-0 flex-1 ${isCollapsed ? "xs:ml-14" : "xs:ml-56"}`}>
        {/* Única barra superior: en móvil lleva la hamburguesa (abre el drawer);
            en desktop muestra usuario + reloj (como antes). */}
        <TopBar onOpenMenu={() => setIsDrawerOpen(true)} isMenuOpen={isDrawerOpen} />

        {children}
      </main>
    </div>
  );
}
