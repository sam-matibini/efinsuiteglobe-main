import { Eye, FileText, Car, User, Calendar, PenTool, MapPin, Phone, Mail, Building2, Receipt, CheckSquare, Square } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useInvoiceCustomFieldTemplates } from '@/hooks/useInvoiceCustomFieldTemplates';
import { format } from 'date-fns';

interface BillOfSalePreviewProps {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  showLogo?: boolean;
  logoUrl?: string | null;
  headerAlignment?: string;
  customTitle?: string;
}

export function BillOfSalePreview({
  primaryColor = '#1e40af',
  secondaryColor = '#64748b',
  fontFamily = 'Inter',
  showLogo = true,
  logoUrl,
  headerAlignment = 'left',
  customTitle = 'BILL OF SALE',
}: BillOfSalePreviewProps) {
  const { organization } = useCurrentOrganization();
  const { templates } = useInvoiceCustomFieldTemplates();

  // Filter templates for bill of sale
  const billOfSaleFields = templates.filter(
    t => t.document_type === 'all' || t.document_type === 'bill_of_sale'
  );

  // Build seller info from organization
  const sellerInfo = {
    name: organization?.name || 'Your Company Name',
    address: {
      line1: organization?.address_line1 || '123 Business Street',
      line2: organization?.address_line2 || '',
      city: organization?.city || 'Toronto',
      province: organization?.province || 'ON',
      postalCode: organization?.postal_code || 'M5V 1A1',
      country: organization?.country || 'Canada',
    },
    email: organization?.email || 'sales@company.com',
    phone: organization?.phone || '(416) 555-0123',
    // Tax registration numbers from organization settings
    dealerPermit: organization?.dealer_permit_number || 'DLR-12345',
    gstHstNumber: organization?.gst_hst_number || '123456789RT0001',
    pstNumber: organization?.pst_number || 'PST-1234-5678',
  };

  const sampleData = {
    documentNumber: 'BOS-0001',
    date: format(new Date(), 'MMM dd, yyyy'),
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy'),
    buyer: {
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '(604) 555-0199',
      address: '456 Buyer Lane',
      city: 'Vancouver',
      province: 'BC',
      postalCode: 'V6B 2K1',
      country: 'Canada',
    },
    items: [
      { description: '2022 Toyota Camry SE', qty: 1, price: 28500.00 },
    ],
    subtotal: 28500.00,
    gstHst: 1425.00,
    pst: 1995.00,
    total: 31920.00,
    isGstExempt: false,
    isPstExempt: false,
  };

  const getAlignment = () => {
    switch (headerAlignment) {
      case 'center': return 'text-center items-center';
      case 'right': return 'text-right items-end';
      default: return 'text-left items-start';
    }
  };

  return (
    <Card className="p-0 overflow-hidden shadow-lg">
      {/* Preview Header */}
      <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 border-b">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
        <Badge variant="secondary" className="ml-auto text-xs">Bill of Sale</Badge>
      </div>

      {/* Document Preview */}
      <div 
        className="p-6 bg-white min-h-[600px] text-foreground"
        style={{ fontFamily }}
      >
        {/* Header */}
        <div className={`flex flex-col ${getAlignment()} mb-4`}>
          {showLogo && (
            logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Company Logo" 
                className="h-12 object-contain mb-2"
              />
            ) : (
              <div className="h-12 w-24 mb-2 flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded bg-muted/20">
                <Building2 className="w-6 h-6 text-muted-foreground/40" />
              </div>
            )
          )}
          <h1 
            className="text-2xl font-bold tracking-tight"
            style={{ color: primaryColor }}
          >
            {customTitle}
          </h1>
        </div>

        <Separator className="my-3" style={{ backgroundColor: primaryColor + '20' }} />

        {/* Tax Registration Numbers */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: primaryColor + '10' }}>
            <Building2 className="w-3 h-3" style={{ color: primaryColor }} />
            <span className="font-medium">Dealer Permit#:</span>
            <span>{sellerInfo.dealerPermit}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: primaryColor + '10' }}>
            <Receipt className="w-3 h-3" style={{ color: primaryColor }} />
            <span className="font-medium">GST/HST#:</span>
            <span>{sellerInfo.gstHstNumber}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: primaryColor + '10' }}>
            <Receipt className="w-3 h-3" style={{ color: primaryColor }} />
            <span className="font-medium">PST#:</span>
            <span>{sellerInfo.pstNumber}</span>
          </div>
        </div>

        {/* Seller & Buyer Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          {/* Seller (From) */}
          <div className="p-3 rounded-lg border" style={{ borderColor: primaryColor + '30' }}>
            <div className="flex items-center gap-2 mb-2 font-medium" style={{ color: primaryColor }}>
              <MapPin className="w-4 h-4" />
              From (Seller)
            </div>
            <p className="font-semibold">{sellerInfo.name}</p>
            <p className="text-muted-foreground text-xs">{sellerInfo.address.line1}</p>
            {sellerInfo.address.line2 && <p className="text-muted-foreground text-xs">{sellerInfo.address.line2}</p>}
            <p className="text-muted-foreground text-xs">
              {sellerInfo.address.city}, {sellerInfo.address.province} {sellerInfo.address.postalCode}
            </p>
            <p className="text-muted-foreground text-xs">{sellerInfo.address.country}</p>
            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t text-xs">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3" style={{ color: primaryColor }} />
                <span>{sellerInfo.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" style={{ color: primaryColor }} />
                <span>{sellerInfo.phone}</span>
              </div>
            </div>
          </div>

          {/* Buyer (To) */}
          <div className="p-3 rounded-lg border" style={{ borderColor: secondaryColor + '30' }}>
            <div className="flex items-center gap-2 mb-2 font-medium" style={{ color: primaryColor }}>
              <User className="w-4 h-4" />
              To (Buyer)
            </div>
            <p className="font-semibold">{sampleData.buyer.name}</p>
            <p className="text-muted-foreground text-xs">{sampleData.buyer.address}</p>
            <p className="text-muted-foreground text-xs">
              {sampleData.buyer.city}, {sampleData.buyer.province} {sampleData.buyer.postalCode}
            </p>
            <p className="text-muted-foreground text-xs">{sampleData.buyer.country}</p>
            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t text-xs">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3" style={{ color: primaryColor }} />
                <span>{sampleData.buyer.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" style={{ color: primaryColor }} />
                <span>{sampleData.buyer.phone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: primaryColor }} />
            <span className="font-medium">Document #:</span>
            <span>{sampleData.documentNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: primaryColor }} />
            <span className="font-medium">Date:</span>
            <span>{sampleData.date}</span>
          </div>
        </div>

        {/* Custom Fields Preview */}
        {billOfSaleFields.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: secondaryColor + '40' }}>
            <div className="flex items-center gap-2 mb-2">
              <Car className="w-4 h-4" style={{ color: primaryColor }} />
              <span className="font-medium text-sm">Vehicle / Item Details</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {billOfSaleFields.slice(0, 8).map((field) => (
                <div key={field.id} className="flex justify-between">
                  <span className="text-muted-foreground">{field.label}:</span>
                  <span className="font-medium">
                    {field.default_value || `[${field.label}]`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: primaryColor + '10' }}>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-center p-2 font-medium w-16">Qty</th>
                <th className="text-right p-2 font-medium w-24">Price</th>
                <th className="text-right p-2 font-medium w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sampleData.items.map((item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">{item.description}</td>
                  <td className="p-2 text-center">{item.qty}</td>
                  <td className="p-2 text-right">${item.price.toLocaleString()}</td>
                  <td className="p-2 text-right font-medium">${(item.qty * item.price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tax Exemptions Section */}
        <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: primaryColor + '20', backgroundColor: primaryColor + '05' }}>
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4" style={{ color: primaryColor }} />
            <span className="font-medium text-sm">Tax Exemptions</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              {sampleData.isGstExempt ? (
                <CheckSquare className="w-4 h-4" style={{ color: primaryColor }} />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={sampleData.isGstExempt ? 'font-medium' : 'text-muted-foreground'}>
                GST/HST Exempt (Export Sale)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {sampleData.isPstExempt ? (
                <CheckSquare className="w-4 h-4" style={{ color: primaryColor }} />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={sampleData.isPstExempt ? 'font-medium' : 'text-muted-foreground'}>
                PST Exempt
              </span>
            </div>
          </div>
        </div>

        {/* Totals with Split Tax Display */}
        <div className="flex justify-end mb-4">
          <div className="w-56 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>${sampleData.subtotal.toLocaleString()}</span>
            </div>
            
            {/* Split Tax Display */}
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground flex items-center gap-1">
                GST/HST (5%):
                {sampleData.isGstExempt && <Badge variant="outline" className="text-[10px] px-1 py-0">EXEMPT</Badge>}
              </span>
              <span className={sampleData.isGstExempt ? 'line-through text-muted-foreground' : ''}>
                {sampleData.isGstExempt ? '$0.00' : `$${sampleData.gstHst.toLocaleString()}`}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground flex items-center gap-1">
                PST (7%):
                {sampleData.isPstExempt && <Badge variant="outline" className="text-[10px] px-1 py-0">EXEMPT</Badge>}
              </span>
              <span className={sampleData.isPstExempt ? 'line-through text-muted-foreground' : ''}>
                {sampleData.isPstExempt ? '$0.00' : `$${sampleData.pst.toLocaleString()}`}
              </span>
            </div>
            
            <Separator className="my-2" />
            <div className="flex justify-between py-1 font-bold text-base">
              <span>Total:</span>
              <span style={{ color: primaryColor }}>${sampleData.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PenTool className="w-4 h-4" style={{ color: primaryColor }} />
              Seller Signature
            </div>
            <div 
              className="h-12 border-b-2 border-dashed"
              style={{ borderColor: secondaryColor }}
            />
            <p className="text-xs text-muted-foreground">
              {sellerInfo.name}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PenTool className="w-4 h-4" style={{ color: primaryColor }} />
              Buyer Signature
            </div>
            <div 
              className="h-12 border-b-2 border-dashed"
              style={{ borderColor: secondaryColor }}
            />
            <p className="text-xs text-muted-foreground">
              {sampleData.buyer.name}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            This Bill of Sale transfers ownership of the above item(s) from seller to buyer.
          </p>
        </div>
      </div>
    </Card>
  );
}
