import React, { useState, useMemo } from 'react';
import { parseLocalDate } from '@/lib/utils';
import { Download, Building2, ArrowUpDown, FileSpreadsheet, FileText, Printer, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useDepartments } from '@/hooks/useDimensions';
import { DivisionFilter } from '@/components/reports/DivisionFilter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LedgerTransaction {
  id: string;
  entry_date: string;
  reference: string;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  journal_entry_id: string;
  journal_type: string;
  account_name: string;
  department_id: string | null;
  division_label: string | null;
}

interface AccountSummary {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  transactions: LedgerTransaction[];
}

// Helper to format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Date presets
const getDatePreset = (preset: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  switch (preset) {
    case 'this-month':
      return {
        from: formatLocalDate(new Date(year, month, 1)),
        to: formatLocalDate(new Date(year, month + 1, 0)),
      };
    case 'last-month':
      return {
        from: formatLocalDate(new Date(year, month - 1, 1)),
        to: formatLocalDate(new Date(year, month, 0)),
      };
    case 'this-quarter':
      const q = Math.floor(month / 3);
      return {
        from: formatLocalDate(new Date(year, q * 3, 1)),
        to: formatLocalDate(new Date(year, q * 3 + 3, 0)),
      };
    case 'this-year':
      return {
        from: formatLocalDate(new Date(year, 0, 1)),
        to: formatLocalDate(new Date(year, 11, 31)),
      };
    case 'last-year':
      return {
        from: formatLocalDate(new Date(year - 1, 0, 1)),
        to: formatLocalDate(new Date(year - 1, 11, 31)),
      };
    default:
      return {
        from: formatLocalDate(new Date(year, month, 1)),
        to: formatLocalDate(new Date(year, month + 1, 0)),
      };
  }
};

