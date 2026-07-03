import { useState, useMemo } from 'react';
import { Building2, User, UserPlus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Entity {
  id: string;
  name: string;
  email?: string | null;
}

interface EntityLookupPopoverProps {
  type: 'vendor' | 'customer';
  entities: Entity[];
  selectedId?: string | null;
  onSelect: (id: string | null, name: string | null) => void;
  onAddNew: () => void;
  disabled?: boolean;
}

export function EntityLookupPopover({
  type,
  entities,
  selectedId,
  onSelect,
  onAddNew,
  disabled,
}: EntityLookupPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedEntity = useMemo(() => {
    return entities.find((e) => e.id === selectedId);
  }, [entities, selectedId]);

  const filteredEntities = useMemo(() => {
    if (!search.trim()) return entities.slice(0, 50);
    const lower = search.toLowerCase();
    return entities
      .filter(
        (e) =>
          e.name.toLowerCase().includes(lower) ||
          e.email?.toLowerCase().includes(lower)
      )
      .slice(0, 50);
  }, [entities, search]);

  const handleSelect = (entity: Entity) => {
    onSelect(entity.id, entity.name);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null, null);
  };

  const handleAddNew = () => {
    setOpen(false);
    setSearch('');
    onAddNew();
  };

  const Icon = type === 'vendor' ? Building2 : User;
  const label = type === 'vendor' ? 'Vendor' : 'Customer';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 px-2 gap-1 text-xs font-normal justify-start',
            selectedEntity ? 'bg-primary/5 border-primary/30' : ''
          )}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {selectedEntity ? (
            <>
              <span className="truncate max-w-[80px]">{selectedEntity.name}</span>
              <X
                className="h-3 w-3 text-muted-foreground hover:text-foreground ml-1"
                onClick={handleClear}
              />
            </>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${label.toLowerCase()}s...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="h-[200px]">
          <div className="p-1">
            {filteredEntities.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No {label.toLowerCase()}s found
              </div>
            ) : (
              filteredEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-muted transition-colors',
                    entity.id === selectedId && 'bg-primary/10'
                  )}
                  onClick={() => handleSelect(entity)}
                >
                  <div className="font-medium truncate">{entity.name}</div>
                  {entity.email && (
                    <div className="text-xs text-muted-foreground truncate">
                      {entity.email}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-primary"
            onClick={handleAddNew}
          >
            <UserPlus className="h-4 w-4" />
            Add New {label}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
