import { Link, useLocation } from 'wouter';
import { useTheme } from './ThemeProvider';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Bot, ScrollText, AlertTriangle, Moon, Sun, Activity, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/logs', label: 'Update Logs', icon: ScrollText },
  { href: '/errors', label: 'Error Logs', icon: AlertTriangle },
  { href: '/operations', label: 'Operations', icon: Send },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const { data: bots } = useQuery({ queryKey: ['/api/bots'], queryFn: api.bots.list });

  const running = bots?.filter((b) => b.runtime?.isRunning).length ?? 0;
  const total = bots?.length ?? 0;

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 6.82a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground leading-none">TGBot Monitor</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              <Activity className="inline w-3 h-3 mr-1 text-green-500" />
              {running}/{total} running
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== '/' && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: theme toggle */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          data-testid="button-theme-toggle"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <div className="mt-2 px-3 text-xs text-muted-foreground">
          <a href="/api/docs" target="_blank" rel="noreferrer" className="hover:underline">
            API Docs (Swagger)
          </a>
        </div>
      </div>
    </aside>
  );
}
