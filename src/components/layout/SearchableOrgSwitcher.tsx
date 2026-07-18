import { useState, useMemo, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ChevronsUpDown, Building2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Organization } from '@/hooks/useOrganization';

interface SearchableOrgSwitcherProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  onSwitch: (org: Organization) => void;
  onCreateNew: () => void;
}

export const SearchableOrgSwitcher = forwardRef<HTMLDivElement, SearchableOrgSwitcherProps>(
  function SearchableOrgSwitcher({
    currentOrg,
    organizations,
    isLoading,
    onSwitch,
    onCreateNew,
  }, ref) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    // Sort alphabetically and filter by search term
    const filteredOrganizations = useMemo(() => {
      let orgs = [...organizations];
      orgs.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      if (search.trim()) {
        const term = search.toLowerCase();
        orgs = orgs.filter(
          (org) =>
            org.name.toLowerCase().includes(term) ||
            org.legal_name?.toLowerCase().includes(term) ||
            org.business_number?.toLowerCase().includes(term)
        );
      }
      return orgs;
    }, [organizations, search]);

    const handleSelect = (org: Organization) => {
      setOpen(false);
      setSearch('');
      // Navigate to dashboard FIRST so we're not on a page (e.g. /journal-entries)
      // whose own URL-sync effects would race with the post-switch redirect.
      if (org.id !== currentOrg?.id && location.pathname !== '/') {
        navigate('/', { replace: true });
      }
      onSwitch(org);
    };

    const handleCreateNew = () => {
      onCreateNew();
      setOpen(false);
      setSearch('');
    };

    return (
      <div ref={ref}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between px-3 py-2 h-auto bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-sidebar-muted shrink-0" />
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : currentOrg ? (
                  <span className="truncate text-sm">{currentOrg.name}</span>
                ) : (
                  <span className="text-sidebar-muted text-sm">No Organization</span>
                )}
              </div>
              <ChevronsUpDown className="w-4 h-4 text-sidebar-muted shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 p-0 bg-sidebar border-sidebar-border z-50" 
            align="start"
            sideOffset={8}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-sidebar-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-muted" />
                <Input
                  placeholder="Search organizations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-muted focus-visible:ring-sidebar-primary"
                />
              </div>
            </div>

            {/* Organization List with proper scrolling */}
            <div className="max-h-[280px] overflow-y-auto">
              <div className="p-1">
                {filteredOrganizations.length === 0 ? (
                  <div className="py-6 text-center text-sm text-sidebar-muted">
                    No organizations found.
                  </div>
                ) : (
                  filteredOrganizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSelect(org)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors",
                        "hover:bg-sidebar-accent text-sidebar-foreground",
                        currentOrg?.id === org.id && "bg-sidebar-primary text-sidebar-primary-foreground"
                      )}
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-sm truncate">{org.name}</span>
                      {currentOrg?.id === org.id && (
                        <Check className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Create Organization */}
            <div className="p-1 border-t border-sidebar-border">
              <button
                onClick={handleCreateNew}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors hover:bg-sidebar-accent text-sidebar-foreground"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="text-sm">Create Organization</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);
