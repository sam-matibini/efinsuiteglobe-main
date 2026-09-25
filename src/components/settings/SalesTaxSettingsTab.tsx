import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesTaxSettings, useUpsertSalesTaxSettings, PROVINCE_TAX_RATES } from '@/hooks/useSalesTax';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getCountryLocalization,
  getPrimaryRetailTaxType,
  getRetailTaxTypes,
} from '@/data/countryLocalizations';
import { useAccounts } from '@/hooks/useAccounts';

interface FormValues {
  filing_frequency: string;
  province: string;
  gst_number: string;
  pst_number: string;
  qst_number: string;
  hst_number: string;
  vat_number: string;
  sales_tax_number: string;
  collect_gst: boolean;
  collect_pst: boolean;
  collect_hst: boolean;
  collect_vat: boolean;
  collect_sales_tax: boolean;
  gst_rate: number;
  pst_rate: number;
  hst_rate: number;
  vat_rate: number;
  sales_tax_rate: number;
  default_tax_code: string;
  claim_input_tax: boolean;
  claim_gst_hst_itc: boolean;
  claim_pst_paid: boolean;
  gst_paid_account_id: string;
  pst_paid_account_id: string;
  vat_paid_account_id: string;
}

export function SalesTaxSettingsTab() {
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: settings, isLoading: settingsLoading } = useSalesTaxSettings(organization?.id);
  const upsertSettings = useUpsertSalesTaxSettings();
  const { data: accounts = [] } = useAccounts(organization?.id);
  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'asset' && a.is_active && !a.is_header),
    [accounts],
  );
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'expense' && a.is_active && !a.is_header),
    [accounts],
  );

  // Get country and province from organization profile
  const orgCountry = organization?.country || 'CA';
  const orgProvince = organization?.province || 'ON';

  // Get localized data based on organization's country
  const countryLocalization = useMemo(() => getCountryLocalization(orgCountry), [orgCountry]);
  
  // Get jurisdiction name from localization
  const jurisdictionName = useMemo(() => {
    const jurisdiction = countryLocalization.jurisdictions.find(j => j.code === orgProvince);
    return jurisdiction?.name || orgProvince;
  }, [countryLocalization, orgProvince]);

  const form = useForm<FormValues>({
    defaultValues: {
      filing_frequency: 'quarterly',
      province: orgProvince,
      gst_number: '',
      pst_number: '',
      qst_number: '',
      hst_number: '',
      vat_number: '',
      sales_tax_number: '',
      collect_gst: false,
      collect_pst: false,
      collect_hst: true,
      collect_vat: false,
      collect_sales_tax: false,
      gst_rate: 5,
      pst_rate: 0,
      hst_rate: 13,
      vat_rate: 16,
      sales_tax_rate: 0,
      default_tax_code: 'HST',
      claim_input_tax: true,
      claim_gst_hst_itc: true,
      claim_pst_paid: false,
      gst_paid_account_id: '',
      pst_paid_account_id: '',
      vat_paid_account_id: '',
    },
  });

  // Apply province tax rates (for Canadian provinces)
  const applyProvinceRates = useCallback((province: string) => {
    if (orgCountry !== 'CA') return;
    
    const rates = PROVINCE_TAX_RATES[province];
    if (!rates) return;

    if (rates.type === 'HST') {
      form.setValue('collect_hst', true);
      form.setValue('collect_gst', false);
      form.setValue('collect_pst', false);
      form.setValue('hst_rate', rates.hst);
      form.setValue('gst_rate', 0);
      form.setValue('pst_rate', 0);
      form.setValue('default_tax_code', 'HST');
    } else if (rates.type === 'GST+PST') {
      form.setValue('collect_hst', false);
      form.setValue('collect_gst', true);
      form.setValue('collect_pst', true);
      form.setValue('hst_rate', 0);
      form.setValue('gst_rate', rates.gst);
      form.setValue('pst_rate', rates.pst);
      form.setValue('default_tax_code', province === 'QC' ? 'GST+QST' : 'GST+PST');
    } else {
      form.setValue('collect_hst', false);
      form.setValue('collect_gst', true);
      form.setValue('collect_pst', false);
      form.setValue('hst_rate', 0);
      form.setValue('gst_rate', rates.gst);
      form.setValue('pst_rate', 0);
      form.setValue('default_tax_code', 'GST');
    }
  }, [form, orgCountry]);

  // Apply country-specific defaults
  const applyCountryDefaults = useCallback(() => {
    if (orgCountry === 'CA') {
      applyProvinceRates(orgProvince);
    } else if (orgCountry === 'US') {
      form.setValue('collect_sales_tax', true);
      form.setValue('collect_hst', false);
      form.setValue('collect_gst', false);
      form.setValue('collect_pst', false);
      form.setValue('collect_vat', false);
      form.setValue('default_tax_code', 'SALES_TAX');
    } else {
      const primaryTax = getPrimaryRetailTaxType(orgCountry);
      form.setValue('collect_vat', !!primaryTax);
      form.setValue('vat_rate', primaryTax?.defaultRate || 16);
      form.setValue('collect_hst', false);
      form.setValue('collect_gst', false);
      form.setValue('collect_pst', false);
      form.setValue('collect_sales_tax', false);
      form.setValue('default_tax_code', primaryTax?.code || 'VAT');
      form.setValue('claim_input_tax', primaryTax?.isRecoverable !== false);
    }
  }, [form, orgCountry, orgProvince, countryLocalization, applyProvinceRates]);

  // Sync form with settings data and organization province
  useEffect(() => {
    if (settings) {
      form.reset({
        filing_frequency: settings.filing_frequency || 'quarterly',
        province: orgProvince,
        gst_number: settings.gst_number || '',
        pst_number: settings.pst_number || '',
        qst_number: settings.qst_number || '',
        hst_number: settings.hst_number || '',
        vat_number: settings.vat_number || '',
        sales_tax_number: settings.sales_tax_number || '',
        collect_gst: settings.collect_gst ?? false,
        collect_pst: settings.collect_pst ?? false,
        collect_hst: settings.collect_hst ?? true,
        collect_vat: settings.collect_vat ?? false,
        collect_sales_tax: settings.collect_sales_tax ?? false,
        gst_rate: settings.gst_rate ?? 5,
        pst_rate: settings.pst_rate ?? 0,
        hst_rate: settings.hst_rate ?? 13,
        vat_rate: settings.vat_rate ?? 16,
        sales_tax_rate: settings.sales_tax_rate ?? 0,
        default_tax_code: settings.default_tax_code || 'HST',
        claim_input_tax: settings.claim_input_tax ?? true,
        claim_gst_hst_itc: settings.claim_gst_hst_itc ?? true,
        claim_pst_paid: settings.claim_pst_paid ?? false,
        gst_paid_account_id: settings.gst_paid_account_id || '',
        pst_paid_account_id: settings.pst_paid_account_id || '',
        vat_paid_account_id: settings.vat_paid_account_id || '',
      });
    } else {
      // Apply country defaults for new settings
      applyCountryDefaults();
    }
    form.setValue('province', orgProvince);
  }, [settings, form, orgProvince, applyCountryDefaults]);

  const selectedProvince = form.watch('province') || orgProvince;
  const provinceRates = orgCountry === 'CA' ? PROVINCE_TAX_RATES[selectedProvince] : null;

  const onSubmit = async (data: FormValues) => {
    if (!organization?.id) return;
    await upsertSettings.mutateAsync({
      organizationId: organization.id,
      settings: {
        ...data,
        gst_paid_account_id: data.gst_paid_account_id || null,
        pst_paid_account_id: data.pst_paid_account_id || null,
        vat_paid_account_id: data.vat_paid_account_id || null,
      },
    });
  };

  const paidTaxTypes = useMemo(
    () => getRetailTaxTypes(orgCountry, 'paid'),
    [orgCountry],
  );

  const renderPaidTaxSettings = () => {
    if (paidTaxTypes.length === 0) {
      return (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Retail Sales Taxes Paid</h2>
          <p className="text-sm text-muted-foreground">
            This country does not levy a recoverable retail sales tax on purchases.
          </p>
        </Card>
      );
    }

    const showCanadianItc = orgCountry === 'CA';
    const showVatInput = orgCountry !== 'CA' && orgCountry !== 'US';
    const showUseTax = orgCountry === 'US';

    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Retail Sales Taxes Paid</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Track GST/HST Input Tax Credits (ITC), Input VAT, PST paid, and other taxes paid on purchases.
        </p>
        <div className="space-y-6">
          <div className="rounded-md border border-border p-3 space-y-1">
            {paidTaxTypes.map((tax) => (
              <p key={tax.code} className="text-sm">
                <span className="font-medium text-foreground">{tax.paidName}</span>
                <span className="text-muted-foreground"> — {tax.paidDescription}</span>
                {!tax.isRecoverable && (
                  <span className="ml-1 text-xs text-muted-foreground">(not recoverable)</span>
                )}
              </p>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Claim input tax on purchases</p>
              <p className="text-sm text-muted-foreground">
                Post recoverable taxes paid to an ITC / Input VAT asset account
              </p>
            </div>
            <Switch
              checked={form.watch('claim_input_tax')}
              onCheckedChange={(v) => form.setValue('claim_input_tax', v, { shouldDirty: true })}
            />
          </div>

          {showCanadianItc && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Claim GST/HST ITC</p>
                  <p className="text-sm text-muted-foreground">
                    Recover GST and HST paid on purchases as Input Tax Credits
                  </p>
                </div>
                <Switch
                  checked={form.watch('claim_gst_hst_itc')}
                  onCheckedChange={(v) => form.setValue('claim_gst_hst_itc', v, { shouldDirty: true })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Track PST paid</p>
                  <p className="text-sm text-muted-foreground">
                    Provincial sales tax paid is generally not recoverable except QST ITR in Quebec
                  </p>
                </div>
                <Switch
                  checked={form.watch('claim_pst_paid')}
                  onCheckedChange={(v) => form.setValue('claim_pst_paid', v, { shouldDirty: true })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>GST/HST Paid (ITC) account</Label>
                  <Select
                    value={form.watch('gst_paid_account_id') || '__none__'}
                    onValueChange={(v) => form.setValue('gst_paid_account_id', v === '__none__' ? '' : v, { shouldDirty: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select ITC asset account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {assetAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="font-mono mr-2">{a.code}</span>{a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>PST Paid account</Label>
                  <Select
                    value={form.watch('pst_paid_account_id') || '__none__'}
                    onValueChange={(v) => form.setValue('pst_paid_account_id', v === '__none__' ? '' : v, { shouldDirty: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select PST paid account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {[...expenseAccounts, ...assetAccounts].map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="font-mono mr-2">{a.code}</span>{a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {(showVatInput || showUseTax) && (
            <div className="space-y-2">
              <Label>
                {showUseTax ? 'Sales tax paid / Use tax account' : `${paidTaxTypes[0]?.paidName || 'Input VAT'} account`}
              </Label>
              <Select
                value={form.watch('vat_paid_account_id') || form.watch('gst_paid_account_id') || '__none__'}
                onValueChange={(v) => {
                  const next = v === '__none__' ? '' : v;
                  form.setValue('vat_paid_account_id', next, { shouldDirty: true });
                  form.setValue('gst_paid_account_id', next, { shouldDirty: true });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select paid tax account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {(showUseTax ? [...expenseAccounts, ...assetAccounts] : assetAccounts).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono mr-2">{a.code}</span>{a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>
    );
  };

  // Show loading state
  if (orgLoading || settingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  // Show create organization prompt if no organization
  if (!organization) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground mb-2">No Organization Found</h2>
        <p className="text-muted-foreground mb-4">Create an organization to configure sales tax settings.</p>
        <Button onClick={() => setCreateOrgOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      </Card>
    );
  }

  // Render Canadian tax settings
  const renderCanadianTaxSettings = () => (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Tax Jurisdiction</h2>
        <Alert className="mb-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Tax jurisdiction is determined by your organization's province/territory. 
            To change it, update your business address in the Organization tab.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Province/Territory</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={jurisdictionName}
                disabled
                className="bg-muted"
              />
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
            {provinceRates && (
              <p className="text-sm text-muted-foreground">
                Tax type: {provinceRates.type} 
                {provinceRates.type === 'HST' && ` (${provinceRates.hst}%)`}
                {provinceRates.type === 'GST+PST' && ` (GST ${provinceRates.gst}% + PST ${provinceRates.pst}%)`}
                {provinceRates.type === 'GST' && ` (${provinceRates.gst}%)`}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Filing Frequency</Label>
            <Select 
              value={form.watch('filing_frequency') || 'quarterly'} 
              onValueChange={(v) => form.setValue('filing_frequency', v, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select filing frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Tax Registration Numbers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(form.watch('collect_hst') || form.watch('collect_gst')) && (
            <div className="space-y-2">
              <Label>{form.watch('collect_hst') ? 'HST Number' : 'GST Number'}</Label>
              <Input 
                {...form.register(form.watch('collect_hst') ? 'hst_number' : 'gst_number')} 
                placeholder="123456789RT0001" 
              />
            </div>
          )}
          {form.watch('collect_pst') && selectedProvince !== 'QC' && (
            <div className="space-y-2">
              <Label>PST Number</Label>
              <Input {...form.register('pst_number')} placeholder="PST-1234-5678" />
            </div>
          )}
          {selectedProvince === 'QC' && (
            <div className="space-y-2">
              <Label>QST Number</Label>
              <Input {...form.register('qst_number')} placeholder="1234567890TQ0001" />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Tax Collection Settings</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Collect HST</p>
              <p className="text-sm text-muted-foreground">Harmonized Sales Tax (ON, NB, NL, NS, PE)</p>
            </div>
            <div className="flex items-center gap-4">
              {form.watch('collect_hst') && (
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-20 text-right"
                    {...form.register('hst_rate', { valueAsNumber: true })}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              )}
              <Switch 
                checked={form.watch('collect_hst')} 
                onCheckedChange={(v) => form.setValue('collect_hst', v, { shouldDirty: true })} 
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Collect GST</p>
              <p className="text-sm text-muted-foreground">Goods and Services Tax (Federal)</p>
            </div>
            <div className="flex items-center gap-4">
              {form.watch('collect_gst') && (
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-20 text-right"
                    {...form.register('gst_rate', { valueAsNumber: true })}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              )}
              <Switch 
                checked={form.watch('collect_gst')} 
                onCheckedChange={(v) => form.setValue('collect_gst', v, { shouldDirty: true })} 
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Collect PST/QST</p>
              <p className="text-sm text-muted-foreground">Provincial Sales Tax (BC, MB, SK) / Quebec Sales Tax</p>
            </div>
            <div className="flex items-center gap-4">
              {form.watch('collect_pst') && (
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-20 text-right"
                    {...form.register('pst_rate', { valueAsNumber: true })}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              )}
              <Switch 
                checked={form.watch('collect_pst')} 
                onCheckedChange={(v) => form.setValue('collect_pst', v, { shouldDirty: true })} 
              />
            </div>
          </div>
        </div>
      </Card>
    </>
  );

  // Render US tax settings
  const renderUSTaxSettings = () => {
    const taxConfig = countryLocalization.taxTypes.find(t => t.code === 'SALES_TAX');
    return (
      <>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Jurisdiction</h2>
          <Alert className="mb-4">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Tax jurisdiction is determined by your organization's state. 
              To change it, update your business address in the Organization tab.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>State</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={jurisdictionName}
                  disabled
                  className="bg-muted"
                />
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Filing Frequency</Label>
              <Select 
                value={form.watch('filing_frequency') || 'quarterly'} 
                onValueChange={(v) => form.setValue('filing_frequency', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select filing frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Registration Numbers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{taxConfig?.registrationLabel || 'Sales Tax Permit Number'}</Label>
              <Input 
                {...form.register('sales_tax_number')} 
                placeholder={taxConfig?.registrationPlaceholder || '12-3456789'} 
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Collection Settings</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{taxConfig?.name || 'Collect Sales Tax'}</p>
                <p className="text-sm text-muted-foreground">{taxConfig?.description || 'State and Local Sales Tax'}</p>
              </div>
              <div className="flex items-center gap-4">
                {form.watch('collect_sales_tax') && (
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      step="0.01"
                      className="w-20 text-right"
                      {...form.register('sales_tax_rate', { valueAsNumber: true })}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                )}
                <Switch 
                  checked={form.watch('collect_sales_tax')} 
                  onCheckedChange={(v) => form.setValue('collect_sales_tax', v, { shouldDirty: true })} 
                />
              </div>
            </div>
          </div>
        </Card>
      </>
    );
  };

  // Render VAT tax settings (ZM, KE, BI, etc.)
  const renderVATTaxSettings = () => {
    const taxConfig = getPrimaryRetailTaxType(orgCountry) || countryLocalization.taxTypes[0];
    return (
      <>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Jurisdiction</h2>
          <Alert className="mb-4">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Tax jurisdiction is determined by your organization's {countryLocalization.jurisdictionLabel.toLowerCase()}. 
              To change it, update your business address in the Organization tab.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{countryLocalization.jurisdictionLabel}</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={jurisdictionName}
                  disabled
                  className="bg-muted"
                />
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Filing Frequency</Label>
              <Select 
                value={form.watch('filing_frequency') || 'quarterly'} 
                onValueChange={(v) => form.setValue('filing_frequency', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select filing frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Registration Numbers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{taxConfig?.registrationLabel || 'Tax Registration Number'}</Label>
              <Input 
                {...form.register('vat_number')} 
                placeholder={taxConfig?.registrationPlaceholder || '1234567890'} 
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Collection Settings</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{taxConfig?.name || 'Collect VAT'}</p>
                <p className="text-sm text-muted-foreground">
                  {taxConfig?.description || 'Value Added Tax'}
                  {taxConfig?.paidName ? ` · Paid: ${taxConfig.paidName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {form.watch('collect_vat') && (
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      step="0.01"
                      className="w-20 text-right"
                      {...form.register('vat_rate', { valueAsNumber: true })}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                )}
                <Switch 
                  checked={form.watch('collect_vat')} 
                  onCheckedChange={(v) => form.setValue('collect_vat', v, { shouldDirty: true })} 
                />
              </div>
            </div>
          </div>
        </Card>
      </>
    );
  };

  // Determine which tax UI to render based on country
  const renderTaxSettings = () => {
    switch (orgCountry) {
      case 'CA':
        return renderCanadianTaxSettings();
      case 'US':
        return renderUSTaxSettings();
      default:
        return renderVATTaxSettings();
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {renderTaxSettings()}
      {renderPaidTaxSettings()}

      <div className="flex justify-end">
        <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={upsertSettings.isPending}>
          {upsertSettings.isPending ? 'Saving...' : 'Save Tax Settings'}
        </Button>
      </div>
    </form>
  );
}
