import { forwardRef, lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminRoute } from "@/components/AdminRoute";
import { RouteAccessGuard } from "@/components/auth/RouteAccessGuard";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OrganizationProvider, useOrganizationContext } from "@/hooks/useOrganizationContext";
import { ReportFiltersProvider } from "@/hooks/useReportFilters";
import { ConfirmDeleteProvider } from "@/hooks/useConfirmDelete";

// Eager: landing + auth pages (needed on first paint / pre-auth)
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy: everything else — pages load on demand, dramatically shrinking the
// initial JS bundle for landing / auth traffic.
const Security = lazy(() => import("./pages/Security"));
const E2EReportsHarness = lazy(() => import("./pages/__E2EReportsHarness"));
const Index = lazy(() => import("./pages/Index"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const AccountGenerator = lazy(() => import("./pages/AccountGenerator"));
const GeneralLedger = lazy(() => import("./pages/GeneralLedger"));
const DetailedLedger = lazy(() => import("./pages/DetailedLedger"));
const JournalEntries = lazy(() => import("./pages/JournalEntries"));
const Divisions = lazy(() => import("./pages/Divisions"));
const AllocationRules = lazy(() => import("./pages/AllocationRules"));
const DivisionAccess = lazy(() => import("./pages/DivisionAccess"));
const TrialBalance = lazy(() => import("./pages/TrialBalance"));
const BalanceSheet = lazy(() => import("./pages/BalanceSheet"));
const IncomeStatement = lazy(() => import("./pages/IncomeStatement"));
const CashFlow = lazy(() => import("./pages/CashFlow"));
const ChangesInEquity = lazy(() => import("./pages/ChangesInEquity"));
const ReportsCentre = lazy(() => import("./pages/ReportsCentre"));
const Customers = lazy(() => import("./pages/Customers"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Payments = lazy(() => import("./pages/Payments"));
const TreasuryDashboard = lazy(() => import("./pages/treasury/TreasuryDashboard"));
const TreasuryTaxPayments = lazy(() => import("./pages/treasury/TaxPayments"));
const TreasuryAPPayments = lazy(() => import("./pages/treasury/APPayments"));
const TreasuryBatchDetail = lazy(() => import("./pages/treasury/PaymentBatchDetail"));
const TreasurySettings = lazy(() => import("./pages/treasury/TreasurySettings"));
const TreasuryPayrollPayments = lazy(() => import("./pages/treasury/PayrollPayments"));
const TreasuryApprovals = lazy(() => import("./pages/treasury/Approvals"));
const BankingPaymentsDashboard = lazy(() => import("./pages/treasury/BankingPaymentsDashboard"));
const CraRemittanceCentre = lazy(() => import("./pages/treasury/CraRemittanceCentre"));
const CraAuditLog = lazy(() => import("./pages/treasury/CraAuditLog"));
const CraAccountsSettings = lazy(() => import("./pages/treasury/CraAccountsSettings"));
const ScheduledPayments = lazy(() => import("./pages/treasury/ScheduledPayments"));
const PaymentHistory = lazy(() => import("./pages/treasury/PaymentHistory"));
const PaymentLinks = lazy(() => import("./pages/treasury/PaymentLinks"));
const FintracReports = lazy(() => import("./pages/treasury/FintracReports"));
const RpaaCompliance = lazy(() => import("./pages/treasury/RpaaCompliance"));
const ReconciliationReview = lazy(() => import("./pages/treasury/ReconciliationReview"));
const BulkPayrollRemittance = lazy(() => import("./pages/treasury/BulkPayrollRemittance"));
const MultiBusinessRemittance = lazy(() => import("./pages/treasury/MultiBusinessRemittance"));
const ApprovalRules = lazy(() => import("./pages/treasury/ApprovalRules"));
const DelegatedAccess = lazy(() => import("./pages/treasury/DelegatedAccess"));
const ProvincialRemittanceCentre = lazy(() => import("./pages/treasury/ProvincialRemittanceCentre"));
const CraFilings = lazy(() => import("./pages/treasury/CraFilings"));
const EftRailSettings = lazy(() => import("./pages/treasury/EftRailSettings"));
const StripeConnectedAccounts = lazy(() => import("./pages/treasury/StripeConnectedAccounts"));
const StripeConnectedAccountDetail = lazy(() => import("./pages/treasury/StripeConnectedAccountDetail"));
const StripeConnectRouting = lazy(() => import("./pages/treasury/StripeConnectRouting"));
const StripeConnectCompliance = lazy(() => import("./pages/treasury/StripeConnectCompliance"));
const PayoutRouting = lazy(() => import("./pages/treasury/PayoutRouting"));
const ComplianceExports = lazy(() => import("./pages/treasury/ComplianceExports"));
const CashFlowForecast = lazy(() => import("./pages/treasury/CashFlowForecast"));
const AnomalyInbox = lazy(() => import("./pages/treasury/AnomalyInbox"));
const PeriodClose = lazy(() => import("./pages/treasury/PeriodClose"));
const AuditorPortal = lazy(() => import("./pages/treasury/AuditorPortal"));
const VendorSlips = lazy(() => import("./pages/treasury/VendorSlips"));
const VendorTaxProfiles = lazy(() => import("./pages/treasury/VendorTaxProfiles"));
const UsRemittanceCentre = lazy(() => import("./pages/treasury/UsRemittanceCentre"));
const UsPaymentRailSettings = lazy(() => import("./pages/treasury/UsPaymentRailSettings"));
const TinMatchBatchResults = lazy(() => import("./pages/treasury/TinMatchBatchResults"));
const SignedFilingDashboard = lazy(() => import("./pages/treasury/SignedFilingDashboard"));
const ConsolidationDashboard = lazy(() => import("./pages/treasury/ConsolidationDashboard"));
const TreasuryJobsLog = lazy(() => import("./pages/treasury/TreasuryJobsLog"));
const TreasuryAlerts = lazy(() => import("./pages/treasury/TreasuryAlerts"));
const FirmClients = lazy(() => import("./pages/firm/FirmClients"));
const FirmCopilot = lazy(() => import("./pages/firm/FirmCopilot"));
const UkVatFilings = lazy(() => import("./pages/intl/UkVatFilings"));
const EuOssFilings = lazy(() => import("./pages/intl/EuOssFilings"));
const SepaRailSettings = lazy(() => import("./pages/intl/SepaRailSettings"));
const MarketplaceCatalog = lazy(() => import("./pages/marketplace/MarketplaceCatalog"));
const InstalledIntegrations = lazy(() => import("./pages/marketplace/InstalledIntegrations"));
const MobileTreasuryShell = lazy(() => import("./pages/mobile/treasury/MobileTreasuryShell"));
const MobileHome = lazy(() => import("./pages/mobile/treasury/MobileHome"));
const MobileAlerts = lazy(() => import("./pages/mobile/treasury/MobileAlerts"));
const MobileApprovals = lazy(() => import("./pages/mobile/treasury/MobileApprovals"));
const MobileCopilot = lazy(() => import("./pages/mobile/treasury/MobileCopilot"));
const PayLink = lazy(() => import("./pages/public/PayLink"));
const PaymentStatus = lazy(() => import("./pages/PaymentStatus"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Bills = lazy(() => import("./pages/Bills"));
const Approvals = lazy(() => import("./pages/Approvals"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));

const BankTransactions = lazy(() => import("./pages/BankTransactions"));
const AICategorizationInsights = lazy(() => import("./pages/AICategorizationInsights"));
const AICategorizationHistory = lazy(() => import("./pages/AICategorizationHistory"));
const SettlementReconciliation = lazy(() => import("./pages/SettlementReconciliation"));
const TransactionRules = lazy(() => import("./pages/TransactionRules"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const ReconciliationHistory = lazy(() => import("./pages/ReconciliationHistory"));
const SalesTaxAudit = lazy(() => import("./pages/SalesTaxAudit"));
const CreditCards = lazy(() => import("./pages/CreditCards"));
const CreditCardTransactions = lazy(() => import("./pages/CreditCardTransactions"));
const CreditCardReconciliation = lazy(() => import("./pages/CreditCardReconciliation"));
const SalesTax = lazy(() => import("./pages/SalesTax"));
const TaxFilingPeriods = lazy(() => import("./pages/TaxFilingPeriods"));
const TaxFileReturn = lazy(() => import("./pages/TaxFileReturn"));
const TaxReconciliation = lazy(() => import("./pages/TaxReconciliation"));
const TaxExceptions = lazy(() => import("./pages/TaxExceptions"));
const TaxAuditTrail = lazy(() => import("./pages/TaxAuditTrail"));
const TaxSetupWizard = lazy(() => import("./pages/TaxSetupWizard"));
const TaxReportsAdvanced = lazy(() => import("./pages/TaxReportsAdvanced"));
const TaxEFile = lazy(() => import("./pages/TaxEFile"));
const AddressTax = lazy(() => import("./pages/AddressTax"));
const EuVat = lazy(() => import("./pages/EuVat"));
const TaxProvision = lazy(() => import("./pages/TaxProvision"));
const WithholdingTax = lazy(() => import("./pages/WithholdingTax"));
const NigeriaTaxEngine = lazy(() => import("./pages/tax/NigeriaTaxEngine"));
const Employees = lazy(() => import("./pages/Employees"));
const PayRuns = lazy(() => import("./pages/PayRuns"));
const PayrollReports = lazy(() => import("./pages/PayrollReports"));
const Remittances = lazy(() => import("./pages/Remittances"));
const TaxSlips = lazy(() => import("./pages/TaxSlips"));
const RoeRecords = lazy(() => import("./pages/RoeRecords"));
const EmployeeOnboarding = lazy(() => import("./pages/payroll/EmployeeOnboarding"));
const EmployeesList = lazy(() => import("./pages/payroll/EmployeesList"));
const BulkEmployeeUpload = lazy(() => import("./pages/payroll/BulkEmployeeUpload"));
const BulkEmployeeUploadHistory = lazy(() => import("./pages/payroll/BulkEmployeeUploadHistory"));

const EmployeeProfile = lazy(() => import("./pages/payroll/EmployeeProfile"));
const EmployeeTimesheets = lazy(() => import("./pages/payroll/EmployeeTimesheets"));
const TimesheetDetail = lazy(() => import("./pages/payroll/TimesheetDetail"));
const EmployeeSelfService = lazy(() => import("./pages/payroll/EmployeeSelfService"));
const Settings = lazy(() => import("./pages/Settings"));
const ExchangeRates = lazy(() => import("./pages/ExchangeRates"));
const CurrencyRevaluation = lazy(() => import("./pages/CurrencyRevaluation"));
const FxGainLossReport = lazy(() => import("./pages/FxGainLossReport"));
const MultiCurrencyTrialBalance = lazy(() => import("./pages/MultiCurrencyTrialBalance"));
const Inventory = lazy(() => import("./pages/Inventory"));
const FixedAssets = lazy(() => import("./pages/FixedAssets"));
const Leases = lazy(() => import("./pages/Leases"));
const ProductsServices = lazy(() => import("./pages/ProductsServices"));
const Quotes = lazy(() => import("./pages/Quotes"));
const CreditNotes = lazy(() => import("./pages/CreditNotes"));
const RecurringInvoices = lazy(() => import("./pages/RecurringInvoices"));
const RecurringBills = lazy(() => import("./pages/RecurringBills"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const VendorCredits = lazy(() => import("./pages/VendorCredits"));
const ExpenseClaims = lazy(() => import("./pages/ExpenseClaims"));
const Expenses = lazy(() => import("./pages/Expenses"));
const AgingReports = lazy(() => import("./pages/AgingReports"));
const AccountantDashboard = lazy(() => import("./pages/AccountantDashboard"));
const PracticeManagementDashboard = lazy(() => import("./pages/practice/PracticeManagementDashboard"));
const ManagementReport = lazy(() => import("./pages/ManagementReport"));
const DocSign = lazy(() => import("./pages/DocSign"));
const DocSignSign = lazy(() => import("./pages/DocSignSign"));
const CommunicationHub = lazy(() => import("./pages/CommunicationHub"));
const ConsolidatedStatements = lazy(() => import("./pages/ConsolidatedStatements"));
const Donations = lazy(() => import("./pages/Donations"));
const Budgets = lazy(() => import("./pages/Budgets"));
const BudgetDetail = lazy(() => import("./pages/BudgetDetail"));
const ProductionBudgets = lazy(() => import("./pages/ProductionBudgets"));
const BudgetVariance = lazy(() => import("./pages/BudgetVariance"));
const AIForecast = lazy(() => import("./pages/AIForecast"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminOrganizations = lazy(() => import("./pages/admin/AdminOrganizations"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminCommunications = lazy(() => import("./pages/admin/AdminCommunications"));
const OrganizationModulesPage = lazy(() => import("./pages/admin/OrganizationModulesPage"));
const Install = lazy(() => import("./pages/Install"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const SubscriptionCheckout = lazy(() => import("./pages/SubscriptionCheckout"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const ClearCache = lazy(() => import("./pages/ClearCache"));
const LoanCalculatorPage = lazy(() => import("./pages/toolkit/LoanCalculatorPage"));

const queryClient = new QueryClient();

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

// Suspense fallback shown while a lazy route chunk downloads.
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
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
        <RouteAccessGuard>{children}</RouteAccessGuard>
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

const AppRoutes = () => {
  const { currentOrganization } = useOrganizationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const prevOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    const newId = currentOrganization?.id ?? null;
    const prevId = prevOrgIdRef.current;
    // On a real switch (not initial hydrate), route to dashboard.
    if (prevId && newId && prevId !== newId && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
    prevOrgIdRef.current = newId;
  }, [currentOrganization?.id, location.pathname, navigate]);

  return (
  <Suspense fallback={<RouteFallback />}>
  <Routes key={currentOrganization?.id ?? 'no-org'}>


    {/* Public routes */}
    <Route path="/landing" element={<Landing />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/about" element={<About />} />
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
    <Route path="/purchases/approvals" element={<ProtectedRoute><PageWrapper><Approvals /></PageWrapper></ProtectedRoute>} />
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
    <Route path="/banking-payments/payout-routing" element={<ProtectedRoute><PageWrapper><PayoutRouting /></PageWrapper></ProtectedRoute>} />
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
    <Route path="/payment-status/:linkId" element={<PaymentStatus />} />

        <Route path="/banking/credit-cards" element={<ProtectedRoute><PageWrapper><CreditCards /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/credit-cards/:cardId/transactions" element={<ProtectedRoute><PageWrapper><CreditCardTransactions /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/credit-cards/:cardId/reconcile" element={<ProtectedRoute><PageWrapper><CreditCardReconciliation /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/credit-cards/reconcile" element={<ProtectedRoute><PageWrapper><CreditCardReconciliation /></PageWrapper></ProtectedRoute>} />
        <Route path="/banking/transactions" element={<ProtectedRoute><PageWrapper><BankTransactions /></PageWrapper></ProtectedRoute>} />
        <Route path="/ai/categorization-insights" element={<ProtectedRoute><PageWrapper><AICategorizationInsights /></PageWrapper></ProtectedRoute>} />
        <Route path="/ai/categorization-history" element={<ProtectedRoute><PageWrapper><AICategorizationHistory /></PageWrapper></ProtectedRoute>} />

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
    <Route path="/tax/nigeria" element={<ProtectedRoute><PageWrapper><NigeriaTaxEngine /></PageWrapper></ProtectedRoute>} />
    <Route path="/inventory" element={<ProtectedRoute><PageWrapper><Inventory /></PageWrapper></ProtectedRoute>} />
    <Route path="/fixed-assets" element={<ProtectedRoute><PageWrapper><FixedAssets /></PageWrapper></ProtectedRoute>} />
    <Route path="/leases" element={<ProtectedRoute><PageWrapper><Leases /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees" element={<ProtectedRoute><PageWrapper><Employees /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/list" element={<ProtectedRoute><PageWrapper><EmployeesList /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/:id" element={<ProtectedRoute><PageWrapper><EmployeeProfile /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/onboarding" element={<ProtectedRoute><PageWrapper><EmployeeOnboarding /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/bulk-upload" element={<ProtectedRoute><PageWrapper><BulkEmployeeUpload /></PageWrapper></ProtectedRoute>} />
    <Route path="/payroll/employees/bulk-upload/history" element={<ProtectedRoute><PageWrapper><BulkEmployeeUploadHistory /></PageWrapper></ProtectedRoute>} />

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
  </Suspense>
  );
};


const DocSignRoute = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sign = params.get("sign");
  const token = params.get("token");

  // Public signer portal (no login required) — ?sign= legacy, ?token= first-party
  if (sign || token) {
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
              <ConfirmDeleteProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
              </ConfirmDeleteProvider>
            </ReportFiltersProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
