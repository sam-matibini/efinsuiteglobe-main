import { useState, useEffect } from 'react';
import { FileText, Eye, Palette, CreditCard, Building2, LayoutGrid, Type } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceCustomFieldsSettings } from './InvoiceCustomFieldsSettings';
import { InvoiceLogoUpload } from './InvoiceLogoUpload';
import { BillOfSalePreview } from './BillOfSalePreview';

const TEMPLATE_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'bill_of_sale', label: 'Bill of Sale' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'quote', label: 'Quote / Estimate' },
];

const TEMPLATE_STYLES = [
  { value: 'modern', label: 'Modern', description: 'Clean lines with accent colors' },
  { value: 'classic', label: 'Classic', description: 'Traditional professional layout' },
  { value: 'minimal', label: 'Minimal', description: 'Simple and understated' },
  { value: 'bold', label: 'Bold', description: 'Strong colors and typography' },
];

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter (Default)' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Roboto', label: 'Roboto' },
];

const DATE_FORMATS = [
  { value: 'mdy', label: 'MM/DD/YYYY', example: '01/15/2025' },
  { value: 'dmy', label: 'DD/MM/YYYY', example: '15/01/2025' },
  { value: 'ymd', label: 'YYYY-MM-DD', example: '2025-01-15' },
  { value: 'iso', label: 'ISO 8601', example: '2025-01-15' },
  { value: 'long', label: 'Long Format', example: 'January 15, 2025' },
];

const HEADER_ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const ACCENT_STYLES = [
  { value: 'line', label: 'Line Border' },
  { value: 'filled', label: 'Filled Header' },
  { value: 'none', label: 'No Accent' },
];

