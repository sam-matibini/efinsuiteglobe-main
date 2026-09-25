import { useState, useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ProductServiceItem {
  id: string;
  name: string;
  selling_price: number;
  tax_rate: number | null;
  type: 'product' | 'service';
  category: string | null;
}

interface DescriptionSearchComboboxProps {
  value: string;
  productsServices: ProductServiceItem[];
  onSelect: (ps: { name: string; selling_price: number; tax_rate: number | null }) => void;
  onCustom: (desc: string) => void;
  registerProps?: any;
}

export function DescriptionSearchCombobox({
  value,
  productsServices,
  onSelect,
  onCustom,
}: DescriptionSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return productsServices;
    const term = search.toLowerCase();
    return productsServices.filter(
      ps => ps.name.toLowerCase().includes(term) || ps.category?.toLowerCase().includes(term)
    );
  }, [search, productsServices]);

  const groupedItems = useMemo(() => {
    const services = filtered.filter(ps => ps.type === 'service');
    const products = filtered.filter(ps => ps.type === 'product');
    return { services, products };
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-8 text-xs px-2 border-0 bg-transparent hover:bg-muted/50"
        >
          <span className="truncate text-left flex-1">{value || 'Description'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 z-50 bg-popover" align="start">
        <div className="border-b px-3 py-2">
          <Input
            placeholder="Search products & services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[250px]">
          {filtered.length === 0 && !search ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              No products or services configured
            </p>
          ) : (
            <>
              {groupedItems.services.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                    Services
                  </div>
                  {groupedItems.services.map((ps) => (
                    <button
                      key={ps.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                      onClick={() => {
                        onSelect(ps);
                        setSearch('');
                        setOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{ps.name}</div>
                        {ps.category && (
                          <div className="text-xs text-muted-foreground">{ps.category}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {ps.tax_rate != null && ps.tax_rate > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {ps.tax_rate}%
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ${ps.selling_price.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {groupedItems.products.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                    Products
                  </div>
                  {groupedItems.products.map((ps) => (
                    <button
                      key={ps.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                      onClick={() => {
                        onSelect(ps);
                        setSearch('');
                        setOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{ps.name}</div>
                        {ps.category && (
                          <div className="text-xs text-muted-foreground">{ps.category}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {ps.tax_rate != null && ps.tax_rate > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {ps.tax_rate}%
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ${ps.selling_price.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filtered.length === 0 && search && (
                <p className="text-sm text-muted-foreground p-3 text-center">No matches found</p>
              )}
            </>
          )}
        </ScrollArea>

        {/* Custom description option */}
        {search && !filtered.some(ps => ps.name.toLowerCase() === search.toLowerCase()) && (
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm border-t hover:bg-accent text-primary"
            onClick={() => {
              onCustom(search);
              setSearch('');
              setOpen(false);
            }}
          >
            Use "{search}" as custom description
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
