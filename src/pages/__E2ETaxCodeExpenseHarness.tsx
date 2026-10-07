/**
 * E2E-only page for assigning a non-recoverable PST code to an expense account.
 * Registered at /__e2e__/tax-code-expense when served with VITE_E2E=1.
 */
import { useState } from 'react';
import { EditTaxCodeDialog } from '@/components/tax/EditTaxCodeDialog';

const chart = [
  { id: 'taxes', code: '2-00-000', name: 'Taxes Payable', account_type: 'liability', is_header: true, posting_allowed: false },
  { id: 'gst-pay', code: '2-01-210', name: 'GST/HST Payable', account_type: 'liability' },
  { id: 'gst-itc', code: '1-20-110', name: 'GST/HST Input Tax Credit', account_type: 'asset' },
  { id: 'header-exp', code: '6-00-000', name: 'Expenses', account_type: 'expense', is_header: true, posting_allowed: false },
  { id: 'pst-paid', code: '6-09-210', name: 'PST Paid (Non-Recoverable)', account_type: 'expense' },
  { id: 'office', code: '6-03-105', name: 'Office', account_type: 'expense' },
];

const pstCode = {
  id: 'pst',
  code: 'PST-PAID',
  name: 'PST Paid',
  rate: 7,
  jurisdiction: 'CA',
  tax_type: 'purchase',
  applies_to: 'purchases',
  is_recoverable: false,
  is_active: true,
  gl_collected_account_id: null,
  gl_paid_account_id: null,
};

const gstCode = {
  id: 'gst',
  code: 'GST',
  name: 'GST',
  rate: 5,
  jurisdiction: 'CA',
  tax_type: 'both',
  applies_to: 'both',
  is_recoverable: true,
  is_active: true,
  gl_collected_account_id: 'gst-pay',
  gl_paid_account_id: 'gst-itc',
};

export default function E2ETaxCodeExpenseHarness() {
  const [code, setCode] = useState<typeof pstCode | typeof gstCode | null>(pstCode);
  const [saved, setSaved] = useState('');

  const savedLabel =
    saved === 'pst-paid'
      ? 'Saved to PST Paid (Non-Recoverable)'
      : saved === 'office'
        ? 'Saved to Office'
        : saved === 'gst-itc'
          ? 'Saved to GST/HST Input Tax Credit'
          : saved;

  return (
    <div className="p-6">
      <p data-testid="saved-paid-account" className="text-lg font-semibold text-foreground">{savedLabel}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setCode({ ...pstCode })}>Edit PST</button>
        <button type="button" onClick={() => setCode({ ...gstCode })}>Edit GST</button>
      </div>
      <EditTaxCodeDialog
        code={code}
        open={!!code}
        onOpenChange={(next) => {
          if (!next) setCode(null);
        }}
        accounts={chart}
        isPending={false}
        onSubmit={async (updates) => {
          setSaved(String(updates.gl_paid_account_id ?? ''));
          setCode(null);
        }}
      />
    </div>
  );
}
