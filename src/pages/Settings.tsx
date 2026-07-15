import { useState, useEffect, useMemo } from 'react';
import { Building2, Users, Shield, Palette, Receipt, Plus, MapPin, Phone, Wand2, FileText, Globe, TrendingUp, Check, ChevronsUpDown, RotateCcw, AlertTriangle, CreditCard, Coins } from 'lucide-react';
import { MultiCurrencySettingsTab } from '@/components/settings/MultiCurrencySettingsTab';
import { TroubleshootingTab } from '@/components/admin/TroubleshootingTab';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { SalesTaxSettingsTab } from '@/components/settings/SalesTaxSettingsTab';
import { OrganizationLogoUpload } from '@/components/settings/OrganizationLogoUpload';
import { UsersSettingsTab } from '@/components/settings/UsersSettingsTab';
import { InvoiceTemplateSettingsTab } from '@/components/settings/InvoiceTemplateSettingsTab';
import { ChartOfAccountsGenerator } from '@/components/settings/ChartOfAccountsGenerator';
import { GlobalComplianceTab } from '@/components/settings/GlobalComplianceTab';
import { AutoRateUpdatesTab } from '@/components/settings/AutoRateUpdatesTab';
import { PaymentSettingsTab } from '@/components/settings/PaymentSettingsTab';
import { ExecutiveSignerSettingsCard } from '@/components/settings/ExecutiveSignerSettingsCard';
import { DeleteOrganizationDialog } from '@/components/settings/DeleteOrganizationDialog';
import { Trash2 } from 'lucide-react';

import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useCountries } from '@/hooks/useGlobalJurisdiction';
import { useAuth } from '@/hooks/useAuth';
import { useBulkReverseJournalEntries } from '@/hooks/useBulkReverseJournalEntries';
import { useNpoModuleActivation } from '@/hooks/useNpoModuleActivation';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { INDUSTRY_OPTIONS } from '@/data/industries';
import { getCountryLocalization, getAvailableCurrencies } from '@/data/countryLocalizations';
import { isNpoIndustry } from '@/data/industries';

