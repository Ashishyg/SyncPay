import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Send, QrCode, PlusCircle, Landmark, History, Bell, Store, RefreshCw,
  Settings, ScanLine, Moon, Sun, ChevronsUpDown, User, LogOut, PanelLeft, Search, CloudCheck, CloudOff,
} from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { getUnsettledTxns } from '@/services/storageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Wallet', items: [
    { path: '/home', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/send', label: 'Send money', icon: Send },
    { path: '/receive', label: 'Receive', icon: QrCode },
    { path: '/scan', label: 'Scan QR', icon: ScanLine },
    { path: '/add-money', label: 'Add money', icon: PlusCircle },
    { path: '/withdraw', label: 'Withdraw', icon: Landmark },
  ]},
  { label: 'Activity', items: [
    { path: '/history', label: 'History', icon: History },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/sync', label: 'Sync status', icon: RefreshCw },
    { path: '/merchant', label: 'Merchant', icon: Store },
  ]},
  { label: 'Account', items: [
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]},
];

const MOBILE_TABS = [
  { path: '/home', label: 'Home', icon: LayoutDashboard },
  { path: '/send', label: 'Send', icon: Send },
  { path: '/scan', label: 'Scan', icon: ScanLine, cta: true },
  { path: '/history', label: 'History', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const initialOf = (user) => (user?.name || 'U')[0].toUpperCase();

function UserMenu({ onNavigate, compact }) {
  const navigate = useNavigate();
  const { user, logout } = useWalletStore();
  const go = (p) => { navigate(p); onNavigate?.(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
            <Avatar className="size-8"><AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{initialOf(user)}</AvatarFallback></Avatar>
          </button>
        ) : (
          <button className="flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent">
            <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{initialOf(user)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.phone}</p>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={compact ? 'bottom' : 'top'} align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user?.name || 'User'}</p>
          <p className="text-xs text-muted-foreground">{user?.phone}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go('/profile')}><User />Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => go('/settings')}><Settings />Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { localStorage.removeItem('sp_token'); logout(); go('/login'); }}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Bottom-of-sidebar card (the reference's promo slot): live settlement status.
function SyncCard({ onNavigate }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOnline = useWalletStore(s => s.isOnline);
  const [pending, setPending] = useState(0);
  useEffect(() => { getUnsettledTxns().then(t => setPending(t.length)).catch(() => {}); }, [pathname, isOnline]);
  return (
    <div className="rounded-xl bg-muted/40 ring-1 ring-foreground/10">
      <div className="space-y-2 rounded-lg bg-card p-3 ring-1 ring-foreground/5 shadow-[0_1px_0_0_rgb(0_0_0/0.05)]">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {isOnline ? <CloudCheck className="size-4 text-success" /> : <CloudOff className="size-4 text-warning" />}
          {isOnline ? 'Online' : 'Offline mode'}
        </div>
        <p className="text-xs text-muted-foreground">
          {pending ? `${pending} payment${pending === 1 ? '' : 's'} waiting to settle.` : 'All payments settled.'}
          {!isOnline && ' QR payments still work.'}
        </p>
        <Button size="sm" variant={pending ? 'default' : 'outline'} className="w-full" onClick={() => { navigate('/sync'); onNavigate?.(); }}>
          Sync status
        </Button>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [q, setQ] = useState('');
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const go = (p) => { navigate(p); setQ(''); onNavigate?.(); };
  const groups = NAV.map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q.toLowerCase())) })).filter(g => g.items.length);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Logo className="px-1 pt-1" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="h-8 bg-background pl-8 pr-10 shadow-none"
          onKeyDown={e => { if (e.key === 'Enter' && groups[0]) go(groups[0].items[0].path); }} />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </div>
      <nav className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ path, label, icon: Icon }) => {
                const active = pathname === path || (path !== '/home' && pathname.startsWith(path + '/'));
                return (
                  <li key={path}>
                    <button onClick={() => go(path)}
                      className={cn('flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors',
                        active ? 'bg-sidebar-accent font-medium' : 'text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground')}>
                      <Icon className="size-4" />{label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <SyncCard onNavigate={onNavigate} />
      <UserMenu onNavigate={onNavigate} />
    </div>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isOnline, theme, toggleTheme } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sp_sidebar') === 'collapsed');
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed(c => { localStorage.setItem('sp_sidebar', c ? 'open' : 'collapsed'); return !c; });
    } else setOpen(true);
  };

  return (
    <div className="min-h-svh bg-background">
      {/* Desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar transition-transform lg:block', collapsed && 'lg:-translate-x-full')}>
        <SidebarNav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn('transition-[padding]', !collapsed && 'lg:pl-64')}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/40 px-4 backdrop-blur-md lg:px-6">
          <Button variant="ghost" size="icon-sm" className="-ml-1" onClick={toggleSidebar} aria-label="Toggle sidebar"><PanelLeft /></Button>
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span className={cn('size-1.5 rounded-full', isOnline ? 'bg-success' : 'bg-warning')} />
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate('/notifications')} aria-label="Notifications"><Bell /></Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun /> : <Moon />}</Button>
            <div className="ml-1"><UserMenu compact /></div>
          </div>
        </header>

        <main className="pb-24 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
          {MOBILE_TABS.map(({ path, label, icon: Icon, cta }) => cta ? (
            <button key={path} onClick={() => navigate(path)} aria-label={label}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95">
              <Icon className="size-6" />
            </button>
          ) : (
            <button key={path} onClick={() => navigate(path)}
              className={cn('flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                pathname === path ? 'text-foreground' : 'text-muted-foreground')}>
              <Icon className="size-5" />{label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
