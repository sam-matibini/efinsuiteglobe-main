import { useMemo, useState } from 'react';
import { Pencil, Check, X, RotateCcw, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type BankRowType = 'deposit' | 'withdrawal';
export type CreditCardRowType = 'charge' | 'payment' | 'credit' | 'fee' | 'interest';

export interface EditablePreviewRow {
  date: string;
  description: string;
  payee_payor?: string;
  amount: number;
  type: string;
  reference?: string;
}

const CC_TYPES: CreditCardRowType[] = ['charge', 'payment', 'credit', 'fee', 'interest'];

/** Types that represent money coming IN (green / positive in the preview). */
function isInflow(mode: 'bank' | 'credit-card', type: string): boolean {
  return mode === 'credit-card'
    ? type === 'payment' || type === 'credit'
    : type === 'deposit';
}

interface EditableImportPreviewProps<T extends EditablePreviewRow> {
  mode: 'bank' | 'credit-card';
  /** Rows as they will be imported (already includes any corrections). */
  rows: T[];
  /** Rows exactly as parsed from the file — used to flag which rows were edited. */
  baselineRows: T[];
  onChange: (rows: T[]) => void;
  formatCurrency: (value: number) => string;
  showPayee?: boolean;
}

export function EditableImportPreview<T extends EditablePreviewRow>({
  mode,
  rows,
  baselineRows,
  onChange,
  formatCurrency,
  showPayee = true,
}: EditableImportPreviewProps<T>) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditablePreviewRow | null>(null);

  const editedFlags = useMemo(
    () =>
      rows.map((r, i) => {
        const b = baselineRows[i];
        if (!b) return false;
        return (
          r.date !== b.date ||
          r.description !== b.description ||
          (r.payee_payor || '') !== (b.payee_payor || '') ||
          Number(r.amount) !== Number(b.amount) ||
          r.type !== b.type
        );
      }),
    [rows, baselineRows],
  );

  const editedCount = editedFlags.filter(Boolean).length;

  const patchRow = (index: number, patch: Partial<EditablePreviewRow>) => {
    onChange(rows.map((r, i) => (i === index ? ({ ...r, ...patch } as T) : r)));
  };

  const setType = (index: number, type: string) => patchRow(index, { type });

  const flipType = (index: number) => {
    const current = rows[index].type;
    if (mode === 'credit-card') {
      setType(index, current === 'charge' ? 'payment' : 'charge');
    } else {
      setType(index, current === 'deposit' ? 'withdrawal' : 'deposit');
    }
  };

  const matchingCount = (index: number) => {
    const key = (rows[index].description || '').trim().toLowerCase();
    if (!key) return 0;
    return rows.filter(
      (r, i) => i !== index && (r.description || '').trim().toLowerCase() === key,
    ).length;
  };

  const applyTypeToMatching = (index: number) => {
    const key = (rows[index].description || '').trim().toLowerCase();
    const type = rows[index].type;
    onChange(
      rows.map((r) =>
        (r.description || '').trim().toLowerCase() === key ? ({ ...r, type } as T) : r,
      ),
    );
  };

  const resetRow = (index: number) => {
    const base = baselineRows[index];
    if (!base) return;
    onChange(rows.map((r, i) => (i === index ? ({ ...base } as T) : r)));
  };

  const resetAll = () => onChange(baselineRows.map((r) => ({ ...r }) as T));

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setDraft({ ...rows[index] });
  };

  const commitEdit = () => {
    if (editingIndex === null || !draft) return;
    patchRow(editingIndex, {
      date: draft.date,
      description: draft.description,
      payee_payor: draft.payee_payor,
      amount: Math.abs(Number(draft.amount) || 0),
    });
    setEditingIndex(null);
    setDraft(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Correct any wrongly mapped row before importing — use the pencil to edit values or the
          flip/type control to fix the classification.
        </p>
        {editedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="shrink-0">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset {editedCount} edit{editedCount === 1 ? '' : 's'}
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-auto max-h-[380px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 font-medium">Date</th>
              <th className="text-left p-2 font-medium">Description</th>
              {showPayee && <th className="text-left p-2 font-medium">Payee/Payor</th>}
              <th className="text-right p-2 font-medium">Amount</th>
              <th className="text-left p-2 font-medium">Type</th>
              <th className="text-right p-2 font-medium w-[110px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const editing = editingIndex === index;
              const inflow = isInflow(mode, row.type);
              const matches = matchingCount(index);

              return (
                <tr key={index} className="border-t border-border align-top">
                  <td className="p-2 text-muted-foreground whitespace-nowrap">
                    {editing ? (
                      <Input
                        type="date"
                        className="h-8 w-[140px]"
                        value={draft?.date ?? ''}
                        onChange={(e) => setDraft((d) => (d ? { ...d, date: e.target.value } : d))}
                      />
                    ) : (
                      row.date
                    )}
                  </td>
                  <td className="p-2 text-foreground max-w-[240px]">
                    {editing ? (
                      <Input
                        className="h-8"
                        value={draft?.description ?? ''}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, description: e.target.value } : d))
                        }
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate">{row.description}</span>
                        {editedFlags[index] && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            Edited
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>
                  {showPayee && (
                    <td className="p-2 text-muted-foreground max-w-[160px]">
                      {editing ? (
                        <Input
                          className="h-8"
                          value={draft?.payee_payor ?? ''}
                          onChange={(e) =>
                            setDraft((d) => (d ? { ...d, payee_payor: e.target.value } : d))
                          }
                        />
                      ) : (
                        <span className="truncate block">{row.payee_payor || '-'}</span>
                      )}
                    </td>
                  )}
                  <td
                    className={`p-2 text-right font-mono whitespace-nowrap ${
                      inflow ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {editing ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-[110px] text-right"
                        value={draft?.amount ?? 0}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, amount: Number(e.target.value) } : d))
                        }
                      />
                    ) : (
                      <>
                        {inflow ? '+' : '-'}
                        {formatCurrency(Math.abs(row.amount))}
                      </>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        {mode === 'credit-card' ? (
                          <Select value={row.type} onValueChange={(v) => setType(index, v)}>
                            <SelectTrigger className="h-8 w-[120px] capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CC_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="capitalize">
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={inflow ? 'default' : 'outline'}
                            className="capitalize cursor-default"
                          >
                            {row.type}
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={
                            mode === 'credit-card'
                              ? 'Flip between Charge and Payment'
                              : 'Flip between Deposit and Withdrawal'
                          }
                          onClick={() => flipType(index)}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {matches > 0 && (
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline text-left"
                          onClick={() => applyTypeToMatching(index)}
                        >
                          Apply this type to all {matches + 1} matching rows
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {editing ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={commitEdit}
                          title="Save row"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(index)}
                          title="Edit this row"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {editedFlags[index] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => resetRow(index)}
                            title="Reset this row"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
