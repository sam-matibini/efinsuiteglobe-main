import { useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SavedFilter } from '@/lib/savedFilters';

interface SavedFilterMenuProps<T> {
  items: SavedFilter<T>[];
  onSave: (name: string) => { saved: SavedFilter<T> | null; updated: boolean; error?: 'empty' | 'limit' };
  onApply: (filter: SavedFilter<T>) => void;
  onDelete: (id: string) => void;
}

export function SavedFilterMenu<T>({ items, onSave, onApply, onDelete }: SavedFilterMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const active = items.find((item) => item.id === activeId);

  const handleSave = () => {
    const result = onSave(name);
    if (result.error === 'empty') {
      toast.error('Enter a name for this filter.');
      return;
    }
    if (result.error === 'limit') {
      toast.error('Delete a saved filter before adding another.');
      return;
    }
    if (result.saved) {
      setActiveId(result.saved.id);
      setName('');
      toast.success(result.updated ? `Updated “${result.saved.name}”` : `Saved “${result.saved.name}”`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Saved filters">
          <Bookmark className="w-4 h-4" />
          <span className="max-w-[140px] truncate">{active?.name ?? 'Saved filters'}</span>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">{items.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Saved filters</p>
            <p className="text-xs text-muted-foreground">Apply a filter again without clearing and resetting.</p>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved filters yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${item.id === activeId ? 'bg-muted font-medium' : ''}`}
                    onClick={() => {
                      onApply(item);
                      setActiveId(item.id);
                      setOpen(false);
                    }}
                  >
                    {item.name}
                  </button>
                  {pendingDeleteId === item.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        onDelete(item.id);
                        if (activeId === item.id) setActiveId(null);
                        setPendingDeleteId(null);
                        toast.success(`Deleted “${item.name}”`);
                      }}
                    >
                      Delete
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => setPendingDeleteId(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 border-t pt-3">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name this filter"
              aria-label="Filter name"
              maxLength={48}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSave();
              }}
            />
            <Button type="button" size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
