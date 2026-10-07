/**
 * E2E-only page for the Zoho-style banking transaction panel and scrollbar.
 * Registered at /__e2e__/banking-transactions when served with VITE_E2E=1.
 */
import { useState } from 'react';
import { TransactionDetailPanel, type TransactionDetail } from '@/components/banking/TransactionDetailPanel';
import { BankingRegisterToolbar } from '@/components/banking/BankingRegisterToolbar';
import { AuroraScroll } from '@/components/ui/aurora-scroll';
import { EditTransactionDialog } from '@/components/banking/EditTransactionDialog';
import type { BankTransaction } from '@/hooks/useBankTransactions';

const seed: TransactionDetail[] = Array.from({ length: 40 }, (_, index) => ({
  id: `tx-${index + 1}`,
  bank_account_id: 'bank-1',
  transaction_date: '2026-10-02',
  description: index === 0 ? 'Customer Transfer Cr. PC FROM' : `POS Purchase ${index + 1}`,
  amount: index === 0 ? 1000 : 8 + index,
  transaction_type: index % 4 === 0 ? 'deposit' : 'withdrawal',
  status: 'unmatched',
  category: index === 0 ? 'Transfer' : 'Travel',
  payee_payor: index === 0 ? 'TINGG' : null,
  reference: `PLAID-${index + 1}`,
  memo: null,
  gl_account_id: null,
  journal_entry_id: null,
  is_cleared: false,
  imported_at: '2026-10-02T12:00:00Z',
  updated_at: '2026-10-02T12:00:00Z',
  created_at: '2026-10-02T12:00:00Z',
}));

export default function E2EBankingTransactionsHarness() {
  const [rows, setRows] = useState(seed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const metrics = [
    ['Total', '261'],
    ['Unmatched', '7'],
    ['Matched', '254'],
    ['Reconciled', '0'],
    ['Deposits', '$57,039.95'],
    ['Withdrawals', '$43,528.55'],
    ['Net', '+$13,511.40'],
    ['Posted', '161/261'],
  ];

  return (
    <main className="flex h-screen flex-col gap-2 bg-slate-50 p-3">
      <BankingRegisterToolbar
        title="Bank Transactions"
        unmatchedCount={93}
        activeRuleCount={50}
        onAiCategorize={() => undefined}
        onApplyRules={() => undefined}
        onOpenRules={() => undefined}
        onQuickImport={() => undefined}
        onAiExtraction={() => undefined}
        onPdfExtract={() => undefined}
        onImportHistory={() => undefined}
        onExport={() => undefined}
      />
      <div data-testid="banking-metric-strip" className="grid grid-cols-4 gap-2 xl:grid-cols-8">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-indigo-100 bg-white p-2 pr-8">
            <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
            <p className="text-base font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <section className="flex min-h-0 flex-1 gap-3">
      <section className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-white">
        <h2 className="border-b px-3 py-2 text-sm font-semibold text-foreground">Register</h2>
        <AuroraScroll className="h-[calc(100vh-11rem)]" testId="banking-transaction-scroll">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Payee/Payor</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedId(row.id);
                    setEditing(false);
                  }}
                >
                  <td>Oct 2, 2026</td>
                  <td>{row.description}</td>
                  <td>{row.payee_payor || '-'}</td>
                  <td className="text-right font-mono">{row.transaction_type === 'deposit' ? '+' : '-'}${row.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AuroraScroll>
      </section>
      {selected && (
        <TransactionDetailPanel
          transaction={selected}
          accountName="Current Account"
          accountKind="bank"
          glAccountLabel={null}
          formatCurrency={(value) => value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
          formatDate={() => 'Oct 2, 2026'}
          locked={false}
          editing={editing}
          onEdit={() => setEditing(true)}
          onClose={() => {
            setSelectedId(null);
            setEditing(false);
          }}
          onUncategorize={() => {
            setRows((current) => current.map((row) => (
              row.id === selected.id ? { ...row, category: null, gl_account_id: null } : row
            )));
          }}
          onSaveMemo={(memo) => {
            setRows((current) => current.map((row) => (row.id === selected.id ? { ...row, memo } : row)));
          }}
          editForm={(
            <EditTransactionDialog
              embedded
              open
              transaction={selected as BankTransaction}
              onOpenChange={(open) => {
                if (!open) setEditing(false);
              }}
              onSave={(updates) => {
                setRows((current) => current.map((row) => (
                  row.id === selected.id ? { ...row, ...updates } : row
                )));
                setEditing(false);
              }}
            />
          )}
        />
      )}
      </section>
    </main>
  );
}
