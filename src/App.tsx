import { forwardRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminRoute } from "@/components/AdminRoute";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganizationContext";
import { ReportFiltersProvider } from "@/hooks/useReportFilters";
import Landing from "./pages/Landing";
import Security from "./pages/Security";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import E2EReportsHarness from "./pages/__E2EReportsHarness";
import Index from "./pages/Index";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import AccountGenerator from "./pages/AccountGenerator";
import GeneralLedger from "./pages/GeneralLedger";
import DetailedLedger from "./pages/DetailedLedger";
import JournalEntries from "./pages/JournalEntries";
import Divisions from "./pages/Divisions";
import AllocationRules from "./pages/AllocationRules";
import DivisionAccess from "./pages/DivisionAccess";
import TrialBalance from "./pages/TrialBalance";
import BalanceSheet from "./pages/BalanceSheet";
import IncomeStatement from "./pages/IncomeStatement";
import CashFlow from "./pages/CashFlow";
import ChangesInEquity from "./pages/ChangesInEquity";
import ReportsCentre from "./pages/ReportsCentre";
import Customers from "./pages/Customers";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import TreasuryDashboard from "./pages/treasury/TreasuryDashboard";
import TreasuryTaxPayments from "./pages/treasury/TaxPayments";
import TreasuryAPPayments from "./pages/treasury/APPayments";
import TreasuryBatchDetail from "./pages/treasury/PaymentBatchDetail";
import TreasurySettings from "./pages/treasury/TreasurySettings";
import TreasuryPayrollPayments from "./pages/treasury/PayrollPayments";
import TreasuryApprovals from "./pages/treasury/Approvals";
import BankingPaymentsDashboard from "./pages/treasury/BankingPaymentsDashboard";
import CraRemittanceCentre from "./pages/treasury/CraRemittanceCentre";
import CraAuditLog from "./pages/treasury/CraAuditLog";
import CraAccountsSettings from "./pages/treasury/CraAccountsSettings";
import ScheduledPayments from "./pages/treasury/ScheduledPayments";
import PaymentHistory from "./pages/treasury/PaymentHistory";
import PaymentLinks from "./pages/treasury/PaymentLinks";
import FintracReports from "./pages/treasury/FintracReports";
import RpaaCompliance from "./pages/treasury/RpaaCompliance";
import ReconciliationReview from "./pages/treasury/ReconciliationReview";
import BulkPayrollRemittance from "./pages/treasury/BulkPayrollRemittance";
import MultiBusinessRemittance from "./pages/treasury/MultiBusinessRemittance";
import ApprovalRules from "./pages/treasury/ApprovalRules";
import DelegatedAccess from "./pages/treasury/DelegatedAccess";
import ProvincialRemittanceCentre from "./pages/treasury/ProvincialRemittanceCentre";
import CraFilings from "./pages/treasury/CraFilings";
import EftRailSettings from "./pages/treasury/EftRailSettings";
import StripeConnectedAccounts from "./pages/treasury/StripeConnectedAccounts";
import StripeConnectedAccountDetail from "./pages/treasury/StripeConnectedAccountDetail";
import StripeConnectRouting from "./pages/treasury/StripeConnectRouting";
import StripeConnectCompliance from "./pages/treasury/StripeConnectCompliance";
import ComplianceExports from "./pages/treasury/ComplianceExports";
import CashFlowForecast from "./pages/treasury/CashFlowForecast";
import AnomalyInbox from "./pages/treasury/AnomalyInbox";
import PeriodClose from "./pages/treasury/PeriodClose";
import AuditorPortal from "./pages/treasury/AuditorPortal";
import VendorSlips from "./pages/treasury/VendorSlips";
import VendorTaxProfiles from "./pages/treasury/VendorTaxProfiles";
import UsRemittanceCentre from "./pages/treasury/UsRemittanceCentre";
import UsPaymentRailSettings from "./pages/treasury/UsPaymentRailSettings";
import TinMatchBatchResults from "./pages/treasury/TinMatchBatchResults";
import SignedFilingDashboard from "./pages/treasury/SignedFilingDashboard";
import ConsolidationDashboard from "./pages/treasury/ConsolidationDashboard";
import TreasuryJobsLog from "./pages/treasury/TreasuryJobsLog";
import TreasuryAlerts from "./pages/treasury/TreasuryAlerts";
import FirmClients from "./pages/firm/FirmClients";
import FirmCopilot from "./pages/firm/FirmCopilot";
import UkVatFilings from "./pages/intl/UkVatFilings";
import EuOssFilings from "./pages/intl/EuOssFilings";
import SepaRailSettings from "./pages/intl/SepaRailSettings";
import MarketplaceCatalog from "./pages/marketplace/MarketplaceCatalog";
import InstalledIntegrations from "./pages/marketplace/InstalledIntegrations";
import MobileTreasuryShell from "./pages/mobile/treasury/MobileTreasuryShell";
import MobileHome from "./pages/mobile/treasury/MobileHome";
import MobileAlerts from "./pages/mobile/treasury/MobileAlerts";
import MobileApprovals from "./pages/mobile/treasury/MobileApprovals";
import MobileCopilot from "./pages/mobile/treasury/MobileCopilot";
import PayLink from "./pages/public/PayLink";
import Vendors from "./pages/Vendors";
import Bills from "./pages/Bills";
import BankAccounts from "./pages/BankAccounts";
import BankTransactions from "./pages/BankTransactions";
import SettlementReconciliation from "./pages/SettlementReconciliation";
import TransactionRules from "./pages/TransactionRules";
import Reconciliation from "./pages/Reconciliation";
import ReconciliationHistory from "./pages/ReconciliationHistory";
import SalesTaxAudit from "./pages/SalesTaxAudit";
import CreditCards from "./pages/CreditCards";
import CreditCardTransactions from "./pages/CreditCardTransactions";
import CreditCardReconciliation from "./pages/CreditCardReconciliation";
import SalesTax from "./pages/SalesTax";
import TaxFilingPeriods from "./pages/TaxFilingPeriods";
import TaxFileReturn from "./pages/TaxFileReturn";
import TaxReconciliation from "./pages/TaxReconciliation";
import TaxExceptions from "./pages/TaxExceptions";
import TaxAuditTrail from "./pages/TaxAuditTrail";
import TaxSetupWizard from "./pages/TaxSetupWizard";
import TaxReportsAdvanced from "./pages/TaxReportsAdvanced";
import TaxEFile from "./pages/TaxEFile";
import AddressTax from "./pages/AddressTax";
import EuVat from "./pages/EuVat";
import TaxProvision from "./pages/TaxProvision";
import WithholdingTax from "./pages/WithholdingTax";
import Employees from "./pages/Employees";
import PayRuns from "./pages/PayRuns";
import PayrollReports from "./pages/PayrollReports";
import Remittances from "./pages/Remittances";
import TaxSlips from "./pages/TaxSlips";
import RoeRecords from "./pages/RoeRecords";
import EmployeeOnboarding from "./pages/payroll/EmployeeOnboarding";
import EmployeesList from "./pages/payroll/EmployeesList";
import EmployeeProfile from "./pages/payroll/EmployeeProfile";
import EmployeeTimesheets from "./pages/payroll/EmployeeTimesheets";
import TimesheetDetail from "./pages/payroll/TimesheetDetail";
import EmployeeSelfService from "./pages/payroll/EmployeeSelfService";
import Settings from "./pages/Settings";
import ExchangeRates from "./pages/ExchangeRates";
import CurrencyRevaluation from "./pages/CurrencyRevaluation";
import FxGainLossReport from "./pages/FxGainLossReport";
import MultiCurrencyTrialBalance from "./pages/MultiCurrencyTrialBalance";
import Inventory from "./pages/Inventory";
import FixedAssets from "./pages/FixedAssets";
import Leases from "./pages/Leases";
import ProductsServices from "./pages/ProductsServices";
import Quotes from "./pages/Quotes";
import CreditNotes from "./pages/CreditNotes";
import RecurringInvoices from "./pages/RecurringInvoices";
import RecurringBills from "./pages/RecurringBills";
import PurchaseOrders from "./pages/PurchaseOrders";
import VendorCredits from "./pages/VendorCredits";
import ExpenseClaims from "./pages/ExpenseClaims";
import Expenses from "./pages/Expenses";
import AgingReports from "./pages/AgingReports";
import AccountantDashboard from "./pages/AccountantDashboard";
import PracticeManagementDashboard from "./pages/practice/PracticeManagementDashboard";
import ManagementReport from "./pages/ManagementReport";
import DocSign from "./pages/DocSign";
import DocSignSign from "./pages/DocSignSign";
import CommunicationHub from "./pages/CommunicationHub";
import ConsolidatedStatements from "./pages/ConsolidatedStatements";
import Donations from "./pages/Donations";
import Budgets from "./pages/Budgets";
import BudgetDetail from "./pages/BudgetDetail";
import ProductionBudgets from "./pages/ProductionBudgets";
import BudgetVariance from "./pages/BudgetVariance";
import AIForecast from "./pages/AIForecast";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCommunications from "./pages/admin/AdminCommunications";
import OrganizationModulesPage from "./pages/admin/OrganizationModulesPage";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import AcceptInvite from "./pages/AcceptInvite";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SubscriptionCheckout from "./pages/SubscriptionCheckout";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import ClearCache from "./pages/ClearCache";
import LoanCalculatorPage from "./pages/toolkit/LoanCalculatorPage";