export function InvoiceTemplateSettingsTab() {
  const { organization, isLoading } = useCurrentOrganization();
  const queryClient = useQueryClient();

  // Template settings state
  const [templateType, setTemplateType] = useState('invoice');
  const [customTitle, setCustomTitle] = useState('INVOICE');
  const [templateStyle, setTemplateStyle] = useState('modern');
  const [primaryColor, setPrimaryColor] = useState('#1e40af');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [dateFormat, setDateFormat] = useState('mdy');
  const [headerAlignment, setHeaderAlignment] = useState('left');
  const [accentStyle, setAccentStyle] = useState('line');
  
  // Column visibility
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [showTaxColumn, setShowTaxColumn] = useState(true);
  const [showQuantityColumn, setShowQuantityColumn] = useState(true);
  const [showRateColumn, setShowRateColumn] = useState(true);
  
  // Invoice settings (from existing tab)
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [invoiceNextNumber, setInvoiceNextNumber] = useState(1001);
  const [invoiceDefaultTerms, setInvoiceDefaultTerms] = useState('30');
  const [invoiceDefaultNotes, setInvoiceDefaultNotes] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [invoiceShowLogo, setInvoiceShowLogo] = useState(true);
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState<string | null>(null);
  const [invoiceShowPaymentInstructions, setInvoiceShowPaymentInstructions] = useState(true);
  const [invoicePaymentInstructions, setInvoicePaymentInstructions] = useState('');

  // Payment integrations
  const [enableOnlinePayments, setEnableOnlinePayments] = useState(false);
  const [achEnabled, setAchEnabled] = useState(false);
  const [creditCardEnabled, setCreditCardEnabled] = useState(false);
  const [interacEnabled, setInteracEnabled] = useState(false);

  // Sync form with organization data
  useEffect(() => {
    if (organization) {
      // Cast to any for new fields not yet in types.ts
      const org = organization as unknown as Record<string, unknown>;
      
      // Template settings
      setTemplateType((org.invoice_template_type as string) || 'invoice');
      setCustomTitle((org.invoice_custom_title as string) || 'INVOICE');
      setTemplateStyle((org.invoice_template_style as string) || 'modern');
      setPrimaryColor((org.invoice_primary_color as string) || '#1e40af');
      setSecondaryColor((org.invoice_secondary_color as string) || '#64748b');
      setFontFamily((org.invoice_font_family as string) || 'Inter');
      setDateFormat((org.invoice_date_format as string) || 'mdy');
      setHeaderAlignment((org.invoice_header_alignment as string) || 'left');
      setAccentStyle((org.invoice_accent_style as string) || 'line');
      
      // Column visibility
      setShowLineNumbers((org.invoice_show_line_numbers as boolean) ?? true);
      setShowTaxColumn((org.invoice_show_tax_column as boolean) ?? true);
      setShowQuantityColumn((org.invoice_show_quantity_column as boolean) ?? true);
      setShowRateColumn((org.invoice_show_rate_column as boolean) ?? true);
      
      // Existing invoice settings
      setInvoicePrefix(organization.invoice_prefix || 'INV-');
      setInvoiceNextNumber(organization.invoice_next_number || 1001);
      setInvoiceDefaultTerms(String(organization.invoice_default_terms || 30));
      setInvoiceDefaultNotes(organization.invoice_default_notes || '');
      setInvoiceFooter(organization.invoice_footer || '');
      setInvoiceShowLogo(organization.invoice_show_logo ?? true);
      setInvoiceLogoUrl((org.invoice_logo_url as string) || null);
      setInvoiceShowPaymentInstructions(organization.invoice_show_payment_instructions ?? true);
      setInvoicePaymentInstructions(organization.invoice_payment_instructions || '');
      
      // Payment settings
      setEnableOnlinePayments((org.invoice_enable_online_payments as boolean) ?? false);
      setAchEnabled((org.invoice_ach_enabled as boolean) ?? false);
      setCreditCardEnabled((org.invoice_credit_card_enabled as boolean) ?? false);
      setInteracEnabled((org.invoice_interac_enabled as boolean) ?? false);
    }
  }, [organization]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No organization');
      
      const { error } = await supabase
        .from('organizations')
        .update({
          // Template settings
          invoice_template_type: templateType,
          invoice_custom_title: customTitle,
          invoice_template_style: templateStyle,
          invoice_primary_color: primaryColor,
          invoice_secondary_color: secondaryColor,
          invoice_font_family: fontFamily,
          invoice_date_format: dateFormat,
          invoice_header_alignment: headerAlignment,
          invoice_accent_style: accentStyle,
          
          // Column visibility
          invoice_show_line_numbers: showLineNumbers,
          invoice_show_tax_column: showTaxColumn,
          invoice_show_quantity_column: showQuantityColumn,
          invoice_show_rate_column: showRateColumn,
          
          // Invoice settings
          invoice_prefix: invoicePrefix,
          invoice_next_number: invoiceNextNumber,
          invoice_default_terms: parseInt(invoiceDefaultTerms),
          invoice_default_notes: invoiceDefaultNotes || null,
          invoice_footer: invoiceFooter || null,
          invoice_show_logo: invoiceShowLogo,
          invoice_logo_url: invoiceLogoUrl,
          invoice_show_payment_instructions: invoiceShowPaymentInstructions,
          invoice_payment_instructions: invoicePaymentInstructions || null,
          
          // Payment settings
          invoice_enable_online_payments: enableOnlinePayments,
          invoice_ach_enabled: achEnabled,
          invoice_credit_card_enabled: creditCardEnabled,
          invoice_interac_enabled: interacEnabled,
        } as Record<string, unknown>)
        .eq('id', organization.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Invoice template settings saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!organization) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground mb-2">No Organization Found</h2>
        <p className="text-muted-foreground">Create an organization to configure invoice settings.</p>
      </Card>
    );
  }

  const sampleInvoiceNumber = `${invoicePrefix}${String(invoiceNextNumber).padStart(4, '0')}`;

  return (
    <div className="space-y-6">
      {/* Document Type & Title */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <FileText className="w-5 h-5 inline-block mr-2" />
          Document Type & Numbering
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={templateType} onValueChange={setTemplateType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customTitle">Custom Title</Label>
            <Input
              id="customTitle"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value.toUpperCase())}
              placeholder="INVOICE"
              className="uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoicePrefix">Number Prefix</Label>
            <Input
              id="invoicePrefix"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="INV-"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceNextNumber">Next Number</Label>
            <Input
              id="invoiceNextNumber"
              type="number"
              value={invoiceNextNumber}
              onChange={(e) => setInvoiceNextNumber(parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>
        </div>
        <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-3">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Preview:</span>
          <Badge variant="secondary" className="font-mono">{sampleInvoiceNumber}</Badge>
        </div>
      </Card>

      {/* Style & Branding */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <Palette className="w-5 h-5 inline-block mr-2" />
          Style & Branding
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label>Template Style</Label>
            <Select value={templateStyle} onValueChange={setTemplateStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_STYLES.map(style => (
                  <SelectItem key={style.value} value={style.value}>
                    <div>
                      <p className="font-medium">{style.label}</p>
                      <p className="text-xs text-muted-foreground">{style.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 font-mono"
                placeholder="#1e40af"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Secondary Color</Label>
            <div className="flex gap-2">
              <Input
                id="secondaryColor"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 font-mono"
                placeholder="#64748b"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Font Family</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map(font => (
                  <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Logo Upload Section */}
        <div className="mb-6">
          <Label className="mb-3 block">Invoice/Bill of Sale Logo</Label>
          <InvoiceLogoUpload
            organizationId={organization.id}
            currentLogoUrl={invoiceLogoUrl}
            onLogoChange={(url) => {
              setInvoiceLogoUrl(url);
              // Auto-save logo URL immediately after upload
              if (url !== invoiceLogoUrl) {
                supabase
                  .from('organizations')
                  .update({ invoice_logo_url: url } as Record<string, unknown>)
                  .eq('id', organization.id)
                  .then(({ error }) => {
                    if (error) {
                      console.error('Error saving logo URL:', error);
                    } else {
                      queryClient.invalidateQueries({ queryKey: ['organizations'] });
                    }
                  });
              }
            }}
          />
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Header Alignment</Label>
            <Select value={headerAlignment} onValueChange={setHeaderAlignment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEADER_ALIGNMENTS.map(align => (
                  <SelectItem key={align.value} value={align.value}>{align.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Accent Style</Label>
            <Select value={accentStyle} onValueChange={setAccentStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCENT_STYLES.map(style => (
                  <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-foreground text-sm">Show Logo</p>
              <p className="text-xs text-muted-foreground">Display logo on documents</p>
            </div>
            <Switch
              checked={invoiceShowLogo}
              onCheckedChange={setInvoiceShowLogo}
            />
          </div>
        </div>
      </Card>

      {/* Format & Layout */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <LayoutGrid className="w-5 h-5 inline-block mr-2" />
          Format & Layout
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(format => (
                  <SelectItem key={format.value} value={format.value}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{format.label}</span>
                      <span className="text-xs text-muted-foreground font-mono">{format.example}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default Payment Terms</Label>
            <Select value={invoiceDefaultTerms} onValueChange={setInvoiceDefaultTerms}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Due on Receipt</SelectItem>
                <SelectItem value="7">Net 7</SelectItem>
                <SelectItem value="14">Net 14</SelectItem>
                <SelectItem value="15">Net 15</SelectItem>
                <SelectItem value="30">Net 30</SelectItem>
                <SelectItem value="45">Net 45</SelectItem>
                <SelectItem value="60">Net 60</SelectItem>
                <SelectItem value="90">Net 90</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Column Visibility</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm">Line #</span>
              <Switch checked={showLineNumbers} onCheckedChange={setShowLineNumbers} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm">Quantity</span>
              <Switch checked={showQuantityColumn} onCheckedChange={setShowQuantityColumn} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm">Rate</span>
              <Switch checked={showRateColumn} onCheckedChange={setShowRateColumn} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm">Tax</span>
              <Switch checked={showTaxColumn} onCheckedChange={setShowTaxColumn} />
            </div>
          </div>
        </div>
      </Card>

      {/* Default Content */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <Type className="w-5 h-5 inline-block mr-2" />
          Default Content
        </h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoiceDefaultNotes">Default Notes</Label>
            <Textarea
              id="invoiceDefaultNotes"
              value={invoiceDefaultNotes}
              onChange={(e) => setInvoiceDefaultNotes(e.target.value)}
              placeholder="Notes that will appear on all invoices (e.g., Thank you for your business!)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceFooter">Invoice Footer</Label>
            <Textarea
              id="invoiceFooter"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder="Footer text for invoices (e.g., Terms & conditions, late payment policy)"
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Payment Instructions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <Building2 className="w-5 h-5 inline-block mr-2" />
          Payment Instructions
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Show Payment Instructions</p>
              <p className="text-sm text-muted-foreground">Display payment details on invoices</p>
            </div>
            <Switch
              checked={invoiceShowPaymentInstructions}
              onCheckedChange={setInvoiceShowPaymentInstructions}
            />
          </div>
          
          {invoiceShowPaymentInstructions && (
            <div className="space-y-2">
              <Label htmlFor="invoicePaymentInstructions">Payment Instructions</Label>
              <Textarea
                id="invoicePaymentInstructions"
                value={invoicePaymentInstructions}
                onChange={(e) => setInvoicePaymentInstructions(e.target.value)}
                placeholder="E.g., Bank transfer details, accepted payment methods, online payment link..."
                rows={4}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Online Payment Integration - Moved to Settings > Payments tab */}

      {/* Custom Fields for Bill of Sale */}
      <Card className="p-6">
        <InvoiceCustomFieldsSettings />
      </Card>

      {/* Bill of Sale Live Preview */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <Eye className="w-5 h-5 inline-block mr-2" />
          Bill of Sale Preview
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Live preview of your Bill of Sale template with current settings and custom fields.
        </p>
        <BillOfSalePreview
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          fontFamily={fontFamily}
          showLogo={invoiceShowLogo}
          logoUrl={invoiceLogoUrl}
          headerAlignment={headerAlignment}
          customTitle={templateType === 'bill_of_sale' ? customTitle : 'BILL OF SALE'}
        />
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          size="lg"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Invoice Settings'}
        </Button>
      </div>
    </div>
  );
}
