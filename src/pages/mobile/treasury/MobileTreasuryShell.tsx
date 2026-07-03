import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Bell, CheckSquare, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/m/treasury', label: 'Home', icon: Home, end: true },
  { to: '/m/treasury/alerts', label: 'Alerts', icon: Bell },
  { to: '/m/treasury/approvals', label: 'Approvals', icon: CheckSquare },
  { to: '/m/treasury/copilot', label: 'Copilot', icon: MessageSquare },
];

export default function MobileTreasuryShell() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">efinsuite Treasury</h1>
      </header>
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 border-t bg-background grid grid-cols-4">
        {tabs.map((t) => {
          const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className={cn('flex flex-col items-center py-2 text-xs', active ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="h-5 w-5 mb-1" />{t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
