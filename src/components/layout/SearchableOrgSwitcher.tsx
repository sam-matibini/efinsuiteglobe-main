import { useEffect, useState, useMemo, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ChevronsUpDown, Building2, Plus, Search, Star } from 'lucide-react';
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
import { normalizeCountryCode, countryName, countryFlag } from '@/hooks/useCountryFilter';
import {
  orderOrganizationsByFavorite,
  readFavoriteOrganizationIds,
  toggleFavoriteOrganization,
  writeFavoriteOrganizationIds,
} from '@/lib/organizationFavorites';

interface SearchableOrgSwitcherProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  onSwitch: (org: Organization) => void;
  onCreateNew: () => void;
  filterCountry?: string | null;
  onClearCountryFilter?: () => void;
  userId?: string | null;
}

export const SearchableOrgSwitcher = forwardRef<HTMLDivElement, SearchableOrgSwitcherProps>(
  function SearchableOrgSwitcher({
    currentOrg,
    organizations,
    isLoading,
    onSwitch,
    onCreateNew,
    filterCountry,
    onClearCountryFilter,
    userId,
  }, ref) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavoriteOrganizationIds(userId));

    useEffect(() => {
      setFavoriteIds(readFavoriteOrganizationIds(userId));
    }, [userId]);
    const navigate = useNavigate();
    const location = useLocation();

    // Filter by country, sort alphabetically, then filter by search term
    const filteredOrganizations = useMemo(() => {
      let orgs = [...organizations];
      if (filterCountry) {
        orgs = orgs.filter(
          (o) => normalizeCountryCode(o.country) === filterCountry
        );
      }
      if (search.trim()) {
        const term = search.toLowerCase();
        orgs = orgs.filter(
          (org) =>
            org.name.toLowerCase().includes(term) ||
            org.legal_name?.toLowerCase().includes(term) ||
            org.business_number?.toLowerCase().includes(term)
        );
      }
      if (favoritesOnly) orgs = orgs.filter((org) => favoriteIds.includes(org.id));
      return orderOrganizationsByFavorite(orgs, favoriteIds);
    }, [organizations, search, filterCountry, favoriteIds, favoritesOnly]);

    const toggleFavorite = (organizationId: string) => {
      setFavoriteIds((current) => {
        const next = toggleFavoriteOrganization(current, organizationId);
        writeFavoriteOrganizationIds(userId, next);
        return next;
      });
    };

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
                  aria-label="Search organizations"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-muted focus-visible:ring-sidebar-primary"
                />
              </div>
              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((current) => !current)}
                className={cn(
                  'mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                  favoritesOnly ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent/50 text-sidebar-foreground',
                )}
              >
                <Star className={cn('w-3 h-3', favoritesOnly && 'fill-current')} />
                Favorites{favoriteIds.length > 0 ? ` (${favoriteIds.length})` : ''}
              </button>
              {filterCountry && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-sidebar-accent/50 px-2 py-1 text-xs text-sidebar-foreground">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span>{countryFlag(filterCountry)}</span>
                    <span className="truncate">Filtered by {countryName(filterCountry)}</span>
                  </span>
                  {onClearCountryFilter && (
                    <button
                      onClick={onClearCountryFilter}
                      className="text-sidebar-muted hover:text-sidebar-foreground underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Organization List with proper scrolling */}
            <div className="max-h-[280px] overflow-y-auto">
              <div className="p-1">
                {filteredOrganizations.length === 0 ? (
                  <div className="py-6 text-center text-sm text-sidebar-muted">
                    {favoritesOnly ? 'No favorite organizations yet.' : 'No organizations found.'}
                  </div>
                ) : (
                  filteredOrganizations.map((org, index) => {
                    const favorite = favoriteIds.includes(org.id);
                    const previousFavorite = index > 0 && favoriteIds.includes(filteredOrganizations[index - 1].id);
                    return (
                      <div key={org.id}>
                        {favorite && index === 0 && (
                          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-sidebar-muted">Favorites</p>
                        )}
                        {!favorite && previousFavorite && (
                          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-sidebar-muted">All companies</p>
                        )}
                        <div
                          className={cn(
                            'flex items-center rounded-md',
                            currentOrg?.id === org.id && 'bg-sidebar-primary text-sidebar-primary-foreground',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelect(org)}
                            className={cn(
                              'flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left transition-colors',
                              'hover:bg-sidebar-accent text-sidebar-foreground',
                              currentOrg?.id === org.id && 'text-sidebar-primary-foreground hover:bg-sidebar-primary',
                            )}
                          >
                            <Building2 className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-sm truncate">{org.name}</span>
                            {currentOrg?.id === org.id && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                          <button
                            type="button"
                            aria-label={favorite ? `Remove ${org.name} from favorites` : `Favorite ${org.name}`}
                            aria-pressed={favorite}
                            onClick={() => toggleFavorite(org.id)}
                            className="mr-1 rounded p-1 text-sidebar-muted hover:text-amber-400"
                          >
                            <Star className={cn('w-4 h-4', favorite && 'fill-amber-400 text-amber-400')} />
                          </button>
                        </div>
                      </div>
                    );
                  })
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
