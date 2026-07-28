import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { PROVINCE_NAMES, ROE_REASON_CODES } from '@/types/payroll';
import { Textarea } from '@/components/ui/textarea';
import { Database } from '@/integrations/supabase/types';
import { User, Briefcase, DollarSign, FileText, MapPin, UserPlus } from 'lucide-react';
import { GuarantorsForm, EMPTY_GUARANTOR, type GuarantorDraft } from './GuarantorForm';
import { useEmployeeGuarantors } from '@/hooks/useEmployeeGuarantors';
import { Checkbox } from '@/components/ui/checkbox';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCountryScope } from '@/hooks/useCountryFilter';
import { getCountryLocalization, COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';


type Employee = Database['public']['Tables']['employees']['Row'];
type TD1Row = Database['public']['Tables']['employee_td1']['Row'];

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export default function EditEmployeeDialog({ open, onOpenChange, employee }: EditEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [federalTD1, setFederalTD1] = useState<TD1Row | null>(null);
  const [provincialTD1, setProvincialTD1] = useState<TD1Row | null>(null);

  // Country resolution — country scope > org.country > 'CA'
  const { organization } = useCurrentOrganization();
  const { country: scopedCountry } = useCountryScope();
  const countryCode = (() => {
    const raw = (scopedCountry || organization?.country || 'CA').toString().trim();
    if (!raw) return 'CA';
    const upper = raw.toUpperCase();
    if (COUNTRY_LOCALIZATIONS[upper]) return upper;
    const match = Object.entries(COUNTRY_LOCALIZATIONS).find(
      ([, loc]) => loc.name.toLowerCase() === raw.toLowerCase(),
    );
    return match?.[0] ?? 'CA';
  })();
  const countryConfig = getCountryLocalization(countryCode);
  const isCA = countryCode === 'CA';

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    sin_encrypted: '',
    // Address
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    country: '',
    // Employment
    job_title: '',
    department: '',
    province: '',
    employment_type: 'full_time',
    pay_frequency: 'bi_weekly',
    hire_date: '',
    termination_date: '',
    termination_reason_code: '',
    termination_reason_notes: '',
    status: 'active',
    // Compensation
    hourly_rate: '',
    annual_salary: '',
    // Exemptions
    cpp_exempt: false,
    ei_exempt: false,
  });

  // TD1 form data
  const [td1Data, setTd1Data] = useState({
    basic_personal_amount: 0,
    canada_employment_amount: 0,
    age_amount: 0,
    disability_amount: 0,
    spouse_amount: 0,
    tuition_amount: 0,
    other_credits: 0,
    additional_tax_deduction: 0,
    // Provincial
    prov_basic_personal_amount: 0,
    prov_age_amount: 0,
    prov_disability_amount: 0,
    prov_spouse_amount: 0,
    prov_tuition_amount: 0,
    prov_other_credits: 0,
    prov_additional_tax_deduction: 0,
  });

  useEffect(() => {
    if (employee && open) {
      setFormData({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        date_of_birth: employee.date_of_birth || '',
        sin_encrypted: employee.sin_encrypted || '',
        address_line1: employee.address_line1 || '',
        address_line2: employee.address_line2 || '',
        city: employee.city || '',
        postal_code: employee.postal_code || '',
        country: employee.country || '',
        job_title: employee.job_title || '',
        department: employee.department || '',
        province: employee.province || countryConfig.jurisdictions[0]?.code || 'ON',
        employment_type: employee.employment_type || 'full_time',
        pay_frequency: employee.pay_frequency || 'bi_weekly',
        hire_date: employee.hire_date || '',
        termination_date: (employee as any).termination_date || '',
        termination_reason_code: (employee as any).termination_reason_code || '',
        termination_reason_notes: (employee as any).termination_reason_notes || '',
        status: employee.status || 'active',
        hourly_rate: employee.hourly_rate?.toString() || '',
        annual_salary: employee.annual_salary?.toString() || '',
        cpp_exempt: employee.cpp_exempt ?? false,
        ei_exempt: employee.ei_exempt ?? false,
      });
      setActiveTab('personal');
      if (isCA) loadTD1Data(employee.id);
    }
  }, [employee, open]);

  const loadTD1Data = async (employeeId: string) => {
    const { data } = await supabase
      .from('employee_td1')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tax_year', new Date().getFullYear());

    if (data) {
      const federal = data.find(d => d.form_type === 'federal');
      const provincial = data.find(d => d.form_type !== 'federal');
      setFederalTD1(federal || null);
      setProvincialTD1(provincial || null);

      setTd1Data({
        basic_personal_amount: federal?.basic_personal_amount || 0,
        canada_employment_amount: federal?.canada_employment_amount || 0,
        age_amount: federal?.age_amount || 0,
        disability_amount: federal?.disability_amount || 0,
        spouse_amount: federal?.spouse_amount || 0,
        tuition_amount: federal?.tuition_amount || 0,
        other_credits: federal?.other_credits || 0,
        additional_tax_deduction: federal?.additional_tax_deduction || 0,
        prov_basic_personal_amount: provincial?.basic_personal_amount || 0,
        prov_age_amount: provincial?.age_amount || 0,
        prov_disability_amount: provincial?.disability_amount || 0,
        prov_spouse_amount: provincial?.spouse_amount || 0,
        prov_tuition_amount: provincial?.tuition_amount || 0,
        prov_other_credits: provincial?.other_credits || 0,
        prov_additional_tax_deduction: provincial?.additional_tax_deduction || 0,
      });
    }
  };

  const federalTotal = td1Data.basic_personal_amount + td1Data.canada_employment_amount +
    td1Data.age_amount + td1Data.disability_amount + td1Data.spouse_amount +
    td1Data.tuition_amount + td1Data.other_credits;

  const provincialTotal = td1Data.prov_basic_personal_amount + td1Data.prov_age_amount +
    td1Data.prov_disability_amount + td1Data.prov_spouse_amount +
    td1Data.prov_tuition_amount + td1Data.prov_other_credits;

  const handleSubmit = async () => {
    if (!employee) return;

    if (formData.status === 'terminated' && !formData.termination_date) {
      toast.error('Termination Date is required when status is Terminated');
      setActiveTab('employment');
      return;
    }

    if (formData.status === 'terminated' && !formData.termination_reason_code) {
      toast.error('Termination Reason is required for EI / Record of Employment');
      setActiveTab('employment');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update employee record
      const updateData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        date_of_birth: formData.date_of_birth || null,
        sin_encrypted: formData.sin_encrypted || null,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        postal_code: formData.postal_code || null,
        country: formData.country || null,
        job_title: formData.job_title || null,
        department: formData.department || null,
        province: formData.province as any,
        employment_type: formData.employment_type as any,
        pay_frequency: formData.pay_frequency as any,
        hire_date: formData.hire_date,
        termination_date: formData.termination_date || null,
        termination_reason_code: formData.status === 'terminated' ? (formData.termination_reason_code || null) : null,
        termination_reason_notes: formData.status === 'terminated' ? (formData.termination_reason_notes || null) : null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        annual_salary: formData.annual_salary ? parseFloat(formData.annual_salary) : null,
        status: formData.status as any,
        cpp_exempt: formData.cpp_exempt,
        ei_exempt: formData.ei_exempt,
      };

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', employee.id);

      if (error) throw error;

      // Canadian TD1 forms — only for CA organizations
      if (isCA) {
        // Update/create federal TD1
        const federalTD1Data = {
          employee_id: employee.id,
          form_type: 'federal',
          tax_year: new Date().getFullYear(),
          basic_personal_amount: td1Data.basic_personal_amount,
          canada_employment_amount: td1Data.canada_employment_amount,
          age_amount: td1Data.age_amount,
          disability_amount: td1Data.disability_amount,
          spouse_amount: td1Data.spouse_amount,
          tuition_amount: td1Data.tuition_amount,
          other_credits: td1Data.other_credits,
          additional_tax_deduction: td1Data.additional_tax_deduction,
          total_claim_amount: federalTotal,
        };

        if (federalTD1?.id) {
          await supabase.from('employee_td1').update(federalTD1Data).eq('id', federalTD1.id);
        } else {
          await supabase.from('employee_td1').insert(federalTD1Data);
        }

        // Update/create provincial TD1
        const provTD1Data = {
          employee_id: employee.id,
          form_type: formData.province,
          tax_year: new Date().getFullYear(),
          basic_personal_amount: td1Data.prov_basic_personal_amount,
          age_amount: td1Data.prov_age_amount,
          disability_amount: td1Data.prov_disability_amount,
          spouse_amount: td1Data.prov_spouse_amount,
          tuition_amount: td1Data.prov_tuition_amount,
          other_credits: td1Data.prov_other_credits,
          additional_tax_deduction: td1Data.prov_additional_tax_deduction,
          total_claim_amount: provincialTotal,
        };

        if (provincialTD1?.id) {
          await supabase.from('employee_td1').update(provTD1Data).eq('id', provincialTD1.id);
        } else {
          await supabase.from('employee_td1').insert(provTD1Data);
        }
      }


      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);

      if (formData.status === 'terminated') {
        const { data: existingRoe } = await supabase
          .from('roe_records')
          .select('id')
          .eq('employee_id', employee.id)
          .limit(1);

        if (!existingRoe || existingRoe.length === 0) {
          toast.success('Employee terminated. Complete the Record of Employment (RoE).', {
            duration: 10000,
            action: {
              label: 'Create RoE',
              onClick: () => navigate('/payroll/roe'),
            },
          });
        } else {
          toast.success('Employee updated successfully');
        }
      } else {
        toast.success('Employee updated successfully');
      }
    } catch (error: any) {
      toast.error('Failed to update employee: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { formatWithSymbol } = useCurrencyFormatter();
  const formatCurrency = (val: number) => formatWithSymbol(val);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Employee
            <Badge variant="outline">{formData.first_name} {formData.last_name}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${isCA ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="personal" className="flex items-center gap-1 text-xs">
              <User className="w-3.5 h-3.5" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="employment" className="flex items-center gap-1 text-xs">
              <Briefcase className="w-3.5 h-3.5" />
              Employment
            </TabsTrigger>
            <TabsTrigger value="compensation" className="flex items-center gap-1 text-xs">
              <DollarSign className="w-3.5 h-3.5" />
              Compensation
            </TabsTrigger>
            {isCA && (
              <TabsTrigger value="tax" className="flex items-center gap-1 text-xs">
                <FileText className="w-3.5 h-3.5" />
                TD1 Tax
              </TabsTrigger>
            )}
            <TabsTrigger value="guarantors" className="flex items-center gap-1 text-xs">
              <UserPlus className="w-3.5 h-3.5" />
              Guarantors
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SIN (encrypted)</Label>
                <Input value={formData.sin_encrypted} onChange={e => setFormData({ ...formData, sin_encrypted: e.target.value })} placeholder="XXX-XXX-XXX" />
              </div>
            </div>

            {/* Address */}
            <div className="pt-2 pb-1">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Mailing Address</h3>
            </div>
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input value={formData.address_line1} onChange={e => setFormData({ ...formData, address_line1: e.target.value })} placeholder="Street address" />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input value={formData.address_line2} onChange={e => setFormData({ ...formData, address_line2: e.target.value })} placeholder="Apt, suite, unit" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} placeholder="A1A 1A1" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="Canada" />
              </div>
            </div>
          </TabsContent>

          {/* Employment Tab */}
          <TabsContent value="employment" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={formData.job_title} onChange={e => setFormData({ ...formData, job_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{countryConfig.jurisdictionLabel}</Label>
                <Select value={formData.province} onValueChange={v => setFormData({ ...formData, province: v })}>
                  <SelectTrigger><SelectValue placeholder={`Select ${countryConfig.jurisdictionLabel.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countryConfig.jurisdictions.map((j) => (
                      <SelectItem key={j.code} value={j.code}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={formData.employment_type} onValueChange={v => setFormData({ ...formData, employment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pay Frequency</Label>
                <Select value={formData.pay_frequency} onValueChange={v => setFormData({ ...formData, pay_frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hire Date</Label>
                <Input type="date" value={formData.hire_date} onChange={e => setFormData({ ...formData, hire_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.status === 'terminated' || formData.status === 'on_leave') && (
                <div className="space-y-2">
                  <Label>
                    Termination Date {formData.status === 'terminated' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    type="date"
                    value={formData.termination_date}
                    onChange={e => setFormData({ ...formData, termination_date: e.target.value })}
                  />
                  {formData.status === 'terminated' && (
                    <p className="text-xs text-muted-foreground">
                      You'll be prompted to complete the Record of Employment (RoE) after saving.
                    </p>
                  )}
                </div>
              )}
            </div>
            {formData.status === 'terminated' && (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>
                    Reason for Termination <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.termination_reason_code}
                    onValueChange={v => setFormData({ ...formData, termination_reason_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Service Canada / RoE reason code" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROE_REASON_CODES).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {code} – {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Required by Service Canada for Employment Insurance (EI). This populates the Record of Employment reason code.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Reason Notes (optional)</Label>
                  <Textarea
                    rows={3}
                    placeholder="Additional context for the termination (appears in RoE Comments)"
                    value={formData.termination_reason_notes}
                    onChange={e => setFormData({ ...formData, termination_reason_notes: e.target.value })}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Compensation Tab */}
          <TabsContent value="compensation" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input type="number" step="0.01" value={formData.hourly_rate} onChange={e => setFormData({ ...formData, hourly_rate: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Annual Salary ($)</Label>
                <Input type="number" step="0.01" value={formData.annual_salary} onChange={e => setFormData({ ...formData, annual_salary: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Set either hourly rate or annual salary (or both if applicable).</p>

            {/* Deduction Exemptions — country-aware */}
            {(() => {
              const c = (formData.country || '').toLowerCase();
              const isNG = c === 'nigeria' || c === 'ng';
              const isCA = c === '' || c === 'canada' || c === 'ca';
              if (!isNG && !isCA) return null;
              return (
                <Card className="p-4 mt-4">
                  <h4 className="font-medium mb-3">Deduction Exemptions</h4>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="cpp_exempt"
                        checked={formData.cpp_exempt}
                        onCheckedChange={(checked) => setFormData({ ...formData, cpp_exempt: checked === true })}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="cpp_exempt">{isNG ? 'Pension Exempt' : 'CPP Exempt'}</Label>
                        <p className="text-xs text-muted-foreground">
                          {isNG
                            ? 'Employee is exempt from Pension Reform Act contributions'
                            : 'Employee is exempt from Canada Pension Plan contributions (e.g., First Nations employees working on reserve)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="ei_exempt"
                        checked={formData.ei_exempt}
                        onCheckedChange={(checked) => setFormData({ ...formData, ei_exempt: checked === true })}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="ei_exempt">{isNG ? 'NHF Exempt' : 'EI Exempt'}</Label>
                        <p className="text-xs text-muted-foreground">
                          {isNG
                            ? 'Employee is exempt from National Housing Fund contributions'
                            : 'Employee is exempt from Employment Insurance premiums'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })()}
          </TabsContent>

          {/* TD1 Tax Tab — Canada only. Other countries show a localized note. */}
          <TabsContent value="tax" className="space-y-4 mt-4">
            {!isCA && (
              <Card className="p-4 bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Tax Relief — {countryConfig.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {countryCode === 'NG'
                    ? 'Nigeria does not use a TD1-style tax credit certificate. PAYE is computed automatically each pay run using the Consolidated Relief Allowance (higher of ₦200,000 or 1% of gross, plus 20% of gross) under PITA, with statutory pension and NHF deductions applied before the progressive tax bands.'
                    : `${countryConfig.name} does not use the Canadian TD1 form. Statutory deductions and reliefs are applied automatically during payroll processing based on ${countryConfig.name} rules.`}
                </p>
              </Card>
            )}
            {isCA && (
              <>
                {/* Federal TD1 */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/10">Federal</Badge>
                      TD1 - Federal
                    </h4>
                    <span className="text-sm font-medium">Total: {formatCurrency(federalTotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Basic Personal Amount</Label>
                      <Input type="number" value={td1Data.basic_personal_amount} onChange={e => setTd1Data({ ...td1Data, basic_personal_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Canada Employment Amount</Label>
                      <Input type="number" value={td1Data.canada_employment_amount} onChange={e => setTd1Data({ ...td1Data, canada_employment_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Age Amount</Label>
                      <Input type="number" value={td1Data.age_amount} onChange={e => setTd1Data({ ...td1Data, age_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Disability Amount</Label>
                      <Input type="number" value={td1Data.disability_amount} onChange={e => setTd1Data({ ...td1Data, disability_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Spouse/Dependant Amount</Label>
                      <Input type="number" value={td1Data.spouse_amount} onChange={e => setTd1Data({ ...td1Data, spouse_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tuition Amount</Label>
                      <Input type="number" value={td1Data.tuition_amount} onChange={e => setTd1Data({ ...td1Data, tuition_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Other Credits</Label>
                      <Input type="number" value={td1Data.other_credits} onChange={e => setTd1Data({ ...td1Data, other_credits: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Tax Deduction</Label>
                      <Input type="number" value={td1Data.additional_tax_deduction} onChange={e => setTd1Data({ ...td1Data, additional_tax_deduction: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </Card>

                {/* Provincial TD1 */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-secondary/50">{formData.province}</Badge>
                      TD1 - {PROVINCE_NAMES[formData.province as keyof typeof PROVINCE_NAMES] || formData.province}
                    </h4>
                    <span className="text-sm font-medium">Total: {formatCurrency(provincialTotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Basic Personal Amount</Label>
                      <Input type="number" value={td1Data.prov_basic_personal_amount} onChange={e => setTd1Data({ ...td1Data, prov_basic_personal_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Age Amount</Label>
                      <Input type="number" value={td1Data.prov_age_amount} onChange={e => setTd1Data({ ...td1Data, prov_age_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Disability Amount</Label>
                      <Input type="number" value={td1Data.prov_disability_amount} onChange={e => setTd1Data({ ...td1Data, prov_disability_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Spouse/Dependant Amount</Label>
                      <Input type="number" value={td1Data.prov_spouse_amount} onChange={e => setTd1Data({ ...td1Data, prov_spouse_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tuition Amount</Label>
                      <Input type="number" value={td1Data.prov_tuition_amount} onChange={e => setTd1Data({ ...td1Data, prov_tuition_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Other Credits</Label>
                      <Input type="number" value={td1Data.prov_other_credits} onChange={e => setTd1Data({ ...td1Data, prov_other_credits: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Tax Deduction</Label>
                      <Input type="number" value={td1Data.prov_additional_tax_deduction} onChange={e => setTd1Data({ ...td1Data, prov_additional_tax_deduction: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>


          <TabsContent value="guarantors" className="space-y-4 mt-4">
            <GuarantorsTabContent employeeId={employee.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuarantorsTabContent({ employeeId }: { employeeId: string }) {
  const { guarantors, isLoading, upsert } = useEmployeeGuarantors(employeeId);

  const seed = (order: 1 | 2): GuarantorDraft => {
    const existing = guarantors.find((g) => g.guarantor_order === order);
    if (!existing) return EMPTY_GUARANTOR(order);
    const { id: _id, employee_id: _e, organization_id: _o, ...rest } = existing;
    return { ...EMPTY_GUARANTOR(order), ...rest, guarantor_order: order };
  };

  const [g1, setG1] = useState<GuarantorDraft>(EMPTY_GUARANTOR(1));
  const [g2, setG2] = useState<GuarantorDraft>(EMPTY_GUARANTOR(2));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isLoading && !hydrated) {
      setG1(seed(1));
      setG2(seed(2));
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, guarantors.length]);

  const save = async (which: 1 | 2) => {
    const draft = which === 1 ? g1 : g2;
    if (!draft.full_name?.trim()) {
      toast.error('Full name is required');
      return;
    }
    await upsert.mutateAsync({ ...draft, employee_id: employeeId });
    toast.success(`Guarantor ${which} saved`);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading guarantors…</p>;

  return (
    <div className="space-y-4">
      <GuarantorsForm first={g1} second={g2} onChangeFirst={setG1} onChangeSecond={setG2} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => save(1)} disabled={upsert.isPending}>
          Save 1st Guarantor
        </Button>
        <Button onClick={() => save(2)} disabled={upsert.isPending}>
          Save 2nd Guarantor
        </Button>
      </div>
    </div>
  );
}
