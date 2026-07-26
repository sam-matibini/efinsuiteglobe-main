import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ChevronDown, Globe2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import {
  useCountryFilter,
  normalizeCountryCode,
  countryName,
  countryFlag,
} from '@/hooks/useCountryFilter';
import type { Organization } from '@/hooks/useOrganization';

interface Group {
  code: string;
  name: string;
  orgs: Organization[];
}

export function CountrySelector() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentOrganization: currentOrg,
    organizations,
    switchOrganization,
  } = useOrganizationContext();
  const { country, setCountry, clear } = useCountryFilter();

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const org of organizations ?? []) {
      const code = normalizeCountryCode(org.country) ?? 'ZZ';
      const name = code === 'ZZ' ? 'Unassigned' : countryName(code);
      if (!map.has(code)) map.set(code, { code, name, orgs: [] });
      map.get(code)!.orgs.push(org);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations]);

  const activeCode = country ?? normalizeCountryCode(currentOrg?.country ?? null);
  const displayName = activeCode ? countryName(activeCode) : 'All countries';
  const displayFlag = activeCode ? countryFlag(activeCode) : '🌐';

  const term = search.trim().toLowerCase();
  const filteredGroups = term
    ? groups
        .map((g) => ({
          ...g,
          orgs: g.orgs.filter(
            (o) =>
              g.name.toLowerCase().includes(term) ||
              o.name.toLowerCase().includes(term) ||
              o.legal_name?.toLowerCase().includes(term)
          ),
        }))
        .filter((g) => g.orgs.length > 0 || g.name.toLowerCase().includes(term))
    : groups;

  const handleSelectCountry = (code: string | null) => {
    setCountry(code);
  };

  const handleSelectOrg = (org: Organization) => {
    setOpen(false);
    setSearch('');
    const code = normalizeCountryCode(org.country);
    if (code) setCountry(code);
    if (org.id !== currentOrg?.id && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
    if (org.id !== currentOrg?.id) switchOrganization(org);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 pl-2 pr-2 md:pr-3 border-border/60 bg-background/60 hover:bg-muted"
          aria-label="Country selector"
        >
          <span className="text-base leading-none">{displayFlag}</span>
          <span className="hidden md:inline text-sm font-medium truncate max-w-[140px]">
            {displayName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 p-0">
        <div className="p-2 border-b">
          <Input
            placeholder="Search country or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="max-h-[380px] overflow-y-auto p-1">
          <button
            onClick={() => handleSelectCountry(null)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-muted transition-colors',
              !country && 'bg-muted'
            )}
          >
            <Globe2 className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">All countries</span>
            <Badge variant="secondary" className="text-xs">
              {organizations?.length ?? 0}
            </Badge>
            {!country && <Check className="w-4 h-4 text-primary" />}
          </button>

          <div className="my-1 h-px bg-border" />

          {filteredGroups.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results.
            </div>
          )}

          {filteredGroups.map((g) => {
            const isActive = country === g.code;
            return (
              <div key={g.code} className="mb-1">
                <button
                  onClick={() => handleSelectCountry(g.code === 'ZZ' ? null : g.code)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-muted transition-colors',
                    isActive && 'bg-muted'
                  )}
                >
                  <span className="text-base leading-none">
                    {g.code === 'ZZ' ? '🏳️' : countryFlag(g.code)}
                  </span>
                  <span className="flex-1 text-sm font-medium">{g.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {g.orgs.length}
                  </Badge>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </button>
                <div className="ml-6 border-l border-border/60 pl-2">
                  {g.orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-muted transition-colors',
                        currentOrg?.id === org.id && 'text-primary font-medium'
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{org.name}</span>
                      {currentOrg?.id === org.id && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {country && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs text-muted-foreground"
              onClick={() => clear()}
            >
              Clear country filter
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
