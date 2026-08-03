import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PurchaseAttachmentsSection } from './PurchaseAttachmentsSection';
import { PurchaseAIAnalyzer } from './PurchaseAIAnalyzer';
import { usePurchaseAttachments, type PurchaseEntityType } from '@/hooks/usePurchaseAttachments';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const ENTITY_LABEL: Record<PurchaseEntityType, string> = {
  expense_claim: 'Expense Claim',
  expense: 'Expense',
  bill: 'Bill',
  purchase_order: 'Purchase Order',
  vendor: 'Vendor',
  recurring_bill: 'Recurring Bill',
  vendor_credit: 'Vendor Credit',
};

const NOTES_TABLE: Record<PurchaseEntityType, { table: string; notesColumn: string }> = {
  expense_claim: { table: 'expense_claims', notesColumn: 'notes' },
  expense: { table: 'expenses', notesColumn: 'notes' },
  bill: { table: 'bills', notesColumn: 'notes' },
  purchase_order: { table: 'purchase_orders', notesColumn: 'notes' },
  vendor: { table: 'vendors', notesColumn: 'notes' },
  recurring_bill: { table: 'recurring_bills', notesColumn: 'notes' },
  vendor_credit: { table: 'vendor_credits', notesColumn: 'notes' },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: PurchaseEntityType;
  entityId?: string | null;
  organizationId?: string | null;
  title?: string;
  currentNotes?: string | null;
  invalidateKeys?: string[];
}

export function PurchaseAttachmentsDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  organizationId,
  title,
  currentNotes,
  invalidateKeys,
}: Props) {
  const qc = useQueryClient();
  const { data: attachments = [] } = usePurchaseAttachments(entityType, entityId);

  const saveNotes = async (nextNotes: string) => {
    if (!entityId) return;
    const cfg = NOTES_TABLE[entityType];
    const { error } = await (supabase as any)
      .from(cfg.table)
      .update({ [cfg.notesColumn]: nextNotes })
      .eq('id', entityId);
    if (error) throw error;
    for (const k of invalidateKeys ?? []) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || `${ENTITY_LABEL[entityType]} — Documents`}</DialogTitle>
          <DialogDescription>
            Attach receipts, invoices, or supporting files and use AI to extract totals and reconcile
            them against this {ENTITY_LABEL[entityType].toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <PurchaseAttachmentsSection
            entityType={entityType}
            entityId={entityId}
            organizationId={organizationId}
          />
          <PurchaseAIAnalyzer
            entityType={entityType}
            entityId={entityId}
            hasAttachments={attachments.length > 0}
            currentNotes={currentNotes}
            onSaveNotes={saveNotes}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
