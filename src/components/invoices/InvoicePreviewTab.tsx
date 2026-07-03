import { useMemo, useEffect, useRef } from 'react';
import { PaymentMethodsTabs } from './PaymentMethodsTabs';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import JsBarcode from 'jsbarcode';

interface LineItem {
  description?: string;
  notes?: string;
  quantity?: number;
  unit_price?: number;
  tax_rate?: number;
}

interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'date';
}

interface InvoicePreviewTabProps {
  documentTitle?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName?: string;
  buyerName?: string;
  attentionOf?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  lines: LineItem[];
  notes?: string;
  terms?: string;
  isGstHstExempt?: boolean;
  isPstExempt?: boolean;
  exemptionReason?: string;
  customFields?: CustomField[];
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  logoUrl?: string;
  dealerPermitNumber?: string;
  gstHstNumber?: string;
  pstNumber?: string;
  currency?: string;
  locale?: string;
  sellerSignature?: string | null;
  buyerSignature?: string | null;
  gstHstRate?: number;
  pstRate?: number;
  showTaxColumn?: boolean;
  balanceDue?: number;
  // New totals breakdown
  discountAmount?: number;
  shippingCharges?: number;
  adjustment?: number;
  adjustmentLabel?: string;
  orderNumber?: string;
  subject?: string;
  // Template settings from organization
  templateStyle?: 'modern' | 'classic' | 'minimal' | 'bold';
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  headerAlignment?: 'left' | 'center' | 'right';
  accentStyle?: 'line' | 'filled' | 'none';
  showLogo?: boolean;
  showLineNumbers?: boolean;
  showQuantityColumn?: boolean;
  showRateColumn?: boolean;
  footerText?: string;
  showPaymentInstructions?: boolean;
  paymentInstructions?: string;
  // Online payment methods
  enableOnlinePayments?: boolean;
  creditCardEnabled?: boolean;
  achEnabled?: boolean;
  interacEnabled?: boolean;
  // Payment detail fields
  ccInstructions?: string;
  achInstitution?: string;
  achAccountName?: string;
  achAccountNumber?: string;
  achTransitNumber?: string;
  etransferEmail?: string;
  ccPaymentUrl?: string;
  // Signature toggles
  showSellerSignature?: boolean;
  showBuyerSignature?: boolean;
  onShowSellerSignatureChange?: (checked: boolean) => void;
  onShowBuyerSignatureChange?: (checked: boolean) => void;
  hideSignatureControls?: boolean;
  // Online payment action (in-app)
  onPayOnline?: (method: 'cc' | 'ach' | 'interac') => Promise<void> | void;
  payingMethod?: 'cc' | 'ach' | 'interac' | null;
}

