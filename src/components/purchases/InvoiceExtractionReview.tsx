import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InvoiceExtraction } from '@/lib/purchases/invoiceExtraction';

export interface ReviewField {
  /** Stable key returned to the caller when applied. */
  key: string;
  label: string;
  /** Value currently in the form (display string). */
  current: string;
  /** Extracted value (display string). */
  extracted: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraction: InvoiceExtraction;
  fields: ReviewField[];
  /** True when the caller can apply extracted line items. */
  supportsLines?: boolean;
  currentLineCount?: number;
  onApply: (selectedKeys: string[], applyLines: boolean) => void;
}

export function InvoiceExtractionReview({
  open,
  onOpenChange,
  extraction,
  fields,
  supportsLines,
  currentLineCount = 0,
  onApply,
}: Props) {
  const applicable = useMemo(
    () => fields.filter((f) => f.extracted && f.extracted !== '—'),
    [fields],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [applyLines, setApplyLines] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    applicable.forEach((f) => {
      next[f.key] = f.current !== f.extracted;
    });
    setSelected(next);
    setApplyLines(Boolean(supportsLines) && extraction.lines.length > 0);
  }, [open, applicable, supportsLines, extraction.lines.length]);

  const selectedKeys = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const canApply = selectedKeys.length > 0 || (applyLines && extraction.lines.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review extracted invoice data</DialogTitle>
          <DialogDescription>
            Nothing is changed until you apply. Uncheck anything you want to keep as-is.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-2">
            {applicable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No header fields could be read from the document.
              </p>
            ) : (
              applicable.map((f) => (
                <label
                  key={f.key}
                  className="flex items-start gap-3 rounded-md border p-3 text-sm cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={!!selected[f.key]}
                    onCheckedChange={(v) =>
                      setSelected((prev) => ({ ...prev, [f.key]: v === true }))
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{f.label}</div>
                    <div className="mt-1 grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Current: </span>
                        <span className="break-words">{f.current || '—'}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Extracted: </span>
                        <span className="break-words font-medium text-primary">{f.extracted}</span>
                      </div>
                    </div>
                  </div>
                </label>
              ))
            )}

            {supportsLines && extraction.lines.length > 0 && (
              <div className="rounded-md border p-3">
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <Checkbox
                    checked={applyLines}
                    onCheckedChange={(v) => setApplyLines(v === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      Replace line items{' '}
                      <Badge variant="secondary" className="ml-1">
                        {extraction.lines.length} found
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Replaces the {currentLineCount} line item{currentLineCount === 1 ? '' : 's'} in
                      the form. GL accounts are never guessed — you must pick an account for each
                      line before saving.
                    </p>
                    <div className="mt-2 space-y-1">
                      {extraction.lines.slice(0, 8).map((l, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                        >
                          <span className="truncate">{l.description}</span>
                          <span className="shrink-0 tabular-nums">
                            {l.quantity ?? 1} × {(l.unit_price ?? 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {extraction.lines.length > 8 && (
                        <div className="text-xs text-muted-foreground">
                          +{extraction.lines.length - 8} more…
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canApply}
            onClick={() => {
              onApply(selectedKeys, applyLines);
              onOpenChange(false);
            }}
          >
            Apply selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