export default function Settings() {
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const [industryPopoverOpen, setIndustryPopoverOpen] = useState(false);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);

  // Use centralized industry list
  const industries = INDUSTRY_OPTIONS;
  const { currentOrganization: organization, isLoading: orgLoading } = useOrganizationContext();
  const { preferences, isLoading: prefsLoading, savePreferences } = useUserPreferences();
  const { data: countries = [], isLoading: countriesLoading } = useCountries();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const bulkReverseMutation = useBulkReverseJournalEntries();
  const npoModuleActivation = useNpoModuleActivation();
  
  // Bulk reversal progress state
  const [bulkReverseProgress, setBulkReverseProgress] = useState<{
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
  } | null>(null);
  
  // Organization tab state
  const [orgName, setOrgName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [incorporationJurisdiction, setIncorporationJurisdiction] = useState('');
  const [principalActivities, setPrincipalActivities] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [payrollAccountNumber, setPayrollAccountNumber] = useState('');
  const [industry, setIndustry] = useState('professional_services');
  const [fiscalYearEnd, setFiscalYearEnd] = useState('12');
  const [currency, setCurrency] = useState('CAD');
  const [accountingMethod, setAccountingMethod] = useState('accrual');
  
  // Organization address/contact state
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [orgProvince, setOrgProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('CA');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Get localized data based on selected country
  const countryLocalization = useMemo(() => getCountryLocalization(country), [country]);
  const availableCurrencies = useMemo(() => getAvailableCurrencies(), []);

  // Security tab state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [auditLogging, setAuditLogging] = useState(true);
  const [lockClosedPeriods, setLockClosedPeriods] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [securitySaving, setSecuritySaving] = useState(false);

  // Preferences tab state - synced with useUserPreferences
  const [dateFormat, setDateFormat] = useState('mdy');
  const [numberFormat, setNumberFormat] = useState('comma');
  const [negativeFormat, setNegativeFormat] = useState('minus');
  const [defaultReportPeriod, setDefaultReportPeriod] = useState('month');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dueDateReminders, setDueDateReminders] = useState(true);
  const [reconciliationAlerts, setReconciliationAlerts] = useState(true);

  // Sync form with organization data
  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
      setLegalName(organization.legal_name || '');
      setBusinessNumber(organization.business_number || '');
      setPayrollAccountNumber(organization.payroll_account_number || '');
      setIncorporationJurisdiction(organization.incorporation_jurisdiction || '');
      setPrincipalActivities(organization.principal_activities || '');
      setIndustry(organization.industry || 'professional_services');
      setFiscalYearEnd(String(organization.fiscal_year_end_month || 12).padStart(2, '0'));
      setCurrency(organization.currency || 'CAD');
      setAccountingMethod(organization.accounting_method || 'accrual');
      setAddressLine1(organization.address_line1 || '');
      setAddressLine2(organization.address_line2 || '');
      setCity(organization.city || '');
      setOrgProvince(organization.province || 'ON');
      setPostalCode(organization.postal_code || '');
      setCountry(organization.country || 'CA');
      setPhone(organization.phone || '');
      setEmail(organization.email || '');
      setWebsite(organization.website || '');
      setLogoUrl(organization.logo_url || null);
      // Security settings
      setTwoFactorEnabled((organization as any).two_factor_required ?? false);
      setSessionTimeout(String((organization as any).session_timeout_minutes ?? 30));
      setAuditLogging((organization as any).audit_logging_enabled ?? true);
      setLockClosedPeriods((organization as any).lock_closed_periods ?? true);
      setRequireApproval((organization as any).require_adjustment_approval ?? true);
    }
  }, [organization]);

  // Sync form with preferences data
  useEffect(() => {
    if (preferences && !prefsLoading) {
      setDateFormat(preferences.date_format || 'mdy');
      setNumberFormat(preferences.number_format || 'comma');
      setNegativeFormat(preferences.negative_format || 'minus');
      setDefaultReportPeriod(preferences.default_report_period || 'month');
      setEmailNotifications(preferences.email_notifications ?? true);
      setDueDateReminders(preferences.due_date_reminders ?? true);
      setReconciliationAlerts(preferences.reconciliation_alerts ?? true);
    }
  }, [preferences, prefsLoading]);

  // When country changes, reset province and update currency to match
  const handleCountryChange = (newCountryCode: string) => {
    const prevCountry = country;
    setCountry(newCountryCode);
    
    // Only reset province if country actually changed
    if (prevCountry !== newCountryCode) {
      const newLocalization = getCountryLocalization(newCountryCode);
      
      // Reset province to first available or empty
      if (newLocalization.jurisdictions.length > 0) {
        setOrgProvince(newLocalization.jurisdictions[0].code);
      } else {
        setOrgProvince('');
      }
      
      // Update currency to country's default
      setCurrency(newLocalization.currency);
    }
  };

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No organization');
      
      const { error } = await supabase
        .from('organizations')
        .update({ 
          name: orgName,
          legal_name: legalName,
          business_number: businessNumber,
          payroll_account_number: payrollAccountNumber || null,
          incorporation_jurisdiction: incorporationJurisdiction || null,
          principal_activities: principalActivities || null,
          industry,
          fiscal_year_end_month: parseInt(fiscalYearEnd),
          currency,
          accounting_method: accountingMethod,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          province: orgProvince,
          postal_code: postalCode,
          country,
          phone,
          email,
          website,
        })
        .eq('id', organization.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization settings saved');
      
      // Auto-enable Donations module for NPO/Charity industries
      if (organization?.id && isNpoIndustry(industry)) {
        npoModuleActivation.mutate({
          organizationId: organization.id,
          industry,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your organization and application settings</p>
        </div>
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">No Organization Found</h2>
          <p className="text-muted-foreground mb-4">Create an organization to configure settings.</p>
          <Button onClick={() => setCreateOrgOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Organization
          </Button>
          <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your organization and application settings</p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="rate-updates" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Rate Updates</span>
          </TabsTrigger>
          <TabsTrigger value="coa-generator" className="gap-2">
            <Wand2 className="w-4 h-4" />
            <span className="hidden sm:inline">CoA Generator</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Invoices</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="sales-tax" className="gap-2">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Sales Tax</span>
          </TabsTrigger>
          <TabsTrigger value="multi-currency" className="gap-2">
            <Coins className="w-4 h-4" />
            <span className="hidden sm:inline">Multi-Currency</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Troubleshooting</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Organization Logo</h2>
            <OrganizationLogoUpload
              organizationId={organization.id}
              currentLogoUrl={logoUrl}
              onLogoChange={(url) => {
                setLogoUrl(url);
                queryClient.invalidateQueries({ queryKey: ['organizations'] });
              }}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Organization Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input 
                  id="orgName" 
                  value={orgName} 
                  onChange={(e) => setOrgName(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Name</Label>
                <Input 
                  id="legalName" 
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Enter legal name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incorporationJurisdiction">Incorporation Jurisdiction</Label>
                <Input 
                  id="incorporationJurisdiction" 
                  value={incorporationJurisdiction}
                  onChange={(e) => setIncorporationJurisdiction(e.target.value)}
                  placeholder="e.g., laws of the Province of Ontario"
                />
                <p className="text-xs text-muted-foreground">Used in Note 2 (Nature of Operations) of the Compilation Report</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="principalActivities">Principal Activities</Label>
                <Input 
                  id="principalActivities" 
                  value={principalActivities}
                  onChange={(e) => setPrincipalActivities(e.target.value)}
                  placeholder="e.g., providing professional accounting services"
                />
                <p className="text-xs text-muted-foreground">Used in Note 2 (Nature of Operations) of the Compilation Report</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessNumber">Business Number</Label>
                <Input 
                  id="businessNumber" 
                  value={businessNumber}
                  onChange={(e) => setBusinessNumber(e.target.value)}
                  placeholder="123456789RC0001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payrollAccountNumber">Payroll Account Number</Label>
                <Input 
                  id="payrollAccountNumber" 
                  value={payrollAccountNumber}
                  onChange={(e) => setPayrollAccountNumber(e.target.value)}
                  placeholder="123456789RP0001"
                />
                <p className="text-xs text-muted-foreground">CRA payroll account (RP) number used on T4/T4A slips and remittances</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Popover open={industryPopoverOpen} onOpenChange={setIndustryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={industryPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {industry
                        ? industries.find((ind) => ind.value === industry)?.label || industry
                        : "Select industry..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search industries..." />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>No industry found.</CommandEmpty>
                        <CommandGroup>
                          {industries.map((ind) => (
                            <CommandItem
                              key={ind.value}
                              value={ind.label}
                              onSelect={() => {
                                setIndustry(ind.value);
                                setIndustryPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  industry === ind.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {ind.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              <MapPin className="w-5 h-5 inline-block mr-2" />
              Business Address
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your province/territory determines your tax jurisdiction settings
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input 
                  id="addressLine1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input 
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Suite 100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Toronto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgProvince">{countryLocalization.jurisdictionLabel}</Label>
                {countryLocalization.jurisdictions.length > 0 ? (
                  <Select value={orgProvince} onValueChange={setOrgProvince}>
                    <SelectTrigger id="orgProvince">
                      <SelectValue placeholder={`Select ${countryLocalization.jurisdictionLabel.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {countryLocalization.jurisdictions.map((j) => (
                        <SelectItem key={j.code} value={j.code}>
                          {j.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    id="orgProvince"
                    value={orgProvince}
                    onChange={(e) => setOrgProvince(e.target.value)}
                    placeholder={`Enter ${countryLocalization.jurisdictionLabel.toLowerCase()}`}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">{countryLocalization.postalCodeLabel}</Label>
                <Input 
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder={countryLocalization.postalCodePlaceholder || 'Enter postal code'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="country"
                      variant="outline"
                      role="combobox"
                      aria-expanded={countryPopoverOpen}
                      className="w-full justify-between font-normal"
                      disabled={countriesLoading}
                    >
                      {countriesLoading ? (
                        "Loading..."
                      ) : (
                        <span className="flex items-center gap-2">
                          <span>{countryLocalization.flag}</span>
                          <span>{countries.find((c) => c.code === country)?.name || "Select country..."}</span>
                        </span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0 z-50" align="start">
                    <Command>
                      <CommandInput placeholder="Search countries..." />
                      <CommandList className="max-h-[280px]">
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {countries.map((c) => {
                            const localization = getCountryLocalization(c.code);
                            return (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.code}`}
                                onSelect={() => {
                                  handleCountryChange(c.code);
                                  setCountryPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    country === c.code ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="mr-2">{localization.flag}</span>
                                <span>{c.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{localization.currency}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              <Phone className="w-5 h-5 inline-block mr-2" />
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input 
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.company.com"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Fiscal Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Base Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year End Month</Label>
                <Select value={fiscalYearEnd} onValueChange={setFiscalYearEnd}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="02">February</SelectItem>
                    <SelectItem value="03">March</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="05">May</SelectItem>
                    <SelectItem value="06">June</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="08">August</SelectItem>
                    <SelectItem value="09">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The last month of your fiscal year (e.g., December for calendar year, September for Oct-Sep fiscal year)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Accounting Method</Label>
                <Select value={accountingMethod} onValueChange={setAccountingMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accrual">Accrual</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={() => updateOrgMutation.mutate()}
              disabled={updateOrgMutation.isPending}
            >
              {updateOrgMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          <ExecutiveSignerSettingsCard />

          {(isAdmin || organization.owner_id === user?.id) && (
            <Card className="p-6 border-destructive/50">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    Permanently delete this organization and all of its data. This action cannot be
                    undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOrgOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete organization
                </Button>
              </div>
            </Card>
          )}

          <DeleteOrganizationDialog
            open={deleteOrgOpen}
            onOpenChange={setDeleteOrgOpen}
            organizationId={organization.id}
            organizationName={organization.name}
          />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <GlobalComplianceTab organizationId={organization.id} />
        </TabsContent>

        <TabsContent value="rate-updates" className="space-y-6">
          <AutoRateUpdatesTab organizationId={organization.id} />
        </TabsContent>

        <TabsContent value="coa-generator" className="space-y-6">
          <ChartOfAccountsGenerator organizationId={organization.id} />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <InvoiceTemplateSettingsTab />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <PaymentSettingsTab />
        </TabsContent>

        <TabsContent value="sales-tax" className="space-y-6">
          <SalesTaxSettingsTab />
        </TabsContent>

        <TabsContent value="multi-currency" className="space-y-6">
          <MultiCurrencySettingsTab />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UsersSettingsTab />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Security Settings</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                </div>
                <Switch 
                  checked={twoFactorEnabled} 
                  onCheckedChange={setTwoFactorEnabled} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Session Timeout</p>
                  <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                </div>
                <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Audit Logging</p>
                  <p className="text-sm text-muted-foreground">Track all user actions</p>
                </div>
                <Switch 
                  checked={auditLogging} 
                  onCheckedChange={setAuditLogging} 
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Period Controls</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Lock Closed Periods</p>
                  <p className="text-sm text-muted-foreground">Prevent changes to closed accounting periods</p>
                </div>
                <Switch 
                  checked={lockClosedPeriods} 
                  onCheckedChange={setLockClosedPeriods} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Require Approval for Adjustments</p>
                  <p className="text-sm text-muted-foreground">Manager approval for adjusting entries</p>
                </div>
                <Switch 
                  checked={requireApproval} 
                  onCheckedChange={setRequireApproval} 
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-destructive/50">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Data Management
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Bulk Reverse All Journal Entries</p>
                  <p className="text-sm text-muted-foreground">
                    Create reversing entries for all posted journal entries, resetting account balances to opening values.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={bulkReverseMutation.isPending}
                      className="shrink-0"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {bulkReverseMutation.isPending ? 'Reversing...' : 'Reverse All JEs'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reverse All Journal Entries?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create reversing entries for all posted journal entries in this organization. 
                        This action cannot be undone easily and should only be used for data reset purposes.
                        <br /><br />
                        All account balances will be reset to their opening balances after this operation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          if (!organization?.id || !user?.id) return;
                          setBulkReverseProgress(null);
                          bulkReverseMutation.mutate({
                            organizationId: organization.id,
                            userId: user.id,
                            onProgress: (progress) => {
                              setBulkReverseProgress(progress);
                            },
                          });
                        }}
                      >
                        Yes, Reverse All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              
              {bulkReverseProgress && (
                <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {bulkReverseProgress.processed} / {bulkReverseProgress.total}</span>
                    <span className="text-muted-foreground">
                      {bulkReverseProgress.succeeded} succeeded, {bulkReverseProgress.failed} failed
                    </span>
                  </div>
                  <Progress 
                    value={bulkReverseProgress.total > 0 
                      ? (bulkReverseProgress.processed / bulkReverseProgress.total) * 100 
                      : 0
                    } 
                  />
                </div>
              )}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={async () => {
                if (!organization?.id) return;
                setSecuritySaving(true);
                try {
                  const { error } = await supabase
                    .from('organizations')
                    .update({
                      two_factor_required: twoFactorEnabled,
                      session_timeout_minutes: parseInt(sessionTimeout),
                      audit_logging_enabled: auditLogging,
                      lock_closed_periods: lockClosedPeriods,
                      require_adjustment_approval: requireApproval,
                    })
                    .eq('id', organization.id);
                  
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ['organizations'] });
                  toast.success('Security settings saved');
                } catch (error: any) {
                  toast.error(`Failed to save: ${error.message}`);
                } finally {
                  setSecuritySaving(false);
                }
              }}
              disabled={securitySaving}
            >
              {securitySaving ? 'Saving...' : 'Save Security Settings'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Display Preferences</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Date Format</p>
                  <p className="text-sm text-muted-foreground">How dates are displayed</p>
                </div>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Number Format</p>
                  <p className="text-sm text-muted-foreground">How numbers are formatted</p>
                </div>
                <Select value={numberFormat} onValueChange={setNumberFormat}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comma">1,234.56</SelectItem>
                    <SelectItem value="space">1 234.56</SelectItem>
                    <SelectItem value="period">1.234,56</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Negative Number Format</p>
                  <p className="text-sm text-muted-foreground">How negative numbers are displayed</p>
                </div>
                <Select value={negativeFormat} onValueChange={setNegativeFormat}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minus">-1,234.56</SelectItem>
                    <SelectItem value="brackets">(1,234.56)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Default Report Period</p>
                  <p className="text-sm text-muted-foreground">Initial period for reports</p>
                </div>
                <Select value={defaultReportPeriod} onValueChange={setDefaultReportPeriod}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Current Month</SelectItem>
                    <SelectItem value="quarter">Current Quarter</SelectItem>
                    <SelectItem value="year">Current Year</SelectItem>
                    <SelectItem value="ytd">Year to Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Notifications</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive important updates via email</p>
                </div>
                <Switch 
                  checked={emailNotifications} 
                  onCheckedChange={setEmailNotifications} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Due Date Reminders</p>
                  <p className="text-sm text-muted-foreground">Alerts for upcoming due dates</p>
                </div>
                <Switch 
                  checked={dueDateReminders} 
                  onCheckedChange={setDueDateReminders} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Reconciliation Alerts</p>
                  <p className="text-sm text-muted-foreground">Notify when reconciliation is needed</p>
                </div>
                <Switch 
                  checked={reconciliationAlerts} 
                  onCheckedChange={setReconciliationAlerts} 
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={() => {
                savePreferences.mutate({
                  date_format: dateFormat,
                  number_format: numberFormat,
                  negative_format: negativeFormat,
                  default_report_period: defaultReportPeriod,
                  email_notifications: emailNotifications,
                  due_date_reminders: dueDateReminders,
                  reconciliation_alerts: reconciliationAlerts,
                });
              }}
              disabled={savePreferences.isPending}
            >
              {savePreferences.isPending ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting">
          <TroubleshootingTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}
