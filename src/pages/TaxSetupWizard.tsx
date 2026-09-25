/**
 * TaxSetupWizard — 4-step guided tax configuration.
 *
 * Steps:
 *   1. Country (auto-detected from organization, editable)
 *   2. Tax Types (auto-loaded from country preset, toggleable + editable rate)
 *   3. Registration numbers
 *   4. GL account mapping (collected + paid per tax type)
 *
 * Persists to:
 *   - tax_authorities (one per selected tax type)
 *   - tax_codes (one per selected tax type)
 *   - sales_tax_settings (registration numbers)
 *   - tax_account_mappings via tax_codes.gl_collected_account_id / gl_paid_account_id
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SearchableAccountSelect } from '@/components/journal/SearchableAccountSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronLeft, ChevronRight, Sparkles, Globe, ListChecks, FileText, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { COUNTRY_LOCALIZATIONS, type TaxTypeConfig } from '@/data/countryLocalizations';

interface SelectedTaxType extends TaxTypeConfig {
  selected: boolean;
  rate: number;
  registrationNumber: string;
  glCollectedAccountId: string | null;
  glPaidAccountId: string | null;
  filingFrequency: 'monthly' | 'quarterly' | 'annually' | 'semi_annually';
}

const STEPS = [
  { id: 1, label: 'Country', icon: Globe },
  { id: 2, label: 'Tax Types', icon: ListChecks },
  { id: 3, label: 'Registration', icon: FileText },
  { id: 4, label: 'GL Mapping', icon: Wallet },
];

export default function TaxSetupWizard() {
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { data: accounts = [] } = useAccounts(organization?.id);
  const isReadOnly = useIsReadOnly();

  const [step, setStep] = useState(1);
  const [country, setCountry] = useState<string>('CA');
  const [taxTypes, setTaxTypes] = useState<SelectedTaxType[]>([]);
  const [saving, setSaving] = useState(false);

  // Auto-detect country from organization
  useEffect(() => {
    if (!organization?.country) return;
    const upper = organization.country.toUpperCase();
    if (COUNTRY_LOCALIZATIONS[upper]) {
      setCountry(upper);
      return;
    }
    const match = Object.entries(COUNTRY_LOCALIZATIONS).find(
      ([, loc]) => loc.name.toLowerCase() === organization.country!.toLowerCase(),
    );
    if (match) setCountry(match[0]);
  }, [organization?.country]);

  // Load tax type defaults whenever country changes
  useEffect(() => {
    const loc = COUNTRY_LOCALIZATIONS[country];
    if (!loc) {
      setTaxTypes([]);
      return;
    }
    setTaxTypes(
      loc.taxTypes.map((t) => ({
        ...t,
        selected: true,
        rate: t.defaultRate,
        registrationNumber: '',
        glCollectedAccountId: null,
        glPaidAccountId: null,
        filingFrequency: 'quarterly',
      })),
    );
  }, [country]);

  // Suggest GL accounts (Liability for collected, Asset for paid/ITC)
  const liabilityAccounts = useMemo(
    () =>
      accounts.filter(
        (a: any) =>
          a.account_type === 'liability' &&
          a.is_active !== false &&
          (a.name?.toLowerCase().includes('tax') ||
            a.name?.toLowerCase().includes('payable') ||
            a.code?.startsWith('21') ||
            a.code?.startsWith('22')),
      ),
    [accounts],
  );

  const assetAccounts = useMemo(
    () =>
      accounts.filter(
        (a: any) =>
          a.account_type === 'asset' &&
          a.is_active !== false &&
          (a.name?.toLowerCase().includes('tax') ||
            a.name?.toLowerCase().includes('itc') ||
            a.name?.toLowerCase().includes('recoverable') ||
            a.code?.startsWith('11') ||
            a.code?.startsWith('12')),
      ),
    [accounts],
  );

  // Expense accounts eligible for non-recoverable tax (e.g. PST Paid in BC/SK/MB).
  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a: any) =>
          a.account_type === 'expense' &&
          a.is_active !== false &&
          (a.name?.toLowerCase().includes('tax') ||
            a.name?.toLowerCase().includes('pst') ||
            a.name?.toLowerCase().includes('non-recoverable') ||
            a.name?.toLowerCase().includes('non recoverable')),
      ),
    [accounts],
  );

  const updateTaxType = (idx: number, patch: Partial<SelectedTaxType>) => {
    setTaxTypes((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    );
  };

  const canProceed = useMemo(() => {
    if (step === 1) return Boolean(country && COUNTRY_LOCALIZATIONS[country]);
    if (step === 2) return taxTypes.some((t) => t.selected && t.rate >= 0);
    return true;
  }, [step, country, taxTypes]);

  const handleSave = async () => {
    if (!organization?.id) return;
    setSaving(true);
    try {
      const loc = COUNTRY_LOCALIZATIONS[country];
      const selected = taxTypes.filter((t) => t.selected);

      // 1) Find country_id from countries table (if it exists)
      let countryId: string | null = null;
      const { data: countryRow } = await supabase
        .from('countries')
        .select('id')
        .eq('code', country)
        .maybeSingle();
      countryId = (countryRow as any)?.id ?? null;

      // 2) Upsert tax_authorities
      const authorityIdMap = new Map<string, string>();
      for (const t of selected) {
        const { data: existing } = await supabase
          .from('tax_authorities')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('name', `${loc.name} ${t.code}`)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('tax_authorities')
            .update({
              filing_frequency: t.filingFrequency,
              registration_number: t.registrationNumber || null,
              reporting_currency: loc.currency,
              country_id: countryId,
              region: loc.code,
            })
            .eq('id', (existing as any).id);
          authorityIdMap.set(t.code, (existing as any).id);
        } else {
          const { data: created, error } = await supabase
            .from('tax_authorities')
            .insert({
              organization_id: organization.id,
              name: `${loc.name} ${t.code}`,
              country_id: countryId,
              region: loc.code,
              filing_frequency: t.filingFrequency,
              reporting_currency: loc.currency,
              registration_number: t.registrationNumber || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          authorityIdMap.set(t.code, (created as any).id);
        }
      }

      // 3) Upsert tax_codes
      for (const t of selected) {
        const { data: existing } = await supabase
          .from('tax_codes')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('code', t.code)
          .maybeSingle();

        const payload: any = {
          rate: t.rate,
          name: t.name,
          tax_type: 'both',
          is_recoverable: true,
          is_compound: false,
          is_active: true,
          gl_collected_account_id: t.glCollectedAccountId,
          gl_paid_account_id: t.glPaidAccountId,
          tax_authority_id: authorityIdMap.get(t.code) ?? null,
        };

        if (existing) {
          await supabase.from('tax_codes').update(payload).eq('id', (existing as any).id);
        } else {
          await supabase.from('tax_codes').insert({
            organization_id: organization.id,
            code: t.code,
            ...payload,
          });
        }
      }

      // 4) Save registration numbers to sales_tax_settings (legacy fields)
      const settingsPatch: Record<string, any> = {};
      selected.forEach((t) => {
        if (!t.registrationNumber) return;
        const lc = t.code.toLowerCase();
        if (lc === 'gst') settingsPatch.gst_number = t.registrationNumber;
        else if (lc === 'hst') settingsPatch.hst_number = t.registrationNumber;
        else if (lc === 'pst') settingsPatch.pst_number = t.registrationNumber;
        else if (lc === 'qst') settingsPatch.qst_number = t.registrationNumber;
        else if (lc === 'vat' || lc === 'tva' || lc === 'ust') settingsPatch.vat_number = t.registrationNumber;
        else settingsPatch.sales_tax_number = t.registrationNumber;
      });

      const { data: existingSettings } = await supabase
        .from('sales_tax_settings')
        .select('id')
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (existingSettings) {
        await supabase
          .from('sales_tax_settings')
          .update(settingsPatch)
          .eq('id', (existingSettings as any).id);
      } else {
        await supabase.from('sales_tax_settings').insert({
          organization_id: organization.id,
          ...settingsPatch,
        });
      }

      toast.success('Tax setup completed');
      navigate('/tax');
    } catch (err: any) {
      console.error('Tax setup save failed', err);
      toast.error(err.message || 'Failed to save tax setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Tax Setup Wizard
          </h1>
          <p className="text-muted-foreground">
            Configure sales tax for your organization in 4 steps.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isDone && 'border-success bg-success text-success-foreground',
                    !isActive && !isDone && 'border-border text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    step > s.id ? 'bg-success' : 'bg-border',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <Card className="p-6">
        {/* STEP 1: Country */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Select your country</h2>
              <p className="text-sm text-muted-foreground">
                We'll auto-load the standard tax types and rates for your jurisdiction.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry} disabled={isReadOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Object.entries(COUNTRY_LOCALIZATIONS).map(([code, loc]) => (
                    <SelectItem key={code} value={code}>
                      {loc.name} ({code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {COUNTRY_LOCALIZATIONS[country] && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Tax regime</p>
                <p className="font-medium">
                  {COUNTRY_LOCALIZATIONS[country].taxRegimes.join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Reporting currency: {COUNTRY_LOCALIZATIONS[country].currency}
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Tax types */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Confirm tax types & rates</h2>
              <p className="text-sm text-muted-foreground">
                Toggle off any taxes you don't collect. Adjust rates if needed.
              </p>
            </div>
            <div className="space-y-3">
              {taxTypes.map((t, idx) => (
                <div
                  key={t.code}
                  className={cn(
                    'rounded-md border p-4 space-y-3 transition-colors',
                    t.selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={t.selected}
                        onCheckedChange={(v) => updateTaxType(idx, { selected: v })}
                        disabled={isReadOnly}
                      />
                      <div>
                        <p className="font-medium">{t.code} — {t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </div>
                    <Badge variant="outline">Default {t.defaultRate}%</Badge>
                  </div>
                  {t.selected && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div className="space-y-1">
                        <Label className="text-xs">Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={t.rate}
                          onChange={(e) =>
                            updateTaxType(idx, { rate: parseFloat(e.target.value) || 0 })
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Filing frequency</Label>
                        <Select
                          value={t.filingFrequency}
                          onValueChange={(v: any) =>
                            updateTaxType(idx, { filingFrequency: v })
                          }
                          disabled={isReadOnly}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="semi_annually">Semi-annual</SelectItem>
                            <SelectItem value="annually">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {taxTypes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No tax presets available for this country. You can configure tax codes
                  manually from the Sales Tax page.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Registration */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Registration numbers</h2>
              <p className="text-sm text-muted-foreground">
                Enter your tax registration numbers (these appear on invoices and returns).
              </p>
            </div>
            <div className="space-y-3">
              {taxTypes.filter((t) => t.selected).map((t, _, arr) => {
                const idx = taxTypes.indexOf(t);
                return (
                  <div key={t.code} className="space-y-1">
                    <Label>{t.registrationLabel}</Label>
                    <Input
                      placeholder={t.registrationPlaceholder}
                      value={t.registrationNumber}
                      onChange={(e) =>
                        updateTaxType(idx, { registrationNumber: e.target.value })
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                );
              })}
              {taxTypes.filter((t) => t.selected).length === 0 && (
                <p className="text-sm text-muted-foreground">No tax types selected.</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: GL mapping */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Map GL accounts</h2>
              <p className="text-sm text-muted-foreground">
                Choose the liability account that holds tax collected and the asset
                account that holds recoverable tax (ITC).
              </p>
            </div>
            <div className="space-y-3">
              {taxTypes.filter((t) => t.selected).map((t) => {
                const idx = taxTypes.indexOf(t);
                const isPst =
                  t.code === 'PST' || (t.code ?? '').toUpperCase().startsWith('PST');
                // PST paid is non-recoverable in BC/SK/MB → expense account.
                // Allow assets too for orgs that already mapped it as recoverable.
                const paidAccounts = isPst
                  ? [...expenseAccounts, ...assetAccounts]
                  : assetAccounts;
                const paidLabel = isPst
                  ? 'Tax paid (Non-Recoverable Expense)'
                  : 'Tax paid / ITC (Asset)';
                return (
                  <div
                    key={t.code}
                    className="rounded-md border border-border p-4 space-y-3"
                  >
                    <p className="font-medium">{t.code} — {t.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tax collected (Liability)</Label>
                        <SearchableAccountSelect
                          accounts={liabilityAccounts}
                          value={t.glCollectedAccountId ?? ''}
                          onValueChange={(v) =>
                            updateTaxType(idx, { glCollectedAccountId: v || null })
                          }
                          placeholder="Select account"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{paidLabel}</Label>
                        <SearchableAccountSelect
                          accounts={paidAccounts}
                          value={t.glPaidAccountId ?? ''}
                          onValueChange={(v) =>
                            updateTaxType(idx, { glPaidAccountId: v || null })
                          }
                          placeholder="Select account"
                          disabled={isReadOnly}
                        />
                        {isPst && (
                          <p className="text-xs text-muted-foreground">
                            PST paid on purchases is not recoverable from the CRA.
                            Map this to an expense account such as
                            "PST Paid (Non-Recoverable)".
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {liabilityAccounts.length === 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                  No liability accounts found. Create tax payable accounts in the
                  Chart of Accounts first, or skip and assign mappings later.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || saving}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canProceed || saving}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || isReadOnly}>
              {saving ? 'Saving…' : 'Finish setup'}
              <Check className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
