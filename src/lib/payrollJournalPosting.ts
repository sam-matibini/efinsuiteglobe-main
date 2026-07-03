import { supabase } from "@/integrations/supabase/client";
import { createJournalEntry, JournalEntryLine } from "@/hooks/useJournalEntryCreation";

interface PayRunTotals {
  totalGross: number;
  totalCpp: number;
  totalEi: number;
  totalFederalTax: number;
  totalProvincialTax: number;
  totalOtherDeductions: number;
  totalNet: number;
  totalEmployerCpp: number;
  totalEmployerEi: number;
}

interface PayrollAccount {
  id: string;
  code: string;
  name: string;
}

type PayrollAccounts = {
  salariesExpense?: PayrollAccount;
  employerCppExpense?: PayrollAccount;
  employerEiExpense?: PayrollAccount;
  wagesPayable?: PayrollAccount;
  cppPayable?: PayrollAccount;
  eiPayable?: PayrollAccount;
  incomeTaxPayable?: PayrollAccount;
  cash?: PayrollAccount;
};

/**
 * Finds standard payroll GL accounts for an organization.
 */
async function findPayrollAccounts(organizationId: string): Promise<PayrollAccounts> {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, account_type, is_header, posting_allowed")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (!accounts) return {};

  // Filter to only postable accounts (not headers)
  const postableAccounts = accounts.filter(a => !a.is_header && a.posting_allowed !== false);

  const find = (
    patterns: { codePrefixes?: string[]; namePatterns?: string[]; accountTypes?: string[]; preferredNames?: string[] }
  ): PayrollAccount | undefined => {
    const { codePrefixes = [], namePatterns = [], accountTypes, preferredNames = [] } = patterns;
    
    // Filter by account type first
    const candidates = accountTypes 
      ? postableAccounts.filter(a => accountTypes.includes(a.account_type))
      : postableAccounts;

    // Strategy 1: code prefix + preferred name (most precise)
    for (const prefix of codePrefixes) {
      for (const pn of preferredNames) {
        const match = candidates.find(a => 
          a.code.startsWith(prefix) && a.name.toLowerCase().includes(pn.toLowerCase())
        );
        if (match) return { id: match.id, code: match.code, name: match.name };
      }
    }

    // Strategy 2: code prefix + any name pattern
    for (const prefix of codePrefixes) {
      for (const np of namePatterns) {
        const match = candidates.find(a => 
          a.code.startsWith(prefix) && a.name.toLowerCase().includes(np.toLowerCase())
        );
        if (match) return { id: match.id, code: match.code, name: match.name };
      }
    }

    // Strategy 3: name pattern only (fallback)
    for (const np of [...preferredNames, ...namePatterns]) {
      const match = candidates.find(a => a.name.toLowerCase().includes(np.toLowerCase()));
      if (match) return { id: match.id, code: match.code, name: match.name };
    }
    
    // Strategy 4: code prefix only (last resort)
    for (const prefix of codePrefixes) {
      const match = candidates.find(a => a.code.startsWith(prefix));
      if (match) return { id: match.id, code: match.code, name: match.name };
    }

    return undefined;
  };

  return {
    salariesExpense: find({
      codePrefixes: ["6-01-101", "6-01-100-0001"],
      preferredNames: ["salaries & wages", "salaries and wages"],
      namePatterns: ["salaries", "wages expense"],
      accountTypes: ["expense"],
    }),
    employerCppExpense: find({
      codePrefixes: ["6-01-103", "6-01-100-0002"],
      preferredNames: ["employer cpp", "employer's cpp", "employer contributions"],
      namePatterns: ["cpp/ei expense", "cpp expense"],
      accountTypes: ["expense"],
    }),
    employerEiExpense: find({
      codePrefixes: ["6-01-104", "6-01-100-0002"],
      preferredNames: ["employer ei", "employer's ei"],
      namePatterns: ["cpp/ei expense", "ei expense", "employer contributions"],
      accountTypes: ["expense"],
    }),
    wagesPayable: find({
      codePrefixes: ["2-01-103-0001"],
      preferredNames: ["wages payable", "salaries payable"],
      namePatterns: ["wages payable"],
      accountTypes: ["liability"],
    }),
    cppPayable: find({
      codePrefixes: ["2-01-103-0002", "2-01-130-0001"],
      preferredNames: ["cpp payable", "payroll liabilities - cpp"],
      namePatterns: ["cpp payable", "cpp liabilities"],
      accountTypes: ["liability"],
    }),
    eiPayable: find({
      codePrefixes: ["2-01-103-0003", "2-01-130-0002"],
      preferredNames: ["ei payable", "payroll liabilities - ei"],
      namePatterns: ["ei payable", "ei liabilities"],
      accountTypes: ["liability"],
    }),
    incomeTaxPayable: find({
      codePrefixes: ["2-01-103-0004", "2-01-130-0003"],
      preferredNames: ["employee income tax payable", "payroll liabilities - income tax"],
      namePatterns: ["income tax payable", "tax payable"],
      accountTypes: ["liability"],
    }),
    cash: find({
      codePrefixes: ["1-01-101-0001", "1-01-100-0001"],
      preferredNames: ["operating bank"],
      namePatterns: ["chequing", "cash", "bank account"],
      accountTypes: ["asset"],
    }),
  };
}

