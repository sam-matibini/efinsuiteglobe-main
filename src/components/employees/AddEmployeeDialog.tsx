import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FileText, User, Sparkles, UserPlus } from 'lucide-react';
import { GuarantorsForm, EMPTY_GUARANTOR, isGuarantorComplete, type GuarantorDraft } from './GuarantorForm';
import { saveGuarantorsForEmployee } from '@/hooks/useEmployeeGuarantors';
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
  CANADIAN_PROVINCIAL_BPA,
  type CountryPayrollConfig 
} from '@/data/globalPayrollDefaults';

// Dynamic schema based on country - we'll use a flexible approach
const createEmployeeSchema = (countryCode: string) => {
  const baseSchema = {
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email required'),
    phone: z.string().optional(),
    nationalId: z.string().optional(),
    dateOfBirth: z.string().optional(),
    // Mailing address
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    mailingProvince: z.string().optional(),
    postalCode: z.string().optional(),
    mailingCountry: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    jobSiteId: z.string().min(1, 'Job site is required'),
    employmentType: z.enum(['full_time', 'part_time', 'contract', 'temporary']),
    payFrequency: z.enum(['weekly', 'bi_weekly', 'semi_monthly', 'monthly']),
    jurisdiction: z.string().min(1, 'Location is required'),
    hireDate: z.string().min(1, 'Hire date is required'),
    annualSalary: z.number().optional(),
    hourlyRate: z.number().optional(),
    cppExempt: z.boolean().optional(),
    eiExempt: z.boolean().optional(),
    payType: z.enum(['salary', 'hourly']),
    // Generic tax credits/deductions as numbers (flexible for all countries)
    taxCredit1: z.number(),
    taxCredit2: z.number(),
    taxCredit3: z.number(),
    taxCredit4: z.number(),
    taxCredit5: z.number(),
    taxCredit6: z.number(),
    taxCredit7: z.number(),
    taxCredit8: z.number(),
    // Jurisdictional credits
    taxCreditJ1: z.number(),
    taxCreditJ2: z.number(),
    taxCreditJ3: z.number(),
    taxCreditJ4: z.number(),
    taxCreditJ5: z.number(),
    taxCreditJ6: z.number(),
    taxCreditJ7: z.number(),
  };

  return z.object(baseSchema);
};

