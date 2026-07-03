import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAccessibleDepartments } from '@/hooks/useAccessibleDepartments';

interface DivisionFilterProps {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

/**
 * Multi-select Division filter for financial reports.
 * Empty selection = "All Divisions (Consolidated)".
 */
export function DivisionFilter({ value, onChange, className }: DivisionFilterProps) {
  const { data: departments = [] } = useAccessibleDepartments();
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const label =
    value.length === 0
      ? 'All Divisions'
      : value.length === 1
        ? departments.find((d: any) => d.id === value[0])?.name || '1 division'
        : `${value.length} divisions`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn('justify-between min-w-[200px]', className)}>
          <span className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search divisions..." />
          <CommandList>
            <CommandEmpty>No divisions.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => onChange([])}>
                <Check className={cn('mr-2 h-4 w-4', value.length === 0 ? 'opacity-100' : 'opacity-0')} />
                All Divisions (Consolidated)
              </CommandItem>
              {departments
                .filter((d: any) => d.is_active !== false)
                .map((d: any) => (
                  <CommandItem key={d.id} onSelect={() => toggle(d.id)}>
                    <Check className={cn('mr-2 h-4 w-4', value.includes(d.id) ? 'opacity-100' : 'opacity-0')} />
                    <span className="font-mono text-xs mr-2">{d.code}</span>
                    {d.name}
                    {d.is_shared && <Badge variant="secondary" className="ml-2 text-[10px]">Shared</Badge>}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
