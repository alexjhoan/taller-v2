import { ReactNode } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar />
      <main className="ml-16 flex-1 lg:ml-64">{children}</main>
    </div>
  );
}