type EmployeeFormData = z.infer<ReturnType<typeof createEmployeeSchema>>;

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const { organization } = useCurrentOrganization();
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('');
  const [guarantor1, setGuarantor1] = useState<GuarantorDraft>(EMPTY_GUARANTOR(1));
  const [guarantor2, setGuarantor2] = useState<GuarantorDraft>(EMPTY_GUARANTOR(2));

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
      hireDate: '',
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
  });

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

  const generateEmployeeNumber = () => {
    const prefix = 'EMP';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}`;
  };

  const onSubmit = async (data: EmployeeFormData) => {
    // Mandatory: both guarantors must be provided AND confirmed
    if (!isGuarantorComplete(guarantor1) || !isGuarantorComplete(guarantor2)) {
      setActiveTab('guarantors');
      toast.error('Both guarantors are required and each must be confirmed before onboarding.');
      return;
    }
    setIsSubmitting(true);
    try {
      // For non-Canadian employees, we still store the jurisdiction in province field
      // The enum will only work for Canadian provinces; others get stored as-is
      const employeeData = {
        employee_number: generateEmployeeNumber(),
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone || null,
        sin_encrypted: data.nationalId || null,
        date_of_birth: data.dateOfBirth || null,
        address_line1: data.addressLine1 || null,
        address_line2: data.addressLine2 || null,
        city: data.city || null,
        mailing_province: data.mailingProvince || null,
        postal_code: data.postalCode || null,
        country: data.mailingCountry || null,
        province: data.jurisdiction as any,
        hire_date: data.hireDate,
        employment_type: data.employmentType,
        pay_frequency: data.payFrequency,
        department: data.department || null,
        job_title: data.jobTitle || null,
        job_site_id: data.jobSiteId,
        annual_salary: data.payType === 'salary' ? data.annualSalary : null,
        hourly_rate: data.payType === 'hourly' ? data.hourlyRate : null,
        status: 'onboarding' as const,
        organization_id: organization?.id,
        cpp_exempt: data.cppExempt || false,
        ei_exempt: data.eiExempt || false,
      };
      
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .insert(employeeData)
        .select()
        .single();

      if (empError) throw empError;

      // Create tax form records based on country
      if (countryCode === 'CA') {
        // Federal TD1
        const { error: fedTD1Error } = await supabase
          .from('employee_td1')
          .insert({
            employee_id: employee.id,
            form_type: 'federal',
            tax_year: new Date().getFullYear(),
            basic_personal_amount: data.taxCredit1,
            canada_employment_amount: data.taxCredit2,
            age_amount: data.taxCredit3,
            disability_amount: data.taxCredit4,
            spouse_amount: data.taxCredit5,
            tuition_amount: data.taxCredit6,
            other_credits: data.taxCredit7,
            additional_tax_deduction: data.taxCredit8,
            total_claim_amount: calculateTotalFederal(),
          });

        if (fedTD1Error) throw fedTD1Error;

        // Provincial TD1
        const { error: provTD1Error } = await supabase
          .from('employee_td1')
          .insert({
            employee_id: employee.id,
            form_type: data.jurisdiction,
            tax_year: new Date().getFullYear(),
            basic_personal_amount: data.taxCreditJ1,
            age_amount: data.taxCreditJ2,
            disability_amount: data.taxCreditJ3,
            spouse_amount: data.taxCreditJ4,
            tuition_amount: data.taxCreditJ5,
            other_credits: data.taxCreditJ6,
            additional_tax_deduction: data.taxCreditJ7,
            total_claim_amount: calculateTotalJurisdictional(),
          });

        if (provTD1Error) throw provTD1Error;
      }
      // For other countries, we could store in a generic payroll_deductions table

      // Save guarantors (any provided)
      if (organization?.id) {
        try {
          await saveGuarantorsForEmployee(employee.id, organization.id, [
            { ...guarantor1, guarantor_order: 1, full_name: guarantor1.full_name?.trim() ?? '' },
            { ...guarantor2, guarantor_order: 2, full_name: guarantor2.full_name?.trim() ?? '' },
          ]);
        } catch (gErr: any) {
          console.warn('Guarantor save warning:', gErr?.message);
        }
      }

      toast.success(`Employee ${data.firstName} ${data.lastName} added successfully!`);
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      
      // Handle duplicate constraint violations
      const errorMessage = error.message || '';
      if (errorMessage.includes('employees_organization_email_unique') || 
          errorMessage.includes('duplicate key') && errorMessage.includes('email')) {
        toast.error('An employee with this email already exists. Please use a different email address.');
      } else if (errorMessage.includes('employees_organization_employee_number_unique') ||
                 errorMessage.includes('duplicate key') && errorMessage.includes('employee_number')) {
        toast.error('An employee with this employee number already exists.');
      } else {
        toast.error(error.message || 'Failed to add employee');
      }
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
          <form onSubmit={form.handleSubmit(onSubmit)}>
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
                {activeTab === 'tax' && (
                  <Button type="button" variant="outline" onClick={() => setActiveTab('personal')}>
                    Previous
                  </Button>
                )}
                {activeTab === 'guarantors' && (
                  <Button type="button" variant="outline" onClick={() => setActiveTab('tax')}>
                    Previous
                  </Button>
                )}
                {activeTab === 'personal' && (
                  <Button type="button" onClick={() => setActiveTab('tax')}>
                    Next
                  </Button>
                )}
                {activeTab === 'tax' && (
                  <Button type="button" onClick={() => setActiveTab('guarantors')}>
                    Next
                  </Button>
                )}
                {activeTab === 'guarantors' && (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Employee'}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