const queryClient = new QueryClient();

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

// Protected route wrapper
const ProtectedRoute = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!user) {
      return <Navigate to="/landing" replace />;
    }

    return (
      <div ref={ref} className="contents">
        {children}
      </div>
    );
  }
);
ProtectedRoute.displayName = "ProtectedRoute";

// Auth route wrapper (redirect to app if already logged in)
const AuthRoute = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (user) {
      return <Navigate to="/" replace />;
    }

    return (
      <div ref={ref} className="contents">
        {children}
      </div>
    );
  }
);
AuthRoute.displayName = "AuthRoute";

const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/landing" element={<Landing />} />
    <Route path="/install" element={<Install />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    <Route path="/terms-of-service" element={<TermsOfService />} />
    <Route path="/security" element={<Security />} />
    <Route path="/clear-cache" element={<ClearCache />} />
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
    <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/accept-invite" element={<AcceptInvite />} />

    {/* E2E-only harness route — registered when built/served with VITE_E2E=1. */}
    {import.meta.env.VITE_E2E === '1' && (
      <Route path="/__e2e__/income-statement" element={<E2EReportsHarness />} />
    )}


    {/* Protected app routes */}
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/toolkit/loan" element={<ProtectedRoute><LoanCalculatorPage /></ProtectedRoute>} />
    <Route path="/accounts" element={<ProtectedRoute><PageWrapper><ChartOfAccounts /></PageWrapper></ProtectedRoute>} />
    <Route path="/accounts/generator" element={<ProtectedRoute><PageWrapper><AccountGenerator /></PageWrapper></ProtectedRoute>} />
    <Route path="/journal-entries" element={<ProtectedRoute><PageWrapper><JournalEntries /></PageWrapper></ProtectedRoute>} />
    <Route path="/divisions" element={<ProtectedRoute><PageWrapper><Divisions /></PageWrapper></ProtectedRoute>} />
    <Route path="/divisions/allocations" element={<ProtectedRoute><PageWrapper><AllocationRules /></PageWrapper></ProtectedRoute>} />
    <Route path="/divisions/access" element={<ProtectedRoute><PageWrapper><DivisionAccess /></PageWrapper></ProtectedRoute>} />
    <Route path="/ledger" element={<ProtectedRoute><PageWrapper><GeneralLedger /></PageWrapper></ProtectedRoute>} />
    <Route path="/detailed-ledger" element={<ProtectedRoute><PageWrapper><DetailedLedger /></PageWrapper></ProtectedRoute>} />
    <Route path="/trial-balance" element={<ProtectedRoute><PageWrapper><TrialBalance /></PageWrapper></ProtectedRoute>} />
    <Route path="/exchange-rates" element={<ProtectedRoute><PageWrapper><ExchangeRates /></PageWrapper></ProtectedRoute>} />
    <Route path="/finance/revaluation" element={<ProtectedRoute><PageWrapper><CurrencyRevaluation /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/fx-gain-loss" element={<ProtectedRoute><PageWrapper><FxGainLossReport /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/multi-currency-trial-balance" element={<ProtectedRoute><PageWrapper><MultiCurrencyTrialBalance /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/balance-sheet" element={<ProtectedRoute><PageWrapper><BalanceSheet /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/income-statement" element={<ProtectedRoute><PageWrapper><IncomeStatement /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/cash-flow" element={<ProtectedRoute><PageWrapper><CashFlow /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/changes-in-equity" element={<ProtectedRoute><PageWrapper><ChangesInEquity /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/changes-equity" element={<ProtectedRoute><PageWrapper><ChangesInEquity /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><PageWrapper><ReportsCentre /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/accountant" element={<ProtectedRoute><PageWrapper><AccountantDashboard /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/practice-management" element={<ProtectedRoute><PageWrapper><PracticeManagementDashboard /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/management" element={<ProtectedRoute><PageWrapper><ManagementReport /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/products" element={<ProtectedRoute><PageWrapper><ProductsServices /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/customers" element={<ProtectedRoute><PageWrapper><Customers /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/invoices" element={<ProtectedRoute><PageWrapper><Invoices /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/payments" element={<ProtectedRoute><PageWrapper><Payments /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/quotes" element={<ProtectedRoute><PageWrapper><Quotes /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/recurring" element={<ProtectedRoute><PageWrapper><RecurringInvoices /></PageWrapper></ProtectedRoute>} />
    <Route path="/sales/credit-notes" element={<ProtectedRoute><PageWrapper><CreditNotes /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/vendors" element={<ProtectedRoute><PageWrapper><Vendors /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/orders" element={<ProtectedRoute><PageWrapper><PurchaseOrders /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/bills" element={<ProtectedRoute><PageWrapper><Bills /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/recurring" element={<ProtectedRoute><PageWrapper><RecurringBills /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/credits" element={<ProtectedRoute><PageWrapper><VendorCredits /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/expense-claims" element={<ProtectedRoute><PageWrapper><ExpenseClaims /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/expenses" element={<ProtectedRoute><PageWrapper><Expenses /></PageWrapper></ProtectedRoute>} />
    <Route path="/purchases/payments" element={<ProtectedRoute><PageWrapper><Payments /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/aging" element={<ProtectedRoute><PageWrapper><AgingReports /></PageWrapper></ProtectedRoute>} />
    <Route path="/reports/consolidated" element={<ProtectedRoute><PageWrapper><ConsolidatedStatements /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking/accounts" element={<ProtectedRoute><PageWrapper><BankAccounts /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking/settlements" element={<ProtectedRoute><PageWrapper><SettlementReconciliation /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury" element={<ProtectedRoute><PageWrapper><TreasuryDashboard /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/tax-payments" element={<ProtectedRoute><PageWrapper><TreasuryTaxPayments /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/ap-payments" element={<ProtectedRoute><PageWrapper><TreasuryAPPayments /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/ap-payments/:batchId" element={<ProtectedRoute><PageWrapper><TreasuryBatchDetail /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/settings" element={<ProtectedRoute><PageWrapper><TreasurySettings /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/approvals" element={<ProtectedRoute><PageWrapper><TreasuryApprovals /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/payroll-payments" element={<ProtectedRoute><PageWrapper><TreasuryPayrollPayments /></PageWrapper></ProtectedRoute>} />
    <Route path="/treasury/payroll-payments/:batchId" element={<ProtectedRoute><PageWrapper><TreasuryPayrollPayments /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments" element={<ProtectedRoute><PageWrapper><BankingPaymentsDashboard /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/cra-remittance" element={<ProtectedRoute><PageWrapper><CraRemittanceCentre /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/cra-payments" element={<ProtectedRoute><PageWrapper><TreasuryTaxPayments /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/cra-accounts" element={<ProtectedRoute><PageWrapper><CraAccountsSettings /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/scheduled" element={<ProtectedRoute><PageWrapper><ScheduledPayments /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/history" element={<ProtectedRoute><PageWrapper><PaymentHistory /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/payment-links" element={<ProtectedRoute><PageWrapper><PaymentLinks /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/cra-audit-log" element={<ProtectedRoute><PageWrapper><CraAuditLog /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/fintrac-reports" element={<ProtectedRoute><PageWrapper><FintracReports /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/rpaa" element={<ProtectedRoute><PageWrapper><RpaaCompliance /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/reconciliation-review" element={<ProtectedRoute><PageWrapper><ReconciliationReview /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/bulk-payroll" element={<ProtectedRoute><PageWrapper><BulkPayrollRemittance /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/multi-business" element={<ProtectedRoute><PageWrapper><MultiBusinessRemittance /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/approval-rules" element={<ProtectedRoute><PageWrapper><ApprovalRules /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/delegated-access" element={<ProtectedRoute><PageWrapper><DelegatedAccess /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/provincial" element={<ProtectedRoute><PageWrapper><ProvincialRemittanceCentre /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/cra-filings" element={<ProtectedRoute><PageWrapper><CraFilings /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/eft-rails" element={<ProtectedRoute><PageWrapper><EftRailSettings /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/stripe-connect" element={<ProtectedRoute><PageWrapper><StripeConnectedAccounts /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/stripe-connect/:accountId" element={<ProtectedRoute><PageWrapper><StripeConnectedAccountDetail /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/compliance-exports" element={<ProtectedRoute><PageWrapper><ComplianceExports /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/stripe-connect/routing" element={<ProtectedRoute><PageWrapper><StripeConnectRouting /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/stripe-connect/compliance" element={<ProtectedRoute><PageWrapper><StripeConnectCompliance /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/forecast" element={<ProtectedRoute><PageWrapper><CashFlowForecast /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/anomalies" element={<ProtectedRoute><PageWrapper><AnomalyInbox /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/period-close" element={<ProtectedRoute><PageWrapper><PeriodClose /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/auditor-portal" element={<ProtectedRoute><PageWrapper><AuditorPortal /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/vendor-slips" element={<ProtectedRoute><PageWrapper><VendorSlips /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/vendor-tax-profiles" element={<ProtectedRoute><PageWrapper><VendorTaxProfiles /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/us-remittance" element={<ProtectedRoute><PageWrapper><UsRemittanceCentre /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/us-rails" element={<ProtectedRoute><PageWrapper><UsPaymentRailSettings /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/tin-match-batches" element={<ProtectedRoute><PageWrapper><TinMatchBatchResults /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/signed-filings" element={<ProtectedRoute><PageWrapper><SignedFilingDashboard /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/consolidation" element={<ProtectedRoute><PageWrapper><ConsolidationDashboard /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/jobs-log" element={<ProtectedRoute><PageWrapper><TreasuryJobsLog /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking-payments/alerts" element={<ProtectedRoute><PageWrapper><TreasuryAlerts /></PageWrapper></ProtectedRoute>} />
    <Route path="/firm/clients" element={<ProtectedRoute><PageWrapper><FirmClients /></PageWrapper></ProtectedRoute>} />
    <Route path="/firm/copilot" element={<ProtectedRoute><PageWrapper><FirmCopilot /></PageWrapper></ProtectedRoute>} />
    <Route path="/intl/uk-vat" element={<ProtectedRoute><PageWrapper><UkVatFilings /></PageWrapper></ProtectedRoute>} />
    <Route path="/intl/eu-oss" element={<ProtectedRoute><PageWrapper><EuOssFilings /></PageWrapper></ProtectedRoute>} />
    <Route path="/intl/sepa" element={<ProtectedRoute><PageWrapper><SepaRailSettings /></PageWrapper></ProtectedRoute>} />
    <Route path="/marketplace" element={<ProtectedRoute><PageWrapper><MarketplaceCatalog /></PageWrapper></ProtectedRoute>} />
    <Route path="/marketplace/installed" element={<ProtectedRoute><PageWrapper><InstalledIntegrations /></PageWrapper></ProtectedRoute>} />
    <Route path="/m/treasury" element={<ProtectedRoute><MobileTreasuryShell /></ProtectedRoute>}>
      <Route index element={<MobileHome />} />
      <Route path="alerts" element={<MobileAlerts />} />
      <Route path="approvals" element={<MobileApprovals />} />
      <Route path="copilot" element={<MobileCopilot />} />
    </Route>
    <Route path="/pay/:linkId" element={<PayLink />} />

        <Route path="/banking/credit-cards" element={<ProtectedRoute><PageWrapper><CreditCards /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/credit-cards/:cardId/transactions" element={<ProtectedRoute><PageWrapper><CreditCardTransactions /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/credit-cards/:cardId/reconcile" element={<ProtectedRoute><PageWrapper><CreditCardReconciliation /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/credit-cards/reconcile" element={<ProtectedRoute><PageWrapper><CreditCardReconciliation /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/transactions" element={<ProtectedRoute><PageWrapper><BankTransactions /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking/rules" element={<ProtectedRoute><PageWrapper><TransactionRules /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking/reconciliation" element={<ProtectedRoute><PageWrapper><Reconciliation /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking/reconciliation-history" element={<ProtectedRoute><PageWrapper><ReconciliationHistory /></PageWrapper></ProtectedRoute>} />
    <Route path="/banking/tax-audit" element={<ProtectedRoute><PageWrapper><SalesTaxAudit /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax" element={<ProtectedRoute><PageWrapper><SalesTax /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/setup" element={<ProtectedRoute><PageWrapper><TaxSetupWizard /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/filing-periods" element={<ProtectedRoute><PageWrapper><TaxFilingPeriods /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/file-return/:periodId" element={<ProtectedRoute><PageWrapper><TaxFileReturn /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/reconciliation" element={<ProtectedRoute><PageWrapper><TaxReconciliation /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/reconciliation/:authorityId" element={<ProtectedRoute><PageWrapper><TaxReconciliation /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/exceptions" element={<ProtectedRoute><PageWrapper><TaxExceptions /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/audit-trail" element={<ProtectedRoute><PageWrapper><TaxAuditTrail /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/reports" element={<ProtectedRoute><PageWrapper><TaxReportsAdvanced /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/e-file" element={<ProtectedRoute><PageWrapper><TaxEFile /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/address-tax" element={<ProtectedRoute><PageWrapper><AddressTax /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/eu-vat" element={<ProtectedRoute><PageWrapper><EuVat /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/provision" element={<ProtectedRoute><PageWrapper><TaxProvision /></PageWrapper></ProtectedRoute>} />
    <Route path="/tax/withholding" element={<ProtectedRoute><PageWrapper><WithholdingTax /></PageWrapper></ProtectedRoute>} />
    <Route path="/inventory" element={<ProtectedRoute><PageWrapper><Inventory /></PageWrapper></ProtectedRoute>} />
    <Route path="/fixed-assets" element={<ProtectedRoute><PageWrapper><FixedAssets /></PageWrapper></ProtectedRoute>} />
    <Route path="/leases" element={<ProtectedRoute><PageWrapper><Leases /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees" element={<ProtectedRoute><PageWrapper><Employees /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/list" element={<ProtectedRoute><PageWrapper><EmployeesList /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/:id" element={<ProtectedRoute><PageWrapper><EmployeeProfile /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/onboarding" element={<ProtectedRoute><PageWrapper><EmployeeOnboarding /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/timesheets" element={<ProtectedRoute><PageWrapper><EmployeeTimesheets /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/timesheets/:id" element={<ProtectedRoute><PageWrapper><TimesheetDetail /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/self-service" element={<ProtectedRoute><PageWrapper><EmployeeSelfService /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/runs" element={<ProtectedRoute><PageWrapper><PayRuns /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/reports" element={<ProtectedRoute><PageWrapper><PayrollReports /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/remittances" element={<ProtectedRoute><PageWrapper><Remittances /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/tax-slips" element={<ProtectedRoute><PageWrapper><TaxSlips /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/roe" element={<ProtectedRoute><PageWrapper><RoeRecords /></PageWrapper></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><PageWrapper><Settings /></PageWrapper></ProtectedRoute>} />
    <Route path="/docsign" element={<DocSignRoute />} />
    <Route path="/communication" element={<ProtectedRoute><PageWrapper><CommunicationHub /></PageWrapper></ProtectedRoute>} />
    
    {/* Budget routes - static routes must come before dynamic :id route */}
    <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
    <Route path="/budgets/production" element={<ProtectedRoute><ProductionBudgets /></ProtectedRoute>} />
    <Route path="/budgets/variance" element={<ProtectedRoute><BudgetVariance /></ProtectedRoute>} />
    <Route path="/budgets/ai-forecast" element={<ProtectedRoute><AIForecast /></ProtectedRoute>} />
    
    {/* Donations (CRA/NPO compliant) */}
    <Route path="/donations" element={<ProtectedRoute><PageWrapper><Donations /></PageWrapper></ProtectedRoute>} />
    <Route path="/budgets/:id" element={<ProtectedRoute><BudgetDetail /></ProtectedRoute>} />
    
    {/* Admin routes - protected at route level by AdminRoute */}
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
    <Route path="/admin/organizations" element={<AdminRoute><AdminOrganizations /></AdminRoute>} />
    <Route path="/admin/organizations/:organizationId/modules" element={<AdminRoute><OrganizationModulesPage /></AdminRoute>} />
    <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
    <Route path="/admin/communications" element={<AdminRoute><AdminCommunications /></AdminRoute>} />
    <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
    
    {/* Subscription routes */}
    <Route path="/subscription/checkout" element={<ProtectedRoute><PageWrapper><SubscriptionCheckout /></PageWrapper></ProtectedRoute>} />
    <Route path="/subscription/success" element={<ProtectedRoute><PageWrapper><SubscriptionSuccess /></PageWrapper></ProtectedRoute>} />
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const DocSignRoute = () => {
  const location = useLocation();
  const sign = new URLSearchParams(location.search).get("sign");

  // Public signer portal (no login required)
  if (sign) {
    return <DocSignSign />;
  }

  // Internal DocSign app (login required)
  return (
    <ProtectedRoute>
      <PageWrapper>
        <DocSign />
      </PageWrapper>
    </ProtectedRoute>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <ReportFiltersProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
            </ReportFiltersProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