/**
 * Helper functions for integer cents arithmetic to prevent floating-point drift
 */
const toCents = (n: number): number => Math.round(n * 100);
const fromCents = (n: number): number => n / 100;

/**
 * Aggregate totals from pay stubs for a given pay run.
 * Uses integer cents arithmetic internally to prevent floating-point errors.
 */
async function getPayRunTotals(payRunId: string): Promise<PayRunTotals> {
  const { data: stubs } = await supabase
    .from("pay_stubs")
    .select("gross_pay, cpp_contribution, ei_premium, federal_tax, provincial_tax, other_deductions, net_pay, cpp_employer, ei_employer")
    .eq("pay_run_id", payRunId);

  if (!stubs || stubs.length === 0) {
    return {
      totalGross: 0,
      totalCpp: 0,
      totalEi: 0,
      totalFederalTax: 0,
      totalProvincialTax: 0,
      totalOtherDeductions: 0,
      totalNet: 0,
      totalEmployerCpp: 0,
      totalEmployerEi: 0,
    };
  }

  // Use integer cents to prevent floating-point errors during aggregation
  const totalsInCents = stubs.reduce(
    (acc, s) => {
      acc.totalGrossCents += toCents(s.gross_pay || 0);
      acc.totalCppCents += toCents(s.cpp_contribution || 0);
      acc.totalEiCents += toCents(s.ei_premium || 0);
      acc.totalFederalTaxCents += toCents(s.federal_tax || 0);
      acc.totalProvincialTaxCents += toCents(s.provincial_tax || 0);
      acc.totalOtherDeductionsCents += toCents(s.other_deductions || 0);
      acc.totalNetCents += toCents(s.net_pay || 0);
      acc.totalEmployerCppCents += toCents(s.cpp_employer || 0);
      acc.totalEmployerEiCents += toCents(s.ei_employer || 0);
      return acc;
    },
    {
      totalGrossCents: 0,
      totalCppCents: 0,
      totalEiCents: 0,
      totalFederalTaxCents: 0,
      totalProvincialTaxCents: 0,
      totalOtherDeductionsCents: 0,
      totalNetCents: 0,
      totalEmployerCppCents: 0,
      totalEmployerEiCents: 0,
    }
  );

  // Convert back to dollars
  return {
    totalGross: fromCents(totalsInCents.totalGrossCents),
    totalCpp: fromCents(totalsInCents.totalCppCents),
    totalEi: fromCents(totalsInCents.totalEiCents),
    totalFederalTax: fromCents(totalsInCents.totalFederalTaxCents),
    totalProvincialTax: fromCents(totalsInCents.totalProvincialTaxCents),
    totalOtherDeductions: fromCents(totalsInCents.totalOtherDeductionsCents),
    totalNet: fromCents(totalsInCents.totalNetCents),
    totalEmployerCpp: fromCents(totalsInCents.totalEmployerCppCents),
    totalEmployerEi: fromCents(totalsInCents.totalEmployerEiCents),
  };
}