export default function GeneralLedger() {
  const [datePreset, setDatePreset] = useState('this-month');
  const [dateFrom, setDateFrom] = useState(() => getDatePreset('this-month').from);
  const [dateTo, setDateTo] = useState(() => getDatePreset('this-month').to);
  const [reportBasis, setReportBasis] = useState('accrual');
  const [sortField, setSortField] = useState<'date' | 'account'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(organization?.id);
  const { data: departments = [] } = useDepartments();
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const deptMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of (departments as any[])) m.set(d.id, `${d.code ?? ''} ${d.name ?? ''}`.trim());
    return m;
  }, [departments]);

  // Handle preset change
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const dates = getDatePreset(preset);
      setDateFrom(dates.from);
      setDateTo(dates.to);
    }
  };

  // Fetch ledger data with GAAP-compliant opening balance calculation
  const { data: ledgerData = [], isLoading: ledgerLoading, refetch } = useQuery({
    queryKey: ['general-ledger', organization?.id, dateFrom, dateTo, divisionIds.slice().sort().join(',')],
    queryFn: async () => {
      if (!organization?.id) return [];

      // Get ALL posted journal entries with lines (we need to calculate opening balances)
      const { data: allLines, error: allLinesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          account_id,
          debit,
          credit,
          base_currency_debit,
          base_currency_credit,
          description,
          department_id,
          journal_entry:journal_entries!inner(
            id,
            entry_date,
            reference,
            description,
            status,
            journal_type,
            department_id
          )
        `)
        .eq('journal_entry.organization_id', organization.id)
        .eq('journal_entry.status', 'posted');

      if (allLinesError) throw allLinesError;

      const allowedDivs = divisionIds.length > 0 ? new Set(divisionIds) : null;

      // Build account summaries with GAAP-compliant balances
      const accountSummaries: Record<string, AccountSummary> = {};

      // Initialize all accounts
      for (const account of accounts) {
        if (account.is_header) continue;
        accountSummaries[account.id] = {
          account_id: account.id,
          account_code: account.code,
          account_name: account.name,
          account_type: account.account_type,
          normal_balance: account.normal_balance,
          opening_balance: allowedDivs ? 0 : (account.opening_balance || 0), // Will be recalculated; static OB excluded when filtering by division
          total_debit: 0,
          total_credit: 0,
          closing_balance: 0, // Will be calculated
          transactions: [],
        };
      }

      // Process all transactions to calculate opening balances and period activity
      for (const line of allLines || []) {
        const accountId = line.account_id;
        const account = accounts.find(a => a.id === accountId);
        if (!account || account.is_header) continue;
        if (!accountSummaries[accountId]) continue;

        const je = line.journal_entry as any;
        const entryDate = je.entry_date;
        const debit = Number((line as any).base_currency_debit ?? line.debit) || 0;
        const credit = Number((line as any).base_currency_credit ?? line.credit) || 0;

        // Effective division = line override or JE header
        const effDept: string | null = (line as any).department_id ?? je.department_id ?? null;
        if (allowedDivs && (!effDept || !allowedDivs.has(effDept))) continue;
        const divisionLabel = effDept ? (deptMap.get(effDept) ?? null) : null;

        // Calculate balance change based on normal balance
        let balanceChange = 0;
        if (account.normal_balance === 'debit') {
          balanceChange = debit - credit;
        } else {
          balanceChange = credit - debit;
        }

        // Transactions BEFORE the period start date contribute to opening balance
        if (entryDate < dateFrom) {
          accountSummaries[accountId].opening_balance += balanceChange;
        }
        // Transactions WITHIN the period are tracked separately
        else if (entryDate >= dateFrom && entryDate <= dateTo) {
          accountSummaries[accountId].total_debit += debit;
          accountSummaries[accountId].total_credit += credit;

          accountSummaries[accountId].transactions.push({
            id: line.id,
            entry_date: je.entry_date,
            reference: je.reference,
            description: line.description || je.description,
            debit,
            credit,
            running_balance: 0, // Will be recalculated
            journal_entry_id: je.id,
            journal_type: je.journal_type || 'manual',
            account_name: account.name,
            department_id: effDept,
            division_label: divisionLabel,
          });
        }
      }

      // Calculate closing balances and running balances per GAAP
      // Closing Balance = Opening Balance + Period Activity
      for (const accountId of Object.keys(accountSummaries)) {
        const summary = accountSummaries[accountId];
        const account = accounts.find(a => a.id === accountId);
        if (!account) continue;

        // Add the original opening balance from the account record
        summary.opening_balance += (account.opening_balance || 0);

        // Sort transactions by date for proper running balance
        summary.transactions.sort((a, b) => 
          parseLocalDate(a.entry_date).getTime() - parseLocalDate(b.entry_date).getTime()
        );

        // Calculate running balance starting from opening balance
        let runningBalance = summary.opening_balance;
        for (const txn of summary.transactions) {
          if (account.normal_balance === 'debit') {
            runningBalance += txn.debit - txn.credit;
          } else {
            runningBalance += txn.credit - txn.debit;
          }
          txn.running_balance = runningBalance;
        }

        // Closing balance = opening + net change per normal balance rules
        if (account.normal_balance === 'debit') {
          summary.closing_balance = summary.opening_balance + summary.total_debit - summary.total_credit;
        } else {
          summary.closing_balance = summary.opening_balance + summary.total_credit - summary.total_debit;
        }
      }

      return Object.values(accountSummaries).sort((a, b) => a.account_code.localeCompare(b.account_code));
    },
    enabled: !!organization?.id && accounts.length > 0,
  });

  const { formatWithSymbol: formatCurrency } = useCurrencyFormatter();

  const formatDateDisplay = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  // Filter and sort data
  const sortedData = useMemo(() => {
    // Filter out zero balances if toggle is off
    let filtered = showZeroBalances 
      ? [...ledgerData]
      : ledgerData.filter(account => 
          account.total_debit !== 0 || 
          account.total_credit !== 0 || 
          account.opening_balance !== 0 ||
          account.closing_balance !== 0
        );

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'account':
          comparison = a.account_name.localeCompare(b.account_name);
          break;
        case 'date':
        default:
          comparison = a.account_code.localeCompare(b.account_code);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [ledgerData, sortField, sortDirection, showZeroBalances]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return sortedData.reduce(
      (acc, account) => ({
        debit: acc.debit + account.total_debit,
        credit: acc.credit + account.total_credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [sortedData]);

  // Export to Excel with detailed ledger and proper number formatting
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Detailed ledger sheet with all transactions
    const detailedData: any[] = [];
    sortedData.forEach(account => {
      // Add account header row
      detailedData.push({
        'Account': account.account_name,
        'Date': '',
        'Transaction Details': '',
        'Transaction Type': '',
        'Transaction#': '',
        'Reference#': '',
        'Debit': '',
        'Credit': '',
        'Amount': '',
      });
      
      // Opening balance - use numbers, not formatted strings
      detailedData.push({
        'Account': '',
        'Date': `As On ${formatDateDisplay(dateFrom)}`,
        'Transaction Details': 'Opening Balance',
        'Transaction Type': '',
        'Transaction#': '',
        'Reference#': '',
        'Debit': account.normal_balance === 'debit' && account.opening_balance > 0 ? account.opening_balance : '',
        'Credit': account.normal_balance === 'credit' && account.opening_balance > 0 ? account.opening_balance : '',
        'Amount': account.opening_balance,
      });
      
      // Transactions - use raw numbers for proper Excel formatting
      account.transactions.forEach(txn => {
        detailedData.push({
          'Account': '',
          'Date': formatDateDisplay(txn.entry_date),
          'Transaction Details': txn.division_label || txn.description || '',
          'Transaction Type': txn.journal_type || 'Journal',
          'Transaction#': txn.reference,
          'Reference#': '',
          'Debit': txn.debit > 0 ? txn.debit : '',
          'Credit': txn.credit > 0 ? txn.credit : '',
          'Amount': txn.running_balance,
        });
      });
      
      // Closing balance
      detailedData.push({
        'Account': '',
        'Date': `As On ${formatDateDisplay(dateTo)}`,
        'Transaction Details': 'Closing Balance',
        'Transaction Type': '',
        'Transaction#': '',
        'Reference#': '',
        'Debit': account.normal_balance === 'debit' && account.closing_balance > 0 ? account.closing_balance : '',
        'Credit': account.normal_balance === 'credit' && account.closing_balance > 0 ? account.closing_balance : '',
        'Amount': account.closing_balance,
      });
      
      // Empty row between accounts
      detailedData.push({});
    });
    
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
    
    // Apply number format to Debit, Credit, Amount columns
    const range = XLSX.utils.decode_range(detailedSheet['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; R++) {
      // Debit is column 6 (G), Credit is column 7 (H), Amount is column 8 (I)
      ['G', 'H', 'I'].forEach(col => {
        const cellAddress = `${col}${R + 1}`;
        const cell = detailedSheet[cellAddress];
        if (cell && typeof cell.v === 'number') {
          cell.z = '#,##0.00';
        }
      });
    }
    
    // Set column widths
    detailedSheet['!cols'] = [
      { wch: 30 }, // Account
      { wch: 15 }, // Date
      { wch: 35 }, // Transaction Details
      { wch: 15 }, // Transaction Type
      { wch: 15 }, // Transaction#
      { wch: 12 }, // Reference#
      { wch: 15 }, // Debit
      { wch: 15 }, // Credit
      { wch: 15 }, // Amount
    ];
    
    XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed General Ledger');
    
    XLSX.writeFile(workbook, `Detailed_General_Ledger_${dateFrom}_to_${dateTo}.xlsx`, {
      cellStyles: true,
    });
    toast.success('Exported to Excel');
  };

  // Export to PDF with detailed ledger
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;
    
    // Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(organization?.name?.toUpperCase() || 'ORGANIZATION', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Detailed General Ledger', pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Basis: ${reportBasis.charAt(0).toUpperCase() + reportBasis.slice(1)}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`From ${formatDateDisplay(dateFrom)} To ${formatDateDisplay(dateTo)}`, pageWidth / 2, y, { align: 'center' });
    y += 12;
    
    // Column definitions
    const cols = {
      date: { x: 15, width: 30 },
      account: { x: 45, width: 45 },
      details: { x: 90, width: 50 },
      type: { x: 140, width: 35 },
      txnNum: { x: 175, width: 30 },
      refNum: { x: 205, width: 25 },
      debit: { x: 230, width: 25 },
      credit: { x: 255, width: 25 },
      amount: { x: 280, width: 25 },
    };
    
    const drawHeader = () => {
      doc.setFillColor(245, 245, 245);
      doc.rect(15, y - 4, pageWidth - 30, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text('DATE', cols.date.x, y);
      doc.text('ACCOUNT', cols.account.x, y);
      doc.text('TRANSACTION DETAILS', cols.details.x, y);
      doc.text('TRANSACTION TYPE', cols.type.x, y);
      doc.text('TRANSACTION#', cols.txnNum.x, y);
      doc.text('REFERENCE#', cols.refNum.x, y);
      doc.text('DEBIT', cols.debit.x + cols.debit.width, y, { align: 'right' });
      doc.text('CREDIT', cols.credit.x + cols.credit.width, y, { align: 'right' });
      doc.text('AMOUNT', cols.amount.x + cols.amount.width, y, { align: 'right' });
      doc.setTextColor(0);
      y += 8;
    };
    
    drawHeader();
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    sortedData.forEach((account) => {
      // Check if we need a new page
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
        drawHeader();
      }
      
      // Account name row (bold header)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(account.account_name, 15, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      // Opening Balance row
      doc.text(`As On ${formatDateDisplay(dateFrom)}`, cols.date.x + 10, y);
      doc.setTextColor(66, 133, 244);
      doc.text('Opening Balance', cols.account.x, y);
      doc.setTextColor(0);
      const openingAmount = formatCurrency(account.opening_balance);
      if (account.normal_balance === 'debit') {
        doc.text(openingAmount, cols.debit.x + cols.debit.width, y, { align: 'right' });
      } else {
        doc.text(openingAmount, cols.credit.x + cols.credit.width, y, { align: 'right' });
      }
      y += 5;
      
      // Transactions
      account.transactions.forEach(txn => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
          drawHeader();
        }
        
        doc.text(formatDateDisplay(txn.entry_date), cols.date.x + 10, y);
        doc.text((txn.description || '').slice(0, 25), cols.account.x, y);
        doc.text((txn.journal_type || 'Journal').slice(0, 15), cols.type.x, y);
        doc.text(txn.reference.slice(0, 12), cols.txnNum.x, y);
        doc.text(txn.debit > 0 ? formatCurrency(txn.debit) : '', cols.debit.x + cols.debit.width, y, { align: 'right' });
        doc.text(txn.credit > 0 ? formatCurrency(txn.credit) : '', cols.credit.x + cols.credit.width, y, { align: 'right' });
        doc.text(formatCurrency(txn.running_balance), cols.amount.x + cols.amount.width, y, { align: 'right' });
        y += 5;
      });
      
      // Closing Balance row
      doc.text(`As On ${formatDateDisplay(dateTo)}`, cols.date.x + 10, y);
      doc.setTextColor(66, 133, 244);
      doc.text('Closing Balance', cols.account.x, y);
      doc.setTextColor(0);
      const closingAmount = formatCurrency(account.closing_balance);
      if (account.normal_balance === 'debit') {
        doc.text(closingAmount, cols.debit.x + cols.debit.width, y, { align: 'right' });
      } else {
        doc.text(closingAmount, cols.credit.x + cols.credit.width, y, { align: 'right' });
      }
      y += 10;
    });
    
    doc.save(`Detailed_General_Ledger_${dateFrom}_to_${dateTo}.pdf`);
    toast.success('Exported to PDF');
  };

  // Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window');
      return;
    }
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Detailed General Ledger - ${organization?.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; }
          .org-name { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
          h1 { margin: 5px 0; font-size: 18px; font-weight: 600; }
          .basis { color: #666; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { 
            background-color: #f5f5f5; 
            padding: 8px 4px; 
            text-align: left; 
            border-bottom: 1px solid #ddd; 
            font-size: 9px; 
            color: #666;
            text-transform: uppercase;
          }
          th.right { text-align: right; }
          td { padding: 5px 4px; border-bottom: 1px solid #f0f0f0; }
          td.right { text-align: right; font-family: monospace; }
          .account-header { 
            font-weight: 600; 
            font-size: 12px;
            padding-top: 15px;
            border-bottom: none;
          }
          .balance-row td { color: #4285f4; }
          .closing-row { border-bottom: 2px solid #e0e0e0; }
          .date-col { color: #666; padding-left: 20px; }
          @media print { 
            body { margin: 10px; }
            .account-header { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="org-name">${organization?.name?.toUpperCase()}</div>
          <h1>Detailed General Ledger</h1>
          <div class="basis">Basis: ${reportBasis.charAt(0).toUpperCase() + reportBasis.slice(1)}</div>
          <div class="basis">From ${formatDateDisplay(dateFrom)} To ${formatDateDisplay(dateTo)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">DATE</th>
              <th style="width: 18%;">ACCOUNT</th>
              <th style="width: 18%;">TRANSACTION DETAILS</th>
              <th style="width: 12%;">TRANSACTION TYPE</th>
              <th style="width: 10%;">TRANSACTION#</th>
              <th style="width: 8%;">REFERENCE#</th>
              <th class="right" style="width: 8%;">DEBIT</th>
              <th class="right" style="width: 8%;">CREDIT</th>
              <th class="right" style="width: 8%;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${sortedData.map(account => `
              <tr>
                <td colspan="9" class="account-header">${account.account_name}</td>
              </tr>
              <tr class="balance-row">
                <td class="date-col">As On ${formatDateDisplay(dateFrom)}</td>
                <td>Opening Balance</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td class="right">${account.normal_balance === 'debit' ? formatCurrency(account.opening_balance) : ''}</td>
                <td class="right">${account.normal_balance === 'credit' ? formatCurrency(account.opening_balance) : ''}</td>
                <td class="right">${formatCurrency(account.opening_balance)}</td>
              </tr>
              ${account.transactions.map(txn => `
                <tr>
                  <td class="date-col">${formatDateDisplay(txn.entry_date)}</td>
                  <td>${txn.description || ''}</td>
                  <td></td>
                  <td>${txn.journal_type || 'Journal'}</td>
                  <td>${txn.reference}</td>
                  <td></td>
                  <td class="right">${txn.debit > 0 ? formatCurrency(txn.debit) : ''}</td>
                  <td class="right">${txn.credit > 0 ? formatCurrency(txn.credit) : ''}</td>
                  <td class="right">${formatCurrency(txn.running_balance)}</td>
                </tr>
              `).join('')}
              <tr class="balance-row closing-row">
                <td class="date-col">As On ${formatDateDisplay(dateTo)}</td>
                <td>Closing Balance</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td class="right">${account.normal_balance === 'debit' ? formatCurrency(account.closing_balance) : ''}</td>
                <td class="right">${account.normal_balance === 'credit' ? formatCurrency(account.closing_balance) : ''}</td>
                <td class="right">${formatCurrency(account.closing_balance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const isLoading = orgLoading || accountsLoading || ledgerLoading;

  // No organization state
  if (!orgLoading && !organization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detailed General Ledger</h1>
            <p className="text-muted-foreground">View account activity and balances</p>
          </div>
        </div>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Organization Found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-1">
                Create an organization to view the general ledger.
              </p>
            </div>
            <Button onClick={() => setCreateOrgDialogOpen(true)}>
              Create Organization
            </Button>
          </div>
        </Card>

        <CreateOrganizationDialog
          open={createOrgDialogOpen}
          onOpenChange={setCreateOrgDialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar - Zoho Style */}
      <Card className="p-4 bg-muted/30">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Date Range:</span>
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-quarter">This Quarter</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40 bg-background"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40 bg-background"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Report Basis:</span>
            <Select value={reportBasis} onValueChange={setReportBasis}>
              <SelectTrigger className="w-32 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accrual">Accrual</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DivisionFilter value={divisionIds} onChange={setDivisionIds} />

          <Button onClick={() => refetch()} className="bg-primary hover:bg-primary/90">
            Run Report
          </Button>

          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-2">
              <Switch
                id="show-zero-balances"
                checked={showZeroBalances}
                onCheckedChange={setShowZeroBalances}
              />
              <Label htmlFor="show-zero-balances" className="text-sm text-muted-foreground cursor-pointer">
                Show Zero Balances
              </Label>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      <Card className="overflow-hidden">
        {/* Report Header - Zoho Style */}
        <div className="text-center py-8 border-b border-border">
          <p className="text-sm text-muted-foreground uppercase tracking-widest">
            {organization?.name}
          </p>
          <h2 className="text-xl font-semibold text-foreground mt-2">Detailed General Ledger</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Basis: <span className="capitalize">{reportBasis}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            From {formatDateDisplay(dateFrom)} To {formatDateDisplay(dateTo)}
          </p>
        </div>

        {/* Detailed Ledger Table - Zoho Style */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                  <TableHead 
                    className="cursor-pointer select-none w-[120px]"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground font-semibold">
                      DATE
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none w-[180px]"
                    onClick={() => handleSort('account')}
                  >
                    <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground font-semibold">
                      ACCOUNT
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[160px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">TRANSACTION DETAILS</span>
                  </TableHead>
                  <TableHead className="w-[130px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">TRANSACTION TYPE</span>
                  </TableHead>
                  <TableHead className="w-[110px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">TRANSACTION#</span>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">REFERENCE#</span>
                  </TableHead>
                  <TableHead className="text-right w-[100px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">DEBIT</span>
                  </TableHead>
                  <TableHead className="text-right w-[100px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">CREDIT</span>
                  </TableHead>
                  <TableHead className="text-right w-[110px]">
                    <span className="text-xs uppercase text-muted-foreground font-semibold">AMOUNT</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No ledger activity for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((account) => (
                    <React.Fragment key={account.account_id}>
                      {/* Account Header Row */}
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableCell colSpan={9} className="py-4 pb-2">
                          <span className="font-semibold text-foreground">{account.account_code} - {account.account_name}</span>
                        </TableCell>
                      </TableRow>
                      
                      {/* Opening Balance Row */}
                      <TableRow className="hover:bg-muted/20 border-b-0">
                        <TableCell className="py-2 pl-8 text-muted-foreground">
                          As On {formatDateDisplay(dateFrom)}
                        </TableCell>
                        <TableCell className="py-2 text-primary font-medium">
                          Opening Balance
                        </TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2 text-right font-mono">
                          {account.normal_balance === 'debit' && account.opening_balance !== 0 
                            ? formatCurrency(account.opening_balance) 
                            : ''}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono">
                          {account.normal_balance === 'credit' && account.opening_balance !== 0 
                            ? formatCurrency(account.opening_balance) 
                            : ''}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono font-medium">
                          {formatCurrency(account.opening_balance)}
                        </TableCell>
                      </TableRow>

                      {/* Transaction Rows */}
                      {account.transactions.map((txn) => (
                        <TableRow key={txn.id} className="hover:bg-muted/20 border-b-0">
                          <TableCell className="py-2 pl-8 text-muted-foreground">
                            {formatDateDisplay(txn.entry_date)}
                          </TableCell>
                          <TableCell className="py-2">
                            {txn.description || '—'}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">
                            {txn.division_label || ''}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">
                            {txn.journal_type || 'Journal'}
                          </TableCell>
                          <TableCell className="py-2 text-primary">
                            {txn.reference}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">
                            {/* Reference# */}
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono">
                            {txn.debit > 0 ? formatCurrency(txn.debit) : ''}
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono">
                            {txn.credit > 0 ? formatCurrency(txn.credit) : ''}
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono font-medium">
                            {formatCurrency(txn.running_balance)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Closing Balance Row */}
                      <TableRow className="hover:bg-muted/20 border-b">
                        <TableCell className="py-2 pl-8 text-muted-foreground">
                          As On {formatDateDisplay(dateTo)}
                        </TableCell>
                        <TableCell className="py-2 text-primary font-medium">
                          Closing Balance
                        </TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2 text-right font-mono">
                          {account.normal_balance === 'debit' && account.closing_balance !== 0 
                            ? formatCurrency(account.closing_balance) 
                            : ''}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono">
                          {account.normal_balance === 'credit' && account.closing_balance !== 0 
                            ? formatCurrency(account.closing_balance) 
                            : ''}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono font-medium">
                          {formatCurrency(account.closing_balance)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Totals Footer */}
        {!isLoading && sortedData.length > 0 && (
          <div className="border-t border-border bg-muted/30 p-4">
            <div className="flex justify-end gap-12">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase mb-1">Total Debits</p>
                <p className="font-mono font-semibold text-lg">{formatCurrency(totals.debit)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase mb-1">Total Credits</p>
                <p className="font-mono font-semibold text-lg">{formatCurrency(totals.credit)}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
      />
    </div>
  );
}