export function InvoicePreviewTab({
  documentTitle = 'Invoice',
  invoiceNumber,
  invoiceDate,
  dueDate,
  customerName,
  buyerName,
  attentionOf,
  buyerEmail,
  buyerPhone,
  buyerAddress,
  lines,
  notes,
  terms,
  isGstHstExempt,
  isPstExempt,
  exemptionReason,
  customFields,
  organizationName,
  organizationAddress,
  organizationEmail,
  organizationPhone,
  logoUrl,
  dealerPermitNumber,
  gstHstNumber,
  pstNumber,
  currency = 'CAD',
  locale = 'en-CA',
  sellerSignature,
  buyerSignature,
  gstHstRate = 5,
  pstRate = 7,
  showTaxColumn = true,
  balanceDue,
  // New totals breakdown
  discountAmount = 0,
  shippingCharges = 0,
  adjustment = 0,
  adjustmentLabel = 'Adjustment',
  orderNumber,
  subject,
  // Template settings with defaults
  templateStyle = 'modern',
  primaryColor = '#7c3aed',
  secondaryColor = '#a78bfa',
  fontFamily = 'Inter, sans-serif',
  headerAlignment = 'left',
  accentStyle = 'filled',
  showLogo = true,
  showLineNumbers = false,
  showQuantityColumn = true,
  showRateColumn = true,
  footerText,
  showPaymentInstructions = false,
  paymentInstructions,
  // Online payment methods
  enableOnlinePayments = false,
  creditCardEnabled = false,
  achEnabled = false,
  interacEnabled = false,
  // Payment detail fields
  ccInstructions,
  achInstitution,
  achAccountName: achAccountNameProp,
  achAccountNumber: achAccountNumberProp,
  achTransitNumber: achTransitNumberProp,
  etransferEmail,
  ccPaymentUrl,
  // Signature toggles
  showSellerSignature = false,
  showBuyerSignature = false,
  onShowSellerSignatureChange,
  onShowBuyerSignatureChange,
  hideSignatureControls = false,
  onPayOnline,
  payingMethod = null,
}: InvoicePreviewTabProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const isBillOfSale = documentTitle?.toLowerCase().includes('bill of sale');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value);
  };

  const { subtotal, taxTotal, total } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    for (const line of lines) {
      const lineAmount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
      sub += lineAmount;
      const rate = Number(line.tax_rate) || 0;
      tax += lineAmount * (rate / 100);
    }
    const disc = discountAmount || 0;
    const ship = shippingCharges || 0;
    const adj = adjustment || 0;
    return { subtotal: sub, taxTotal: tax, total: sub - disc + ship + adj + tax };
  }, [lines, discountAmount, shippingCharges, adjustment]);

  const populatedCustomFields = customFields?.filter(f => f.value && String(f.value).trim() !== '') || [];

  // Generate barcode
  useEffect(() => {
    if (barcodeRef.current && invoiceNumber) {
      try {
        JsBarcode(barcodeRef.current, invoiceNumber, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
        });
      } catch (e) {
        console.error('Barcode generation failed:', e);
      }
    }
  }, [invoiceNumber]);

  // Dynamic style helpers based on template settings
  const getTableHeaderStyle = (): React.CSSProperties => {
    if (isBillOfSale) return { backgroundColor: primaryColor, color: '#fff' };
    switch (accentStyle) {
      case 'filled':
        return { backgroundColor: primaryColor, color: '#fff' };
      case 'line':
        return { borderBottom: `2px solid ${primaryColor}`, backgroundColor: 'transparent' };
      case 'none':
      default:
        return {};
    }
  };

  const getHeaderAlignmentClass = () => {
    switch (headerAlignment) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const tableHeaderStyle = getTableHeaderStyle();
  const isFilledHeader = accentStyle === 'filled' || isBillOfSale;

  return (
    <div>
      {!hideSignatureControls && (
      <div className="flex items-center gap-6 mb-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-seller-sig"
            checked={showSellerSignature}
            onCheckedChange={(checked) => onShowSellerSignatureChange?.(!!checked)}
          />
          <Label htmlFor="show-seller-sig" className="text-sm cursor-pointer">Include Seller Signature</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-buyer-sig"
            checked={showBuyerSignature}
            onCheckedChange={(checked) => onShowBuyerSignatureChange?.(!!checked)}
          />
          <Label htmlFor="show-buyer-sig" className="text-sm cursor-pointer">Include Buyer Signature</Label>
        </div>
      </div>
      )}

      {/* A4 proportioned invoice preview */}
      <Card className="p-6 bg-white border-2 mx-auto" style={{ fontFamily }}>
        {/* Header with Logo - Bill of Sale only shows here, standard invoice integrates into layout */}
        {isBillOfSale && (
          <div className={`mb-4 ${getHeaderAlignmentClass()}`}>
            {showLogo && logoUrl && (
              <img src={logoUrl} alt="Company Logo" className="max-h-16 max-w-[200px] object-contain mb-2" style={headerAlignment === 'center' ? { margin: '0 auto 8px' } : headerAlignment === 'right' ? { marginLeft: 'auto', marginBottom: 8 } : { marginBottom: 8 }} />
            )}
            <h2 className="text-xl font-bold" style={{ color: primaryColor }}>{documentTitle.toUpperCase()}</h2>
          </div>
        )}
        {!isBillOfSale && showLogo && logoUrl && (
          <div className="mb-2" style={headerAlignment === 'right' ? { textAlign: 'right' } : headerAlignment === 'center' ? { textAlign: 'center' } : {}}>
            <img src={logoUrl} alt="Company Logo" className="max-h-16 max-w-[200px] object-contain" style={headerAlignment === 'center' ? { margin: '0 auto' } : headerAlignment === 'right' ? { marginLeft: 'auto' } : {}} />
          </div>
        )}

        {isBillOfSale && <Separator className="my-3" />}

        {/* Seller / Buyer Boxes - Side by Side for Bill of Sale */}
        {isBillOfSale ? (
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Seller Box */}
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-1" style={{ backgroundColor: `${primaryColor}20` }}>
                <span className="text-xs font-semibold" style={{ color: primaryColor }}>From (Seller)</span>
              </div>
              <div className="p-3 text-xs space-y-1">
                <p className="font-bold">{organizationName || 'Your Company'}</p>
                {organizationAddress && <p className="text-muted-foreground whitespace-pre-line">{organizationAddress}</p>}
                {organizationEmail && <p style={{ color: primaryColor }}>{organizationEmail}</p>}
                {organizationPhone && <p>{organizationPhone}</p>}
              </div>
            </div>

            {/* Buyer Box */}
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-1" style={{ backgroundColor: `${secondaryColor}20` }}>
                <span className="text-xs font-semibold" style={{ color: secondaryColor }}>To (Buyer)</span>
              </div>
              <div className="p-3 text-xs space-y-1">
                <p className="font-bold">{buyerName || customerName || 'Customer Name'}</p>
                {attentionOf && <p className="text-muted-foreground">Attn: {attentionOf}</p>}
                {buyerAddress && (
                  <p className="text-muted-foreground whitespace-pre-line">
                    {buyerAddress}
                  </p>
                )}
                {buyerEmail && <p style={{ color: primaryColor }}>{buyerEmail}</p>}
                {buyerPhone && <p>{buyerPhone}</p>}
              </div>
            </div>
          </div>
        ) : (
          /* Standard Invoice Layout */
          <div className="mb-4">
            {/* Title + Company Info */}
            <div className={`flex ${headerAlignment === 'right' ? 'flex-row-reverse' : ''} justify-between items-start mb-1`}>
              <div className={getHeaderAlignmentClass()}>
                <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>{documentTitle.toUpperCase()}</h2>
                <p className="text-sm text-muted-foreground">#{invoiceNumber}</p>
              </div>
              <div className={`text-sm ${headerAlignment === 'right' ? 'text-left' : 'text-right'}`}>
                <p className="font-semibold">{organizationName || 'Your Company'}</p>
                {organizationAddress && <p className="text-muted-foreground whitespace-pre-line">{organizationAddress}</p>}
                {organizationPhone && organizationEmail && (
                  <p className="text-muted-foreground">{organizationPhone} | {organizationEmail}</p>
                )}
                {organizationPhone && !organizationEmail && <p className="text-muted-foreground">{organizationPhone}</p>}
                {!organizationPhone && organizationEmail && <p className="text-muted-foreground">{organizationEmail}</p>}
              </div>
            </div>

            <Separator className="my-3" />

            {/* Date / Due / Bill To */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs border-b pb-1 mb-1">Date</p>
                <p className="font-medium">{format(parseLocalDate(invoiceDate), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs border-b pb-1 mb-1">Due</p>
                <p className="font-medium">{format(parseLocalDate(dueDate), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs border-b pb-1 mb-1">Bill To</p>
                <p className="font-semibold">{buyerName || customerName || 'Customer Name'}</p>
                {attentionOf && <p className="text-muted-foreground">Attn: {attentionOf}</p>}
                {buyerEmail && <p className="text-muted-foreground">{buyerEmail}</p>}
                {buyerPhone && <p className="text-muted-foreground">{buyerPhone}</p>}
                {buyerAddress && <p className="text-muted-foreground whitespace-pre-line">{buyerAddress}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Tax Registration Badges */}
        {(dealerPermitNumber || gstHstNumber || pstNumber) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {dealerPermitNumber && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                Dealer Permit#: {dealerPermitNumber}
              </Badge>
            )}
            {gstHstNumber && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                GST/HST#: {gstHstNumber}
              </Badge>
            )}
            {pstNumber && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                PST#: {pstNumber}
              </Badge>
            )}
          </div>
        )}

        {/* Document # and Date - Bill of Sale only */}
        {isBillOfSale && (
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Document #:</p>
              <p className="font-medium">{invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Date:</p>
              <p className="font-medium">{format(parseLocalDate(invoiceDate), 'yyyy-MM-dd')}</p>
            </div>
          </div>
        )}

        {/* Vehicle / Item Details (Custom Fields) */}
        {populatedCustomFields.length > 0 && (
          <div className="mb-4 border rounded-lg overflow-hidden">
            <div className="px-3 py-1" style={{ backgroundColor: `${primaryColor}20` }}>
              <span className="text-xs font-semibold" style={{ color: primaryColor }}>Vehicle / Item Details</span>
            </div>
            <div className="p-3 grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
              {populatedCustomFields.map((field) => (
                <div key={field.id}>
                  <span className="text-muted-foreground">{field.label}: </span>
                  <span className="font-medium">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr style={tableHeaderStyle}>
                {showLineNumbers && (
                  <th className={`text-center p-2 text-xs font-semibold w-8 ${!isFilledHeader ? 'text-foreground' : ''}`}>#</th>
                )}
                <th className={`text-left p-2 text-xs font-semibold ${!isFilledHeader ? 'text-foreground' : ''}`}>Description</th>
                {showQuantityColumn && (
                  <th className={`text-center p-2 text-xs font-semibold w-12 ${!isFilledHeader ? 'text-foreground' : ''}`}>Qty</th>
                )}
                {showRateColumn && (
                  <th className={`text-right p-2 text-xs font-semibold w-20 ${!isFilledHeader ? 'text-foreground' : ''}`}>Price</th>
                )}
                {showTaxColumn && !isBillOfSale && (
                  <th className={`text-center p-2 text-xs font-semibold w-16 ${!isFilledHeader ? 'text-foreground' : ''}`}>Tax</th>
                )}
                <th className={`text-right p-2 text-xs font-semibold w-24 ${!isFilledHeader ? 'text-foreground' : ''}`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
                return (
                  <tr key={index} className="border-t">
                    {showLineNumbers && (
                      <td className="p-2 text-xs text-center text-muted-foreground">{index + 1}</td>
                    )}
                    <td className="p-2 text-xs">
                      {line.description || '-'}
                      {line.notes && (
                        <p className="text-[10px] italic text-muted-foreground mt-0.5">{line.notes}</p>
                      )}
                    </td>
                    {showQuantityColumn && (
                      <td className="p-2 text-xs text-center">{line.quantity}</td>
                    )}
                    {showRateColumn && (
                      <td className="p-2 text-xs text-right">{formatCurrency(Number(line.unit_price) || 0)}</td>
                    )}
                    {showTaxColumn && !isBillOfSale && (
                      <td className="p-2 text-xs text-center">{line.tax_rate ? `${line.tax_rate}%` : '-'}</td>
                    )}
                    <td className="p-2 text-xs text-right font-medium">{formatCurrency(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tax Exemptions */}
        {(isGstHstExempt || isPstExempt) && (
          <div className="mb-4 p-2 border rounded-lg" style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: primaryColor }}>Tax Exemptions Applied</p>
            <div className="flex flex-wrap gap-2">
              {isGstHstExempt && <Badge variant="secondary" className="text-xs">GST/HST Exempt</Badge>}
              {isPstExempt && <Badge variant="secondary" className="text-xs">PST Exempt</Badge>}
            </div>
            {exemptionReason && (
              <p className="text-xs mt-1" style={{ color: `${primaryColor}cc` }}>{exemptionReason}</p>
            )}
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {(discountAmount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount:</span>
                <span>-{formatCurrency(discountAmount || 0)}</span>
              </div>
            )}
            {(shippingCharges ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping:</span>
                <span>{formatCurrency(shippingCharges || 0)}</span>
              </div>
            )}
            {(adjustment ?? 0) !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{adjustmentLabel}:</span>
                <span>{formatCurrency(adjustment || 0)}</span>
              </div>
            )}
            {isBillOfSale ? (
              <>
                {!isGstHstExempt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST/HST ({gstHstRate}%):</span>
                    <span>{formatCurrency(isGstHstExempt ? 0 : subtotal * (gstHstRate / 100))}</span>
                  </div>
                )}
                {pstRate > 0 && !isPstExempt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PST ({pstRate}%):</span>
                    <span>{formatCurrency(isPstExempt ? 0 : subtotal * (pstRate / 100))}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-base">
              <span>Total:</span>
              <span style={isBillOfSale ? { color: primaryColor } : {}}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Balance Due - Standard Invoice */}
        {!isBillOfSale && (
          <div className="flex justify-end mb-4">
            <div className="w-72 border rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-3 bg-muted">
                <span className="font-bold text-base">Balance Due</span>
                <span className="font-bold text-base">{formatCurrency(balanceDue ?? total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        {showPaymentInstructions && paymentInstructions && (
          <div className="mb-4 p-3 border rounded-lg" style={{ backgroundColor: `${primaryColor}08`, borderColor: `${primaryColor}20` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: primaryColor }}>Payment Instructions</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line">{paymentInstructions}</p>
          </div>
        )}

        {/* Accepted Payment Methods - Clickable Tabs */}
        {enableOnlinePayments && (creditCardEnabled || achEnabled || interacEnabled) && (
          <PaymentMethodsTabs
            primaryColor={primaryColor}
            creditCardEnabled={creditCardEnabled}
            achEnabled={achEnabled}
            interacEnabled={interacEnabled}
            ccInstructions={ccInstructions}
            achInstitution={achInstitution}
            achAccountName={achAccountNameProp}
            achAccountNumber={achAccountNumberProp}
            achTransitNumber={achTransitNumberProp}
            etransferEmail={etransferEmail}
            ccPaymentUrl={ccPaymentUrl}
            onPay={onPayOnline}
            payAmount={onPayOnline ? (balanceDue ?? total) : undefined}
            payCurrency={currency}
            payingMethod={payingMethod}
          />
        )}

        {/* Notes & Terms */}
        {(notes || terms) && (
          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            {notes && (
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Notes</p>
                <p className="text-muted-foreground">{notes}</p>
              </div>
            )}
            {terms && (
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Terms</p>
                <p className="text-muted-foreground">{terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Signatures Section */}
        {(showSellerSignature || showBuyerSignature || isBillOfSale) && (
          <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t">
            {(showSellerSignature || isBillOfSale) && (
              <div>
                <p className="text-xs font-semibold mb-2">Seller Signature</p>
                {sellerSignature ? (
                  <img src={sellerSignature} alt="Seller Signature" className="h-12 object-contain" />
                ) : (
                  <div className="h-10 border-b-2 border-dashed border-muted-foreground/40"></div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{organizationName || ''}</p>
              </div>
            )}
            {(showBuyerSignature || isBillOfSale) && (
              <div>
                <p className="text-xs font-semibold mb-2">Buyer Signature</p>
                {buyerSignature ? (
                  <img src={buyerSignature} alt="Buyer Signature" className="h-12 object-contain" />
                ) : (
                  <div className="h-10 border-b-2 border-dashed border-muted-foreground/40"></div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{buyerName || customerName || ''}</p>
              </div>
            )}
          </div>
        )}

        {/* Barcode */}
        <div className="mt-6 pt-4 border-t text-center">
          <svg ref={barcodeRef} className="mx-auto"></svg>
          <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>{invoiceNumber}</p>
        </div>

        {/* Footer Text */}
        {footerText && (
          <div className="mt-4 pt-3 border-t text-center">
            <p className="text-xs text-muted-foreground">{footerText}</p>
          </div>
        )}

        {/* Footer - Transfer Notice */}
        {isBillOfSale && (
          <div className="mt-4 pt-3 border-t text-center">
            <p className="text-xs" style={{ color: primaryColor }}>
              This Bill of Sale transfers ownership of the above item(s) from seller to buyer.
            </p>
            <p className="text-xs text-muted-foreground mt-1">Powered by eFinSuite Globe</p>
          </div>
        )}
      </Card>
    </div>
  );
}
