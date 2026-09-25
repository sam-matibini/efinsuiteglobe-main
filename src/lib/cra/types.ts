/** Organization-scoped CRA Tax & Remittance records. No CRA passwords are stored. */

export type CraProgramCode = 'RC' | 'RT' | 'RP' | 'RZ' | 'OTHER';

export type TaxType = 'gst_hst' | 'payroll' | 'corporate_tax' | 'information_return';

export type AuthorizationStatus =
  | 'not_started'
  | 'pending_client_confirmation'
  | 'connected'
  | 'revoked'
  | 'expired';

export type RepresentativeLevel = 'level_1' | 'level_2';

export type CraCapability =
  | 'view'
  | 'prepare_gst'
  | 'prepare_payroll'
  | 'prepare_corporate'
  | 'prepare_payment'
  | 'approve_payment'
  | 'file_return'
  | 'manage_authorization';

export type PaymentStatus =
  | 'draft'
  | 'authorized'
  | 'submitted'
  | 'processing'
  | 'accepted'
  | 'settled'
  | 'confirmed'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'refunded';

export type FilingStatus = 'calculated' | 'reviewed' | 'prepared' | 'not_filed' | 'filed' | 'submitted';

export type EfileReturnType = 'T1' | 'T2' | 'T3' | 'GST34' | 'PD7A' | 'T4' | 'ReFILE';

export type EfileStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'error';

export interface AccessCeiling {
  view: boolean;
  level2: boolean;
  taxFiling: boolean;
  remittance: boolean;
  administration: boolean;
}

export interface CraProfile {
  legalName: string;
  businessNumber: string;
  corporationNumber: string;
  businessType: string;
  province: string;
  address: string;
  fiscalYearEnd: string;
  contactName: string;
  contactEmail: string;
  programs: CraProgramCode[];
  otherProgramNote: string;
}

export interface ProgramAccount {
  program: CraProgramCode;
  reference: string;
  label: string;
}

export interface CraAuthorization {
  status: AuthorizationStatus;
  level: RepresentativeLevel;
  requestedAt?: string;
  confirmedAt?: string;
  reference?: string;
  instructionsSentAt?: string;
  /** True only after Client Data Enquiry says this representative can see the business. */
  verifiedByCra?: boolean;
}

export interface GstPosition {
  id: string;
  periodStart: string;
  periodEnd: string;
  collected: number;
  itcs: number;
  dueDate: string;
  filingStatus: 'calculated' | 'reviewed' | 'filed';
  efileSubmissionId?: string;
}

export interface PayrollPosition {
  id: string;
  account: string;
  periodStart: string;
  periodEnd: string;
  cpp: number;
  ei: number;
  incomeTax: number;
  dueDate: string;
  filingStatus: 'calculated' | 'reviewed' | 'submitted';
  efileSubmissionId?: string;
  sourcePayRunLabel: string;
}

export interface CorporatePosition {
  id: string;
  form: 'T2';
  fiscalStart: string;
  fiscalEnd: string;
  filingStatus: 'not_filed' | 'prepared' | 'filed';
  balance: number;
  installmentsPaid: number;
  nextInstallmentAmount: number;
  nextInstallmentDate: string;
  efileSubmissionId?: string;
}

export interface EfileSubmission {
  id: string;
  clientName: string;
  clientBn: string;
  taxYear: string;
  returnType: EfileReturnType;
  submittedAt?: string;
  craResponse?: string;
  confirmationNumber?: string;
  errors: string[];
  status: EfileStatus;
  obligationId?: string;
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
  memo: string;
}

export interface CraPayment {
  id: string;
  taxType: TaxType;
  account: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
  fundingAccount: string;
  purpose: string;
  obligationId?: string;
  status: PaymentStatus;
  preparedBy: string;
  preparedByName: string;
  approvedBy?: string;
  releasedAt?: string;
  craConfirmation?: string;
  walletDeduction?: number;
  bankSettlement?: number;
  fee: number;
  glAccrual: JournalLine[];
  glSettlement: JournalLine[];
  failureReason?: string;
  railReference?: string;
  journalEntryId?: string;
  glError?: string;
  createdAt: string;
}

export interface CraNotice {
  id: string;
  severity: 'action' | 'review' | 'info';
  title: string;
  program: string;
  receivedAt: string;
  body: string;
  read: boolean;
}

export interface AuditEvent {
  id: string;
  at: string;
  userEmail: string;
  client: string;
  action: string;
  craAccount?: string;
  authorization: string;
  efileSubmission?: string;
  craResponse?: string;
  confirmation?: string;
  ipDevice: string;
}

export interface CraBalances {
  gst_hst: number;
  payroll: number;
  corporate_tax: number;
}

export interface CraLedger {
  version: 1;
  syncedAt: string;
  walletBalance: number;
  profile: CraProfile;
  accounts: ProgramAccount[];
  authorization: CraAuthorization;
  accessCeiling: AccessCeiling;
  balances: CraBalances;
  accountReviewStatus: string;
  directDepositAvailable: boolean;
  gst: GstPosition;
  payroll: PayrollPosition;
  corporate: CorporatePosition;
  submissions: EfileSubmission[];
  payments: CraPayment[];
  notices: CraNotice[];
  audit: AuditEvent[];
  seq: { payment: number; efile: number; confirmation: number; audit: number };
}

export interface CraActor {
  email: string;
  role: string;
  displayName: string;
}

export type ActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; error: string; id?: string };