/**
 * Posts payroll journal entries when a pay run is marked as "paid".
 *
 * Entries created:
 * 1. Salaries & Wages Expense (DR) – Gross Pay
 * 2. Employer CPP Expense (DR) – Employer CPP
 * 3. Employer EI Expense (DR) – Employer EI
 * 4. CPP Payable (CR) – Employee CPP + Employer CPP
 * 5. EI Payable (CR) – Employee EI + Employer EI
 * 6. Income Tax Payable (CR) – Federal + Provincial Tax
 * 7. Wages Payable (CR) – Net Pay (or Cash if paying immediately)
 *
 * If organizationId is provided and a Cash account is found, a second entry
 * clears Wages Payable (DR) to Cash (CR) for the net pay.
 */
export async function postPayrollJournalEntries(
  payRunId: string,
  organizationId: string,
  payRunReference: string,
  payDate: string
): Promise<{ accrualEntryId: string; paymentEntryId?: string } | null> {
  // Guard: check if this pay run already has a journal entry
  const { data: existingRun } = await supabase
    .from("pay_runs")
    .select("journal_entry_id")
    .eq("id", payRunId)
    .maybeSingle();

  if (existingRun?.journal_entry_id) {
    console.info(`Pay run ${payRunId} already has journal entry ${existingRun.journal_entry_id}, skipping.`);
    return { accrualEntryId: existingRun.journal_entry_id };
  }

  // Check for existing JE with same reference to avoid unique constraint violation
  const accrualRef = `PAY-${payRunReference}`;
  const { data: existingJE } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("reference", accrualRef)
    .maybeSingle();

  if (existingJE) {
    // Link the existing JE to this pay run and return
    await supabase
      .from("pay_runs")
      .update({ journal_entry_id: existingJE.id } as any)
      .eq("id", payRunId);
    console.info(`Found existing JE with ref ${accrualRef}, linked to pay run.`);
    return { accrualEntryId: existingJE.id };
  }

  const accounts = await findPayrollAccounts(organizationId);
  const totals = await getPayRunTotals(payRunId);

  // Validate we have minimum required accounts
  if (!accounts.salariesExpense) {
    console.warn("Missing Salaries & Wages Expense account - cannot post payroll JE");
    return null;
  }

  // Build accrual entry lines with source document tracking
  const accrualLines: JournalEntryLine[] = [];
  const baseDimensions = {
    source_document_type: 'pay_run',
    source_document_id: payRunId,
  };

  // DR Salaries Expense
  if (totals.totalGross > 0 && accounts.salariesExpense) {
    accrualLines.push({
      account_id: accounts.salariesExpense.id,
      debit: totals.totalGross,
      credit: 0,
      memo: "Gross wages",
      ...baseDimensions,
    });
  }

  // DR Employer CPP Expense
  if (totals.totalEmployerCpp > 0 && accounts.employerCppExpense) {
    accrualLines.push({
      account_id: accounts.employerCppExpense.id,
      debit: totals.totalEmployerCpp,
      credit: 0,
      memo: "Employer CPP contribution",
      ...baseDimensions,
    });
  }

  // DR Employer EI Expense
  if (totals.totalEmployerEi > 0 && accounts.employerEiExpense) {
    accrualLines.push({
      account_id: accounts.employerEiExpense.id,
      debit: totals.totalEmployerEi,
      credit: 0,
      memo: "Employer EI contribution",
      ...baseDimensions,
    });
  }

  // CR CPP Payable (employee + employer)
  const totalCppPayable = totals.totalCpp + totals.totalEmployerCpp;
  if (totalCppPayable > 0 && accounts.cppPayable) {
    accrualLines.push({
      account_id: accounts.cppPayable.id,
      debit: 0,
      credit: totalCppPayable,
      memo: "CPP deductions payable",
      ...baseDimensions,
    });
  }

  // CR EI Payable (employee + employer)
  const totalEiPayable = totals.totalEi + totals.totalEmployerEi;
  if (totalEiPayable > 0 && accounts.eiPayable) {
    accrualLines.push({
      account_id: accounts.eiPayable.id,
      debit: 0,
      credit: totalEiPayable,
      memo: "EI deductions payable",
      ...baseDimensions,
    });
  }

  // CR Income Tax Payable
  const totalIncomeTax = totals.totalFederalTax + totals.totalProvincialTax;
  if (totalIncomeTax > 0 && accounts.incomeTaxPayable) {
    accrualLines.push({
      account_id: accounts.incomeTaxPayable.id,
      debit: 0,
      credit: totalIncomeTax,
      memo: "Employee income tax withheld",
      ...baseDimensions,
    });
  }

  // CR Wages Payable or Cash directly (net amount owed to employees)
  const netPayAccount = accounts.wagesPayable || accounts.cash;
  if (totals.totalNet > 0 && netPayAccount) {
    accrualLines.push({
      account_id: netPayAccount.id,
      debit: 0,
      credit: totals.totalNet,
      memo: accounts.wagesPayable ? "Net wages payable to employees" : "Net wages paid to employees",
      ...baseDimensions,
    });
  }

  // Verify the entry balances before posting - critical for double-entry integrity
  const totalDebits = accrualLines.reduce((sum, l) => sum + toCents(l.debit), 0);
  const totalCredits = accrualLines.reduce((sum, l) => sum + toCents(l.credit), 0);
  const imbalance = totalDebits - totalCredits;
  
  if (imbalance !== 0) {
    // Apply rounding adjustment to EI Payable (or last credit line) to force balance
    const adjustmentCents = Math.abs(imbalance);
    const eiPayableLine = accrualLines.find(l => l.account_id === accounts.eiPayable?.id);
    
    if (eiPayableLine && imbalance > 0) {
      // More debits than credits - increase a credit
      eiPayableLine.credit = fromCents(toCents(eiPayableLine.credit) + adjustmentCents);
      console.info(`Payroll JE: Applied ${adjustmentCents} cent rounding adjustment to EI Payable`);
    } else if (eiPayableLine && imbalance < 0) {
      // More credits than debits - decrease a credit
      eiPayableLine.credit = fromCents(toCents(eiPayableLine.credit) - adjustmentCents);
      console.info(`Payroll JE: Applied -${adjustmentCents} cent rounding adjustment to EI Payable`);
    } else {
      console.warn(`Payroll JE imbalance of ${imbalance} cents could not be auto-corrected`);
    }
  }

  if (accrualLines.length < 2) {
    console.warn("Insufficient payroll accounts to create journal entry");
    return null;
  }

  // Create the accrual journal entry
  const accrualEntryId = await createJournalEntry({
    organizationId,
    date: payDate,
    description: `Payroll - ${payRunReference}`,
    reference: `PAY-${payRunReference}`,
    journalType: 'payroll',
    lines: accrualLines,
    status: "posted",
  });

  // Create payment entry (Wages Payable -> Cash) if Cash account exists
  let paymentEntryId: string | undefined;
  if (totals.totalNet > 0 && accounts.wagesPayable && accounts.cash) {
    const paymentLines: JournalEntryLine[] = [
      {
        account_id: accounts.wagesPayable.id,
        debit: totals.totalNet,
        credit: 0,
        memo: "Clear wages payable",
        ...baseDimensions,
      },
      {
        account_id: accounts.cash.id,
        debit: 0,
        credit: totals.totalNet,
        memo: "Payment to employees",
        ...baseDimensions,
      },
    ];

    paymentEntryId = await createJournalEntry({
      organizationId,
      date: payDate,
      description: `Payroll Payment - ${payRunReference}`,
      reference: `PAY-PMT-${payRunReference}`,
      journalType: 'payroll',
      lines: paymentLines,
      status: "posted",
    });
  }

  // Link journal entries to the pay run (cast to bypass stale types)
  await supabase
    .from("pay_runs")
    .update({ journal_entry_id: accrualEntryId } as any)
    .eq("id", payRunId);

  return { accrualEntryId, paymentEntryId };
}
