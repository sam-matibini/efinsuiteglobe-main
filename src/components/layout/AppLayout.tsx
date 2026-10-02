import { ReactNode, useState, useEffect } from 'react';
import { ReadOnlyProvider } from '@/hooks/useIsReadOnly';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';

import { useEnabledModules } from '@/hooks/useEnabledModules';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, Bell, Search, HelpCircle, ChevronDown, Settings, LogOut, LayoutDashboard, Receipt, BarChart3, RefreshCw } from 'lucide-react';
import aliceAvatar from '@/assets/alice-avatar.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CountryFlagBadge } from '@/components/dashboard/CountryFlagBadge';
import { EconomicIndicatorsTicker } from '@/components/dashboard/EconomicIndicatorsTicker';
import { AIAccountingAssistant } from '@/components/dashboard/AIAccountingAssistant';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CountrySelector } from './CountrySelector';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aliceOpen, setAliceOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { isReadOnly } = useEnabledModules();
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const { currentOrganization } = useOrganizationContext();
  

  // Detect mobile viewport
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setViewport(width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop');
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Listen for service worker updates to show refresh icon
  useEffect(() => {
    const handler = () => setUpdateAvailable(true);
    window.addEventListener('sw-updated', handler);
    return () => window.removeEventListener('sw-updated', handler);
  }, []);

  useEffect(() => {
    const openAlice = () => setAliceOpen(true);
    window.addEventListener('efinsuite:open-alice', openAlice);
    return () => window.removeEventListener('efinsuite:open-alice', openAlice);
  }, []);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get display name with proper fallbacks
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || user?.email?.split('@')[0] || 'User';

  // Get current organization id from localStorage
  const currentOrgId = currentOrganization?.id;

  // Fetch user's role in current organization
  const { data: memberRole } = useQuery({
    queryKey: ['user-org-role', user?.id, currentOrgId],
    queryFn: async () => {
      if (!user?.id || !currentOrgId) return null;
      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', currentOrgId)
        .maybeSingle();
      if (error) throw error;
      return data?.role;
    },
    enabled: !!user?.id && !!currentOrgId,
  });

  // Global admins are always displayed as "Owner" regardless of org membership
  const effectiveRole = isAdmin ? 'owner' : (memberRole || 'member');

  const getRoleLabel = (role: string | null | undefined) => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'admin': return 'Admin';
      case 'finance_manager': return 'Finance Manager';
      case 'accountant': return 'Accountant';
      case 'payroll_officer': return 'Payroll Officer';
      case 'auditor': return 'Auditor (Read-only)';
      case 'bookkeeper': return 'Bookkeeper';
      case 'viewer': return 'Viewer';
      default: return 'Member';
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Use displayName for initials
  const userInitials = getInitials(displayName);
  const isMobile = viewport === 'mobile';
  const sidebarCollapsedEffective = viewport === 'tablet' || sidebarCollapsed;
  const hour = new Date().getHours();
  const greeting = hour < 17 ? 'Good morning' : 'Good evening';
  const greetingMark = hour < 17 ? '☀' : '🌙';
  const headerDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleClearCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      localStorage.removeItem('sw-reload-ts');
      localStorage.removeItem('app-build-version');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={sidebarCollapsedEffective} />
      </div>
      
      {/* Mobile Sidebar Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar collapsed={false} />
        </SheetContent>
      </Sheet>
      
      {/* Main Content */}
      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsedEffective ? 'ml-[60px]' : 'ml-[220px]'}`}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 overflow-hidden border-b border-[rgba(99,102,241,0.15)] bg-white px-3 shadow-[0_1px_0_rgba(99,102,241,0.1),0_2px_8px_rgba(0,0,0,0.04)] md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            {/* Mobile menu button */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => isMobile ? setMobileMenuOpen(!mobileMenuOpen) : setSidebarCollapsed(!sidebarCollapsed)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="hidden min-w-0 md:block">
              <p className="truncate text-lg font-extrabold leading-tight text-[#0f172a] xl:text-xl">
                {greeting}, {displayName.split(' ')[0]} {greetingMark}
              </p>
              <p className="truncate text-[13px] text-[#64748b]">{headerDate}</p>
            </div>

            {/* Country selector (MS Dynamics-style, top-left) */}
            <div className="hidden sm:block">
              <CountrySelector />
            </div>

            <div className="relative hidden xl:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="h-9 w-48 pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden xl:flex items-center gap-2">
              <CountryFlagBadge />
              <EconomicIndicatorsTicker />
            </div>
            
            {updateAvailable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearCache}
                    className="text-accent hover:text-accent animate-pulse"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Update available — click to refresh</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <HelpCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ef4444]" />
            </Button>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-muted/50">
                  <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#4f46e5]">
                    <span className="text-sm font-extrabold text-white">
                      {userInitials}
                    </span>
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-semibold text-[#0f172a]">
                      {displayName}
                    </p>
                    <p className="text-[11px] font-medium text-[#6366f1]">
                      {getRoleLabel(effectiveRole)}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 sm:hidden">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{getRoleLabel(effectiveRole)}</p>
                </div>
                <DropdownMenuSeparator className="sm:hidden" />
                {(effectiveRole === 'owner' || effectiveRole === 'admin') && (
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Alice AI Assistant - Floating HD Avatar */}
        {!aliceOpen && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setAliceOpen(true)}
                className="fixed bottom-20 right-4 z-30 flex flex-col items-center gap-1 group cursor-pointer md:bottom-6 md:right-6"
              >
                <div className="relative">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] shadow-[0_8px_30px_-5px_rgba(99,102,241,0.45)] transition-all duration-300 hover:scale-110">
                    <img 
                      src={aliceAvatar} 
                      alt="Alice - AI Assistant" 
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                </div>
                <span className="rounded-full bg-[#6366f1] px-2.5 py-0.5 text-xs font-semibold text-white shadow-md">
                  Alice
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Ask Alice - AI Assistant</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        )}

        <AIAccountingAssistant isOpen={aliceOpen} onOpenChange={setAliceOpen} />

        {/* Page Content - responsive padding */}
        <main className="flex flex-col gap-6 px-4 pb-24 pt-6 md:px-8 md:pb-12">
          <ReadOnlyProvider>
            {isReadOnly && <ReadOnlyBanner />}
            {children}
          </ReadOnlyProvider>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation - Quick Access */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[rgba(99,102,241,0.15)] bg-white/95 backdrop-blur-sm safe-area-inset-bottom">
          <div className="flex items-center justify-around h-14">
            <Button variant="ghost" size="sm" className="h-auto flex-col gap-0.5 py-2 text-[#6366f1]" onClick={() => navigate('/')}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px]">Dashboard</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => navigate('/sales/invoices')}>
              <Receipt className="w-5 h-5" />
              <span className="text-[10px]">Sales</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => navigate('/reports')}>
              <BarChart3 className="w-5 h-5" />
              <span className="text-[10px]">Reports</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => navigate('/tax')}>
              <Receipt className="w-5 h-5" />
              <span className="text-[10px]">Tax</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => setMobileMenuOpen(true)}>
              <Settings className="w-5 h-5" />
              <span className="text-[10px]">More</span>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
