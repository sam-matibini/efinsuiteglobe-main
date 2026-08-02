import { useState } from 'react';
import { Building2, ExternalLink, Loader2, Globe2 } from 'lucide-react';
import { VisaIcon, MastercardIcon, AmexIcon, InteracIcon } from './PaymentIcons';
import type { WiseAccountDisplay } from '@/hooks/useWiseReceivingAccounts';

type PaymentTab = 'cc' | 'ach' | 'interac' | 'wise' | null;
export type InvoicePayMethod = 'cc' | 'ach' | 'interac';

interface PaymentMethodsTabsProps {
  primaryColor: string;
  creditCardEnabled: boolean;
  achEnabled: boolean;
  interacEnabled: boolean;
  ccInstructions?: string;
  achInstitution?: string;
  achAccountName?: string;
  achAccountNumber?: string;
  achTransitNumber?: string;
  etransferEmail?: string;
  ccPaymentUrl?: string;
  /** Wise bank transfer */
  wiseEnabled?: boolean;
  wiseAccount?: WiseAccountDisplay | null;
  wiseReference?: string | null;
  /** Optional: when provided, shows a "Pay $X.XX" button per method that
   *  generates a Paysafe-hosted payment link and opens it. */
  onPay?: (method: InvoicePayMethod) => Promise<void> | void;
  payAmount?: number;
  payCurrency?: string;
  payingMethod?: InvoicePayMethod | null;
}

const fmtMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export function PaymentMethodsTabs({
  primaryColor,
  creditCardEnabled,
  achEnabled,
  interacEnabled,
  ccInstructions,
  achInstitution,
  achAccountName,
  achAccountNumber,
  achTransitNumber,
  etransferEmail,
  ccPaymentUrl,
  wiseEnabled = false,
  wiseAccount = null,
  wiseReference = null,
  onPay,
  payAmount,
  payCurrency = 'CAD',
  payingMethod = null,
}: PaymentMethodsTabsProps) {
  const [activeTab, setActiveTab] = useState<PaymentTab>(null);

  const toggleTab = (tab: PaymentTab) => {
    setActiveTab(prev => prev === tab ? null : tab);
  };

  const canPayOnline = !!onPay && typeof payAmount === 'number' && payAmount > 0;

  const PayButton = ({ method, label }: { method: InvoicePayMethod; label: string }) => {
    if (!canPayOnline) return null;
    const isLoading = payingMethod === method;
    return (
      <button
        type="button"
        onClick={() => onPay?.(method)}
        disabled={isLoading || !!payingMethod}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
        style={{ backgroundColor: primaryColor }}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        {isLoading ? 'Preparing secure link…' : `${label} ${fmtMoney(payAmount!, payCurrency)}`}
      </button>
    );
  };

  return (
    <div className="mb-4 border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5" style={{ backgroundColor: `${primaryColor}15` }}>
        <p className="text-xs font-semibold" style={{ color: primaryColor }}>Accepted Payment Methods</p>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {creditCardEnabled && (
            <button
              type="button"
              onClick={() => toggleTab('cc')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer"
              style={{
                borderColor: activeTab === 'cc' ? primaryColor : `${primaryColor}30`,
                color: primaryColor,
                backgroundColor: activeTab === 'cc' ? `${primaryColor}12` : 'transparent',
              }}
            >
              <VisaIcon className="h-3.5" />
              <MastercardIcon className="h-3.5" />
              <AmexIcon className="h-3.5" />
              Visa, Mastercard, Amex
            </button>
          )}
          {achEnabled && (
            <button
              type="button"
              onClick={() => toggleTab('ach')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer"
              style={{
                borderColor: activeTab === 'ach' ? primaryColor : `${primaryColor}30`,
                color: primaryColor,
                backgroundColor: activeTab === 'ach' ? `${primaryColor}12` : 'transparent',
              }}
            >
              <Building2 className="w-3.5 h-3.5" />
              ACH / EFT Bank Transfer
            </button>
          )}
          {interacEnabled && (
            <button
              type="button"
              onClick={() => toggleTab('interac')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer"
              style={{
                borderColor: activeTab === 'interac' ? primaryColor : `${primaryColor}30`,
                color: primaryColor,
                backgroundColor: activeTab === 'interac' ? `${primaryColor}12` : 'transparent',
              }}
            >
              <InteracIcon className="h-3.5" />
              Interac e-Transfer
            </button>
          )}
          {wiseEnabled && (
            <button
              type="button"
              onClick={() => toggleTab('wise')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer"
              style={{
                borderColor: activeTab === 'wise' ? primaryColor : `${primaryColor}30`,
                color: primaryColor,
                backgroundColor: activeTab === 'wise' ? `${primaryColor}12` : 'transparent',
              }}
            >
              <Globe2 className="w-3.5 h-3.5" />
              Wise Bank Transfer
            </button>
          )}
        </div>


        {/* Credit Card Details */}
        {activeTab === 'cc' && (
          <div className="rounded-md p-2.5 text-xs space-y-1" style={{ backgroundColor: `${primaryColor}08` }}>
            <p className="font-semibold text-muted-foreground mb-1.5">Credit Card Payment</p>
            <PayButton method="cc" label="Pay by card" />
            {ccPaymentUrl ? (
              <a
                href={ccPaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline block mt-1"
                style={{ color: primaryColor }}
              >
                Or use existing portal: {ccPaymentUrl}
              </a>
            ) : ccInstructions ? (
              <p className="text-muted-foreground whitespace-pre-line mt-1">{ccInstructions}</p>
            ) : (
              !canPayOnline && (
                <p className="text-muted-foreground italic">Pay securely using Visa, Mastercard, or Amex via our online payment portal.</p>
              )
            )}
          </div>
        )}

        {/* ACH / EFT Details */}
        {activeTab === 'ach' && (
          <div className="rounded-md p-2.5 text-xs space-y-1" style={{ backgroundColor: `${primaryColor}08` }}>
            <p className="font-semibold text-muted-foreground mb-1.5">Bank Transfer (ACH / EFT)</p>
            <PayButton method="ach" label="Pay by bank transfer" />
            {achInstitution && (
              <div className="flex gap-2 mt-1">
                <span className="text-muted-foreground w-28 flex-shrink-0">Institution:</span>
                <span className="font-medium">{achInstitution}</span>
              </div>
            )}
            {achAccountName && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Account Name:</span>
                <span className="font-medium">{achAccountName}</span>
              </div>
            )}
            {achTransitNumber && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Transit / Routing:</span>
                <span className="font-medium">{achTransitNumber}</span>
              </div>
            )}
            {achAccountNumber && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Account #:</span>
                <span className="font-medium">{achAccountNumber}</span>
              </div>
            )}
            {!canPayOnline && !achInstitution && !achAccountName && !achTransitNumber && !achAccountNumber && (
              <p className="text-muted-foreground italic">Bank transfer details not yet configured. Contact us for payment information.</p>
            )}
          </div>
        )}

        {/* Interac e-Transfer Details */}
        {activeTab === 'interac' && (
          <div className="rounded-md p-2.5 text-xs space-y-1" style={{ backgroundColor: `${primaryColor}08` }}>
            <p className="font-semibold text-muted-foreground mb-1.5">Interac e-Transfer</p>
            <PayButton method="interac" label="Pay by Interac" />
            {etransferEmail ? (
              <div className="flex gap-2 mt-1">
                <span className="text-muted-foreground w-28 flex-shrink-0">Or send to:</span>
                <a
                  href={`mailto:${etransferEmail}`}
                  className="font-medium underline"
                  style={{ color: primaryColor }}
                >
                  {etransferEmail}
                </a>
              </div>
            ) : (
              !canPayOnline && (
                <p className="text-muted-foreground italic">e-Transfer email not yet configured. Contact us for payment information.</p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
