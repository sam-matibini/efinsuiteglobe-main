import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUserOrganizations } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';

interface SearchableOrganizationSelectProps {
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  onOrganizationSelect?: (org: {
    id: string;
    name: string;
    country: string | null;
    business_number: string | null;
    industry: string | null;
  } | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableOrganizationSelect({
  value,
  onValueChange,
  onOrganizationSelect,
  placeholder = 'Select Organization',
  disabled = false,
}: SearchableOrganizationSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: organizations, isLoading } = useUserOrganizations();

  const normalizedValue = value === '' ? null : value;

  const selectedOrg = useMemo(
    () => organizations?.find((org) => org.id === normalizedValue),
    [organizations, normalizedValue]
  );

  const filteredOrganizations = useMemo(() => {
    if (!organizations) return [];
    if (!search) return organizations;
    const term = search.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(term) ||
        org.legal_name?.toLowerCase().includes(term) ||
        org.business_number?.toLowerCase().includes(term) ||
        org.industry?.toLowerCase().includes(term)
    );
  }, [organizations, search]);

  const handleSelect = (orgId: string | null) => {
    onValueChange(orgId);
    if (onOrganizationSelect) {
      const org = orgId ? organizations?.find((o) => o.id === orgId) : null;
      onOrganizationSelect(
        org
          ? {
              id: org.id,
              name: org.name,
              country: org.country,
              business_number: org.business_number,
              industry: org.industry,
            }
          : null
      );
    }
    setOpen(false);
    setSearch('');
  };

  const getCountryFlag = (countryCode: string | null) => {
    if (!countryCode) return '';
    const localization = getCountryLocalization(countryCode);
    return localization.flag || '';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-9 justify-between font-normal"
          disabled={disabled || isLoading}
        >
          {selectedOrg ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedOrg.name}</span>
              {selectedOrg.country && (
                <span className="text-muted-foreground">
                  {getCountryFlag(selectedOrg.country)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{isLoading ? 'Loading...' : placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 z-50 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search organizations..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => handleSelect(null)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !normalizedValue ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="text-muted-foreground">None (Manual Entry)</span>
              </CommandItem>
              {filteredOrganizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => handleSelect(org.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      normalizedValue === org.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{org.name}</span>
                      {org.country && (
                        <span className="text-xs">{getCountryFlag(org.country)}</span>
                      )}
                    </div>
                    {(org.legal_name || org.business_number || org.industry) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {[org.legal_name, org.business_number, org.industry]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
