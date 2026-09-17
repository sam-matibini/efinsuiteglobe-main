import { useState, useMemo, useEffect } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, User, Sparkles, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { GuarantorsForm, EMPTY_GUARANTOR, isGuarantorComplete, type GuarantorDraft } from './GuarantorForm';
import { saveGuarantorsForEmployee } from '@/hooks/useEmployeeGuarantors';
import {
  canSubmitWithGuarantors,
  createEmployeeSchema,
  employeeInsertErrorMessage,
  emptyToNull,
  firstEmployeeFormError,
  generateEmployeeNumber,
  tabForEmployeeField,
  GUARANTORS_MANDATORY_ERROR,
  todayISODate,
  type EmployeeFormData,
  type GuarantorRequirement,
} from '@/lib/addEmployee';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useJobSites } from '@/hooks/useJobSites';
import { COUNTRY_LOCALIZATIONS, getCountryLocalization } from '@/data/countryLocalizations';
import { 
  getCountryPayrollConfig, 
  getProvincialBPA, 
  type CountryPayrollConfig 
} from '@/data/globalPayrollDefaults';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { jobSites: activeJobSites } = useJobSites({ activeOnly: true });
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('');
  const [guarantor1, setGuarantor1] = useState<GuarantorDraft>(EMPTY_GUARANTOR(1));
  const [guarantor2, setGuarantor2] = useState<GuarantorDraft>(EMPTY_GUARANTOR(2));
  const [guarantorRequirement, setGuarantorRequirement] = useState<GuarantorRequirement>('optional');

  // Determine country from organization
  const countryCode = useMemo(() => {
    if (organization?.country_id) {
      // Try to find country code from country_id
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    if (organization?.country) {
      // Try to match by country name or code
      const upperCountry = organization.country.toUpperCase();
      if (COUNTRY_LOCALIZATIONS[upperCountry]) return upperCountry;
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    return 'CA'; // Default to Canada
  }, [organization?.country, organization?.country_id]);

  const countryConfig = useMemo(() => getCountryLocalization(countryCode), [countryCode]);
  const payrollConfig = useMemo(() => getCountryPayrollConfig(countryCode), [countryCode]);

  // Get default values based on country
  const getDefaultValues = (config: CountryPayrollConfig, jurisdictionCode?: string) => {
    const federalCredits = config.federalTaxCredits;
    const jurisdictionalCredits = config.jurisdictionalTaxCredits;

    // For Canada, get provincial BPA
    let jBPA = jurisdictionalCredits[0]?.defaultAmount || 0;
    if (countryCode === 'CA' && jurisdictionCode) {
      jBPA = getProvincialBPA(jurisdictionCode);
    }

    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      nationalId: '',
      nin: '',
      dateOfBirth: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      mailingProvince: '',
      postalCode: '',
      mailingCountry: '',
      department: '',
      jobTitle: '',
      jobSiteId: '',
      employmentType: 'full_time' as const,
      payFrequency: 'bi_weekly' as const,
      jurisdiction: jurisdictionCode || countryConfig.jurisdictions[0]?.code || '',
      hireDate: todayISODate(),
      payType: 'salary' as const,
      annualSalary: 0,
      hourlyRate: 0,
      cppExempt: false,
      eiExempt: false,
      taxCredit1: federalCredits[0]?.defaultAmount || 0,
      taxCredit2: federalCredits[1]?.defaultAmount || 0,
      taxCredit3: federalCredits[2]?.defaultAmount || 0,
      taxCredit4: federalCredits[3]?.defaultAmount || 0,
      taxCredit5: federalCredits[4]?.defaultAmount || 0,
      taxCredit6: federalCredits[5]?.defaultAmount || 0,
      taxCredit7: federalCredits[6]?.defaultAmount || 0,
      taxCredit8: federalCredits[7]?.defaultAmount || 0,
      taxCreditJ1: jBPA,
      taxCreditJ2: jurisdictionalCredits[1]?.defaultAmount || 0,
      taxCreditJ3: jurisdictionalCredits[2]?.defaultAmount || 0,
      taxCreditJ4: jurisdictionalCredits[3]?.defaultAmount || 0,
      taxCreditJ5: jurisdictionalCredits[4]?.defaultAmount || 0,
      taxCreditJ6: jurisdictionalCredits[5]?.defaultAmount || 0,
      taxCreditJ7: jurisdictionalCredits[6]?.defaultAmount || 0,
    };
  };

  // Default jurisdiction to organization's province if available
  const defaultJurisdiction = useMemo(() => {
    if (organization?.province) {
      const orgProv = organization.province.toUpperCase();
      const match = countryConfig.jurisdictions.find(j => j.code === orgProv);
      if (match) return match.code;
    }
    return countryConfig.jurisdictions[0]?.code || '';
  }, [organization?.province, countryConfig.jurisdictions]);
  const employeeSchema = useMemo(() => createEmployeeSchema(countryCode), [countryCode]);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: getDefaultValues(payrollConfig, defaultJurisdiction),
    shouldUseNativeValidation: false,
  });

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      return;
    }
    setActiveTab('personal');
    setSelectedJurisdiction(defaultJurisdiction);
    setGuarantor1(EMPTY_GUARANTOR(1));
    setGuarantor2(EMPTY_GUARANTOR(2));
    setGuarantorRequirement('optional');
    form.reset(getDefaultValues(payrollConfig, defaultJurisdiction));
    // Reset only when the dialog opens so in-progress edits are not wiped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const watchPayType = form.watch('payType');

  // Update tax amounts when jurisdiction changes
  const handleJurisdictionChange = (jurisdiction: string) => {
    setSelectedJurisdiction(jurisdiction);
    form.setValue('jurisdiction', jurisdiction);

    if (countryCode === 'CA') {
      const provincialBPA = getProvincialBPA(jurisdiction);
      form.setValue('taxCreditJ1', provincialBPA);
    }
  };

  // Auto-populate with defaults
  const handleAutoPopulate = () => {
    const jurisdiction = form.getValues('jurisdiction');
    const federalCredits = payrollConfig.federalTaxCredits;
    const jurisdictionalCredits = payrollConfig.jurisdictionalTaxCredits;

    // Set federal credits
    form.setValue('taxCredit1', federalCredits[0]?.defaultAmount || 0);
    form.setValue('taxCredit2', federalCredits[1]?.defaultAmount || 0);
    form.setValue('taxCredit3', federalCredits[2]?.defaultAmount || 0);
    form.setValue('taxCredit4', federalCredits[3]?.defaultAmount || 0);
    form.setValue('taxCredit5', federalCredits[4]?.defaultAmount || 0);
    form.setValue('taxCredit6', federalCredits[5]?.defaultAmount || 0);
    form.setValue('taxCredit7', federalCredits[6]?.defaultAmount || 0);
    form.setValue('taxCredit8', federalCredits[7]?.defaultAmount || 0);

    // Set jurisdictional credits
    if (countryCode === 'CA') {
      form.setValue('taxCreditJ1', getProvincialBPA(jurisdiction));
    } else {
      form.setValue('taxCreditJ1', jurisdictionalCredits[0]?.defaultAmount || 0);
    }
    form.setValue('taxCreditJ2', jurisdictionalCredits[1]?.defaultAmount || 0);
    form.setValue('taxCreditJ3', jurisdictionalCredits[2]?.defaultAmount || 0);

    toast.success(`${payrollConfig.taxFormName} auto-populated with ${payrollConfig.autoPopulateSource} defaults`);
  };

  const calculateTotalFederal = () => {
    return (
      form.watch('taxCredit1') +
      form.watch('taxCredit2') +
      form.watch('taxCredit3') +
      form.watch('taxCredit4') +
      form.watch('taxCredit5') +
      form.watch('taxCredit6') +
      form.watch('taxCredit7')
    );
  };

  const calculateTotalJurisdictional = () => {
    return (
      form.watch('taxCreditJ1') +
      form.watch('taxCreditJ2') +
      form.watch('taxCreditJ3') +
      form.watch('taxCreditJ4') +
      form.watch('taxCreditJ5') +
      form.watch('taxCreditJ6')
    );
  };

  const onInvalid = (errors: FieldErrors<EmployeeFormData>) => {
    const first = firstEmployeeFormError(errors as Record<string, { message?: string } | undefined>);
    if (first) setActiveTab(tabForEmployeeField(first.field));
    toast.error(first?.message || 'Please complete the required employee fields.');
  };

  const onSubmit = async (data: EmployeeFormData) => {
    if (!organization?.id) {
      toast.error('No organization selected. Create or select an organization first.');
      return;
    }
    if (
      !canSubmitWithGuarantors(
        guarantorRequirement,
        isGuarantorComplete(guarantor1),
        isGuarantorComplete(guarantor2),
      )
    ) {
      setActiveTab('guarantors');
      toast.error(GUARANTORS_MANDATORY_ERROR);
      return;
    }
    setIsSubmitting(true);
    try {
      const employeeData = {
        employee_number: generateEmployeeNumber(),
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email: data.email.trim(),
        phone: emptyToNull(data.phone?.trim()),
        sin_encrypted: emptyToNull(data.nationalId?.trim()),
        nin: emptyToNull(data.nin?.trim()),
        date_of_birth: emptyToNull(data.dateOfBirth),
        address_line1: emptyToNull(data.addressLine1?.trim()),
        address_line2: emptyToNull(data.addressLine2?.trim()),
        city: emptyToNull(data.city?.trim()),
        mailing_province: emptyToNull(data.mailingProvince),
        postal_code: emptyToNull(data.postalCode?.trim()),
        country: emptyToNull(data.mailingCountry?.trim()),
        province: data.jurisdiction,
        hire_date: data.hireDate,
        employment_type: data.employmentType,
        pay_frequency: data.payFrequency,
        department: emptyToNull(data.department),
        job_title: emptyToNull(data.jobTitle?.trim()),
        job_site_id: emptyToNull(data.jobSiteId),
        annual_salary: data.payType === 'salary' ? data.annualSalary || null : null,
        hourly_rate: data.payType === 'hourly' ? data.hourlyRate || null : null,
        status: 'onboarding' as const,
        organization_id: organization.id,
        cpp_exempt: data.cppExempt || false,
        ei_exempt: data.eiExempt || false,
      };

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .insert(employeeData)
        .select()
        .single();

      if (empError) throw empError;

      if (countryCode === 'CA') {
        const { error: fedTD1Error } = await supabase
          .from('employee_td1')
          .insert({
            employee_id: employee.id,
            form_type: 'federal',
            tax_year: new Date().getFullYear(),
            basic_personal_amount: Number(data.taxCredit1) || 0,
            canada_employment_amount: Number(data.taxCredit2) || 0,
            age_amount: Number(data.taxCredit3) || 0,
            disability_amount: Number(data.taxCredit4) || 0,
            spouse_amount: Number(data.taxCredit5) || 0,
            tuition_amount: Number(data.taxCredit6) || 0,
            other_credits: Number(data.taxCredit7) || 0,
            additional_tax_deduction: Number(data.taxCredit8) || 0,
            total_claim_amount: calculateTotalFederal(),
          });

        if (fedTD1Error) throw fedTD1Error;

        const { error: provTD1Error } = await supabase
          .from('employee_td1')
          .insert({
            employee_id: employee.id,
            form_type: data.jurisdiction,
            tax_year: new Date().getFullYear(),
            basic_personal_amount: Number(data.taxCreditJ1) || 0,
            age_amount: Number(data.taxCreditJ2) || 0,
            disability_amount: Number(data.taxCreditJ3) || 0,
            spouse_amount: Number(data.taxCreditJ4) || 0,
            tuition_amount: Number(data.taxCreditJ5) || 0,
            other_credits: Number(data.taxCreditJ6) || 0,
            additional_tax_deduction: Number(data.taxCreditJ7) || 0,
            total_claim_amount: calculateTotalJurisdictional(),
          });

        if (provTD1Error) throw provTD1Error;
      }

      try {
        await saveGuarantorsForEmployee(employee.id, organization.id, [
          { ...guarantor1, guarantor_order: 1, full_name: guarantor1.full_name?.trim() ?? '' },
          { ...guarantor2, guarantor_order: 2, full_name: guarantor2.full_name?.trim() ?? '' },
        ]);
      } catch (gErr: any) {
        console.warn('Guarantor save warning:', gErr?.message);
      }

      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Employee ${data.firstName} ${data.lastName} added successfully!`);
      form.reset(getDefaultValues(payrollConfig, defaultJurisdiction));
      setGuarantor1(EMPTY_GUARANTOR(1));
      setGuarantor2(EMPTY_GUARANTOR(2));
      setGuarantorRequirement('optional');
      setActiveTab('personal');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast.error(employeeInsertErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: payrollConfig.currencyCode,
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getJurisdictionName = (code: string) => {
    return countryConfig.jurisdictions.find(j => j.code === code)?.name || code;
  };

  const currentJurisdiction = form.watch('jurisdiction') || selectedJurisdiction || defaultJurisdiction;

  // Render tax credits form based on country
  const renderTaxCreditsTab = () => {
    const federalCredits = payrollConfig.federalTaxCredits;
    const jurisdictionalCredits = payrollConfig.jurisdictionalTaxCredits;
    const hasJurisdictionalCredits = jurisdictionalCredits.length > 0;

    return (
      <TabsContent value="tax" className="space-y-6 mt-4">
        {/* Deduction Exemptions — country-aware */}
        {(countryCode === 'CA' || countryCode === 'NG') && (
          <Card className="p-4">
            <h4 className="font-medium mb-3">Deduction Exemptions</h4>
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="cppExempt"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{countryCode === 'NG' ? 'Pension Exempt' : 'CPP Exempt'}</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {countryCode === 'NG'
                          ? 'Employee is exempt from Pension Reform Act contributions (e.g., fewer than 3 employees, or expatriate exemption)'
                          : 'Employee is exempt from Canada Pension Plan contributions (e.g., First Nations employees working on reserve)'}
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eiExempt"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{countryCode === 'NG' ? 'NHF Exempt' : 'EI Exempt'}</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {countryCode === 'NG'
                          ? 'Employee is exempt from National Housing Fund contributions (e.g., basic salary below ₦3,000/month or non-Nigerian)'
                          : 'Employee is exempt from Employment Insurance premiums'}
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{payrollConfig.taxFormName}</h3>
            <p className="text-sm text-muted-foreground">
              {payrollConfig.taxFormDescription.replace('Provincial', getJurisdictionName(currentJurisdiction))}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoPopulate}
            className="flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {payrollConfig.autoPopulateLabel}
          </Button>
        </div>

        {/* Federal/National Credits */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10">
                {countryCode === 'CA' ? 'Federal' : countryCode === 'US' ? 'Federal' : 'National'}
              </Badge>
              {countryCode === 'CA' ? 'TD1 - Federal' : 
               countryCode === 'US' ? 'W-4 Federal' : 
               payrollConfig.taxFormName}
            </h4>
            {(countryCode === 'CA' || countryCode === 'US') && (
              <span className="text-sm font-medium">
                Total: {formatCurrency(calculateTotalFederal())}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {federalCredits.slice(0, 8).map((credit, idx) => {
              const fieldName = `taxCredit${idx + 1}` as keyof EmployeeFormData;
              return (
                <FormField
                  key={credit.code}
                  control={form.control}
                  name={fieldName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{credit.name}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={typeof field.value === 'number' ? field.value : 0}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      {credit.description && (
                        <p className="text-xs text-muted-foreground">{credit.description}</p>
                      )}
                    </FormItem>
                  )}
                />
              );
            })}
          </div>
        </Card>

        {/* Jurisdictional Credits (if applicable) */}
        {hasJurisdictionalCredits && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-secondary/50">
                  {currentJurisdiction}
                </Badge>
                {countryCode === 'CA' ? `TD1 - ${getJurisdictionName(currentJurisdiction)}` :
                 countryCode === 'US' ? `State - ${getJurisdictionName(currentJurisdiction)}` :
                 countryConfig.jurisdictionLabel}
              </h4>
              {(countryCode === 'CA' || countryCode === 'US') && (
                <span className="text-sm font-medium">
                  Total: {formatCurrency(calculateTotalJurisdictional())}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {jurisdictionalCredits.slice(0, 7).map((credit, idx) => {
                const fieldName = `taxCreditJ${idx + 1}` as keyof EmployeeFormData;
                return (
                  <FormField
                    key={credit.code}
                    control={form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{credit.name}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={typeof field.value === 'number' ? field.value : 0}
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
          </Card>
        )}

        {/* Deductions Info (for non-CA/US countries) */}
        {countryCode !== 'CA' && countryCode !== 'US' && payrollConfig.federalDeductions.length > 0 && (
          <Card className="p-4 bg-muted/30">
            <h4 className="font-medium mb-3">Statutory Deductions (Auto-calculated)</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {payrollConfig.federalDeductions.map(ded => (
                <div key={ded.code} className="flex justify-between">
                  <span className="text-muted-foreground">{ded.name}:</span>
                  <span>
                    {ded.employeeRate}% employee
                    {ded.employerRate ? ` / ${ded.employerRate}% employer` : ''}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These are calculated automatically based on gross pay.
            </p>
          </Card>
        )}
      </TabsContent>
    );
  };

  const submitEmployee = form.handleSubmit(onSubmit, onInvalid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Add New Employee
            <Badge variant="outline" className="ml-2">{countryConfig.name}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form noValidate onSubmit={submitEmployee}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personal Info
                </TabsTrigger>
                <TabsTrigger value="tax" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {payrollConfig.taxFormName}
                </TabsTrigger>
                <TabsTrigger value="guarantors" className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Guarantors
                </TabsTrigger>
              </TabsList>

              {/* Personal Info Tab */}
              <TabsContent value="personal" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder={`${countryConfig.phoneCode} ...`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nationalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{payrollConfig.nationalIdLabel}</FormLabel>
                        <FormControl>
                          <Input placeholder={payrollConfig.nationalIdPlaceholder} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {countryCode === 'NG' && (
                  <FormField
                    control={form.control}
                    name="nin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>National Identification Number (NIN) *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="12345678901"
                            maxLength={11}
                            inputMode="numeric"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Required by NRS. Must be the 11-digit NIN issued by NIMC.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Mailing Address */}
                <div className="pt-2 pb-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Mailing Address</h3>
                </div>
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Apt, suite, unit, etc." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailingProvince"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{countryConfig.jurisdictionLabel} (Mailing)</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${countryConfig.jurisdictionLabel.toLowerCase()}`} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {countryConfig.jurisdictions.map((j) => (
                              <SelectItem key={j.code} value={j.code}>
                                {j.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal / ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="A1A 1A1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailingCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Canada" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Employment Details */}
                <div className="pt-2 pb-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Employment Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jurisdiction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{countryConfig.jurisdictionLabel} of Employment *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => handleJurisdictionChange(value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${countryConfig.jurisdictionLabel.toLowerCase()}`} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {countryConfig.jurisdictions.map((j) => (
                              <SelectItem key={j.code} value={j.code}>
                                {j.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Used for TD1 tax credits. Defaults to organization's province.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hire Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="temporary">Temporary</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pay Frequency</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                            <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="engineering">Engineering</SelectItem>
                            <SelectItem value="sales">Sales</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="operations">Operations</SelectItem>
                            <SelectItem value="hr">Human Resources</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Job title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="jobSiteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Site / Location</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                activeJobSites.length === 0
                                  ? 'No sites — add one in Settings → Job Sites'
                                  : 'Select job site'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeJobSites.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}{s.code ? ` (${s.code})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="payType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pay Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchPayType === 'salary' ? (
                    <FormField
                      control={form.control}
                      name="annualSalary"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Annual Salary ({payrollConfig.currencySymbol})</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="60000"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Hourly Rate ({payrollConfig.currencySymbol})</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="25.00"
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </TabsContent>

              {/* Tax Credits Tab */}
              {renderTaxCreditsTab()}

              {/* Guarantors Tab */}
              <TabsContent value="guarantors" className="space-y-4 mt-4">
                <GuarantorsForm
                  first={guarantor1}
                  second={guarantor2}
                  onChangeFirst={setGuarantor1}
                  onChangeSecond={setGuarantor2}
                  requirement={guarantorRequirement}
                  onRequirementChange={setGuarantorRequirement}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-6 border-t mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                {activeTab !== 'personal' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab(activeTab === 'guarantors' ? 'tax' : 'personal')}
                  >
                    Previous
                  </Button>
                )}
                {activeTab !== 'guarantors' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab(activeTab === 'personal' ? 'tax' : 'guarantors')}
                  >
                    Next
                  </Button>
                )}
                <Button type="button" disabled={isSubmitting} onClick={submitEmployee}>
                  {isSubmitting ? 'Adding...' : 'Add Employee'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
