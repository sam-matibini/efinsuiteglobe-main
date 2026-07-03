import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, CheckCircle2, Circle, Clock, AlertCircle, User, Briefcase, CreditCard, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ProvinceCode, PROVINCE_NAMES, OnboardingStatus } from '@/types/payroll';
import { TD1_DEFAULTS, DEFAULT_ONBOARDING_TASKS } from '@/data/canadianTaxData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { getCountryPayrollConfig } from '@/data/globalPayrollDefaults';

interface TD1Suggestion {
  credit_name: string;
  field_name: string;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface OnboardingTaskItem {
  id: string;
  task_name: string;
  task_category: string;
  description?: string;
  status: OnboardingStatus;
}

// Country-specific onboarding tasks
function getLocalizedOnboardingTasks(countryCode: string) {
  const payrollConfig = getCountryPayrollConfig(countryCode);
  
  const baseTasks = [
    { task_name: 'Policy Acknowledgement', task_category: 'compliance', description: 'Read and acknowledge company policies', sort_order: 10 },
    { task_name: 'Direct Deposit Setup', task_category: 'setup', description: 'Provide banking information for pay deposits', sort_order: 4 },
    { task_name: 'Emergency Contact Info', task_category: 'documents', description: 'Provide emergency contact information', sort_order: 5 },
    { task_name: 'Employment Contract', task_category: 'documents', description: 'Sign employment contract and offer letter', sort_order: 6 },
    { task_name: 'Benefits Enrollment', task_category: 'setup', description: 'Enroll in company benefits program', sort_order: 7 },
    { task_name: 'IT Access Setup', task_category: 'setup', description: 'Set up email, computer access, and accounts', sort_order: 8 },
    { task_name: 'Safety Training', task_category: 'training', description: 'Complete workplace safety orientation', sort_order: 9 },
  ];

  // Country-specific tax form tasks
  const taxFormTasks: { task_name: string; task_category: string; description: string; sort_order: number }[] = [];
  
  switch (countryCode) {
    case 'CA':
      taxFormTasks.push(
        { task_name: 'Complete TD1 Federal Form', task_category: 'compliance', description: 'Personal Tax Credits Return - Federal', sort_order: 1 },
        { task_name: 'Complete TD1 Provincial Form', task_category: 'compliance', description: 'Personal Tax Credits Return - Provincial', sort_order: 2 },
        { task_name: 'Provide SIN', task_category: 'documents', description: 'Social Insurance Number for payroll', sort_order: 3 }
      );
      break;
    case 'US':
      taxFormTasks.push(
        { task_name: 'Complete W-4 Form', task_category: 'compliance', description: 'Employee Withholding Certificate - Federal', sort_order: 1 },
        { task_name: 'Complete State W-4 Form', task_category: 'compliance', description: 'State Withholding Certificate', sort_order: 2 },
        { task_name: 'Provide SSN', task_category: 'documents', description: 'Social Security Number for payroll', sort_order: 3 }
      );
      break;
    case 'ZM':
      taxFormTasks.push(
        { task_name: 'Complete Tax Registration', task_category: 'compliance', description: 'ZRA Tax Registration', sort_order: 1 },
        { task_name: 'NAPSA Registration', task_category: 'compliance', description: 'National Pension Scheme Registration', sort_order: 2 },
        { task_name: 'Provide NRC', task_category: 'documents', description: 'National Registration Card for payroll', sort_order: 3 }
      );
      break;
    case 'KE':
      taxFormTasks.push(
        { task_name: 'KRA PIN Registration', task_category: 'compliance', description: 'Kenya Revenue Authority PIN', sort_order: 1 },
        { task_name: 'NHIF Registration', task_category: 'compliance', description: 'National Hospital Insurance Fund', sort_order: 2 },
        { task_name: 'Provide National ID', task_category: 'documents', description: 'National ID Number for payroll', sort_order: 3 }
      );
      break;
    case 'BI':
      taxFormTasks.push(
        { task_name: 'OBR Tax Registration', task_category: 'compliance', description: 'Office Burundais des Recettes Registration', sort_order: 1 },
        { task_name: 'INSS Registration', task_category: 'compliance', description: 'Social Security Registration', sort_order: 2 },
        { task_name: 'Provide CNI', task_category: 'documents', description: 'Carte Nationale d\'Identité for payroll', sort_order: 3 }
      );
      break;
    default:
      taxFormTasks.push(
        { task_name: 'Complete Tax Forms', task_category: 'compliance', description: 'Complete required tax forms', sort_order: 1 },
        { task_name: 'Provide National ID', task_category: 'documents', description: 'National identification for payroll', sort_order: 3 }
      );
  }

  return [...taxFormTasks, ...baseTasks].sort((a, b) => a.sort_order - b.sort_order);
}

export default function EmployeeOnboarding() {
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [td1Suggestions, setTd1Suggestions] = useState<TD1Suggestion[]>([]);
  
  // Determine country code from organization
  const countryCode = useMemo(() => {
    if (organization?.country) {
      const upperCountry = organization.country.toUpperCase();
      if (COUNTRY_LOCALIZATIONS[upperCountry]) return upperCountry;
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    return 'CA';
  }, [organization?.country]);

  const countryConfig = COUNTRY_LOCALIZATIONS[countryCode];
  const payrollConfig = getCountryPayrollConfig(countryCode);
  const isCanada = countryCode === 'CA';
  const isUSA = countryCode === 'US';

  // Get jurisdiction options based on country
  const jurisdictionOptions = useMemo(() => {
    if (countryCode === 'CA') {
      return Object.entries(PROVINCE_NAMES).map(([code, name]) => ({ code, name }));
    }
    return countryConfig?.jurisdictions?.map(j => ({ code: j.code, name: j.name })) || [];
  }, [countryCode, countryConfig]);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    national_id: '', // Generic - SIN, SSN, NRC, etc.
    address_line1: '',
    address_line2: '',
    city: '',
    jurisdiction: countryCode === 'CA' ? 'ON' : (jurisdictionOptions[0]?.code || ''),
    postal_code: '',
    hire_date: new Date().toISOString().split('T')[0],
    employment_type: 'full_time',
    department: '',
    job_title: '',
    pay_frequency: 'bi_weekly',
    annual_salary: '',
    hourly_rate: '',
    bank_institution: '',
    bank_transit: '',
    bank_account: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
  });

  const [td1Data, setTd1Data] = useState({
    federal: {
      basic_personal_amount: isCanada ? TD1_DEFAULTS.federal.basicPersonalAmount : payrollConfig.federalTaxCredits[0]?.defaultAmount || 0,
      canada_employment_amount: isCanada ? TD1_DEFAULTS.federal.canadaEmploymentAmount : 0,
      age_amount: 0,
      disability_amount: 0,
      spouse_amount: 0,
      tuition_amount: 0,
      other_credits: 0,
    },
    provincial: {
      basic_personal_amount: isCanada ? (TD1_DEFAULTS['ON']?.basicPersonalAmount || 0) : 0,
      age_amount: 0,
      disability_amount: 0,
      spouse_amount: 0,
      tuition_amount: 0,
      other_credits: 0,
    }
  });

  const localizedTasks = useMemo(() => getLocalizedOnboardingTasks(countryCode), [countryCode]);

  const [tasks, setTasks] = useState<OnboardingTaskItem[]>(
    localizedTasks.map((t, idx) => ({
      id: `task-${idx}`,
      ...t,
      status: 'pending' as OnboardingStatus
    }))
  );

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progress = Math.round((completedTasks / tasks.length) * 100);

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update provincial TD1 defaults when jurisdiction changes (Canada only)
    if (field === 'jurisdiction' && isCanada) {
      const provinceDefaults = TD1_DEFAULTS[value as ProvinceCode] || TD1_DEFAULTS.ON;
      setTd1Data(prev => ({
        ...prev,
        provincial: {
          ...prev.provincial,
          basic_personal_amount: provinceDefaults.basicPersonalAmount,
        }
      }));
    }
  };

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
        : t
    ));
  };

  const getAITD1Suggestions = async (formType: 'federal' | 'provincial') => {
    if (!isCanada) {
      toast.info('AI suggestions are currently only available for Canadian employees');
      return;
    }
    
    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('td1-ai-assist', {
        body: {
          employee: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            date_of_birth: formData.date_of_birth,
            employment_type: formData.employment_type,
            annual_salary: formData.annual_salary ? parseFloat(formData.annual_salary) : null,
            hire_date: formData.hire_date,
          },
          province: formData.jurisdiction,
          formType
        }
      });

      if (error) throw error;

      if (data.suggestions) {
        setTd1Suggestions(data.suggestions);
        
        const highConfidence = data.suggestions.filter((s: TD1Suggestion) => s.confidence === 'high');
        const updates: Record<string, number> = {};
        
        highConfidence.forEach((s: TD1Suggestion) => {
          updates[s.field_name] = s.amount;
        });

        if (formType === 'federal') {
          setTd1Data(prev => ({ ...prev, federal: { ...prev.federal, ...updates } }));
        } else {
          setTd1Data(prev => ({ ...prev, provincial: { ...prev.provincial, ...updates } }));
        }

        toast.success(`AI suggested ${data.suggestions.length} tax credits`);
      }
    } catch (err) {
      console.error('AI TD1 error:', err);
      toast.error('Failed to get AI suggestions');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast.error('Please fill in required fields');
      return;
    }

    // Send onboarding welcome email via SendGrid
    try {
      const orgName = organization?.name || 'Your Organization';
      const employeeName = `${formData.first_name} ${formData.last_name}`;
      const hireDate = formData.hire_date ? new Date(formData.hire_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';

      const onboardingHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e3a5f; margin: 0; font-size: 28px;">Welcome to the Team! 🎉</h1>
          </div>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 12px 0;">
              Hi <strong>${employeeName}</strong>,
            </p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 12px 0;">
              We're excited to have you join <strong>${orgName}</strong>!
              Your start date is <strong>${hireDate}</strong>.
            </p>
            ${formData.department ? `<p style="color: #334155; font-size: 15px; margin: 0;">Department: <strong>${formData.department}</strong></p>` : ''}
            ${formData.job_title ? `<p style="color: #334155; font-size: 15px; margin: 0;">Position: <strong>${formData.job_title}</strong></p>` : ''}
          </div>
          <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 16px;">📋 Next Steps</h3>
            <ul style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Complete your onboarding checklist</li>
              <li>Set up direct deposit information</li>
              <li>Submit required tax forms</li>
              <li>Review company policies</li>
              <li>Complete safety training</li>
            </ul>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            If you have any questions, please reach out to your HR team.
          </p>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
            <p style="margin: 0;">© ${new Date().getFullYear()} efinsuite Globe. All rights reserved.</p>
          </div>
        </div>
      `;

      const { error: emailError } = await supabase.functions.invoke('resend-integration', {
        body: {
          action: 'send-email',
          to: formData.email,
          subject: `Welcome to ${orgName} - Your Onboarding Information`,
          html: onboardingHtml,
          message: `Welcome to ${orgName}! Your start date is ${hireDate}.`,
          includeBranding: false, // branding is already in the HTML
        },
      });

      if (emailError) {
        console.error('Onboarding email error:', emailError);
        toast.warning('Employee saved but onboarding email could not be sent');
      } else {
        toast.success('Employee saved and onboarding email sent!');
      }
    } catch (err) {
      console.error('Onboarding email send failed:', err);
      toast.warning('Employee saved but onboarding email failed to send');
    }

    navigate('/payroll/employees');
  };

  const taskCategories = ['compliance', 'documents', 'setup', 'training'];
  const categoryIcons: Record<string, typeof FileText> = {
    compliance: Shield,
    documents: FileText,
    setup: Briefcase,
    training: User,
  };

  // Get localized labels
  const nationalIdLabel = payrollConfig.nationalIdLabel;
  const nationalIdPlaceholder = payrollConfig.nationalIdPlaceholder;
  const jurisdictionLabel = countryConfig?.jurisdictionLabel || 'Province/State';
  const postalCodeLabel = countryCode === 'US' ? 'ZIP Code' : countryCode === 'CA' ? 'Postal Code' : 'Postal/ZIP Code';

  // Get jurisdiction name for display
  const getJurisdictionName = (code: string) => {
    if (isCanada) return PROVINCE_NAMES[code as ProvinceCode] || code;
    const jurisdiction = countryConfig?.jurisdictions?.find(j => j.code === code);
    return jurisdiction?.name || code;
  };

  // Render tax forms tab based on country
  const renderTaxFormsTab = () => {
    if (isCanada) {
      return (
        <>
          {/* Federal TD1 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-foreground">TD1 Federal Form</h4>
                <p className="text-sm text-muted-foreground">Personal Tax Credits Return</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => getAITD1Suggestions('federal')} disabled={isLoadingAI}>
                <Sparkles className="w-4 h-4 mr-2" />
                {isLoadingAI ? 'Analyzing...' : 'AI Suggest'}
              </Button>
            </div>
            
            {td1Suggestions.length > 0 && (
              <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary mb-2">AI Suggestions Applied</p>
                <div className="space-y-1">
                  {td1Suggestions.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{s.credit_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">${s.amount.toLocaleString()}</span>
                        <Badge variant="outline" className={cn(
                          s.confidence === 'high' ? 'border-success text-success' :
                          s.confidence === 'medium' ? 'border-warning text-warning' :
                          'border-muted-foreground'
                        )}>
                          {s.confidence}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Basic Personal Amount</Label>
                <Input type="number" value={td1Data.federal.basic_personal_amount} onChange={e => setTd1Data(prev => ({ ...prev, federal: { ...prev.federal, basic_personal_amount: parseFloat(e.target.value) || 0 } }))} className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label>Canada Employment Amount</Label>
                <Input type="number" value={td1Data.federal.canada_employment_amount} onChange={e => setTd1Data(prev => ({ ...prev, federal: { ...prev.federal, canada_employment_amount: parseFloat(e.target.value) || 0 } }))} className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label>Age Amount (65+)</Label>
                <Input type="number" value={td1Data.federal.age_amount} onChange={e => setTd1Data(prev => ({ ...prev, federal: { ...prev.federal, age_amount: parseFloat(e.target.value) || 0 } }))} className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label>Disability Amount</Label>
                <Input type="number" value={td1Data.federal.disability_amount} onChange={e => setTd1Data(prev => ({ ...prev, federal: { ...prev.federal, disability_amount: parseFloat(e.target.value) || 0 } }))} className="mt-1.5 font-mono" />
              </div>
            </div>
            <div className="mt-3 p-3 bg-muted/50 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium">Total Federal Claim</span>
              <span className="font-mono font-bold text-lg">
                ${Object.values(td1Data.federal).reduce((a, b) => a + b, 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Provincial TD1 */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-foreground">TD1 {getJurisdictionName(formData.jurisdiction)} Form</h4>
                <p className="text-sm text-muted-foreground">Provincial Personal Tax Credits Return</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => getAITD1Suggestions('provincial')} disabled={isLoadingAI}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Suggest
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Basic Personal Amount</Label>
                <Input type="number" value={td1Data.provincial.basic_personal_amount} onChange={e => setTd1Data(prev => ({ ...prev, provincial: { ...prev.provincial, basic_personal_amount: parseFloat(e.target.value) || 0 } }))} className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label>Age Amount</Label>
                <Input type="number" value={td1Data.provincial.age_amount} onChange={e => setTd1Data(prev => ({ ...prev, provincial: { ...prev.provincial, age_amount: parseFloat(e.target.value) || 0 } }))} className="mt-1.5 font-mono" />
              </div>
            </div>
            <div className="mt-3 p-3 bg-muted/50 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium">Total Provincial Claim</span>
              <span className="font-mono font-bold text-lg">
                ${Object.values(td1Data.provincial).reduce((a, b) => a + b, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </>
      );
    }

    if (isUSA) {
      return (
        <div>
          <div className="mb-4">
            <h4 className="font-medium text-foreground">W-4 Employee's Withholding Certificate</h4>
            <p className="text-sm text-muted-foreground">Federal income tax withholding elections</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Filing Status</Label>
              <Select defaultValue="single">
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single or Married filing separately</SelectItem>
                  <SelectItem value="married_joint">Married filing jointly</SelectItem>
                  <SelectItem value="head_household">Head of household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Multiple Jobs/Spouse Works</Label>
                <Select defaultValue="no">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qualifying Children Under 17</Label>
                <Input type="number" defaultValue="0" className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Other Dependents</Label>
                <Input type="number" defaultValue="0" className="mt-1.5" />
              </div>
              <div>
                <Label>Other Income (not from jobs)</Label>
                <Input type="number" defaultValue="0" placeholder="$0.00" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Extra Withholding per Pay Period</Label>
              <Input type="number" defaultValue="0" placeholder="$0.00" className="mt-1.5" />
            </div>
          </div>
        </div>
      );
    }

    // For other countries (ZM, KE, BI)
    return (
      <div>
        <div className="mb-4">
          <h4 className="font-medium text-foreground">{payrollConfig.taxFormName}</h4>
          <p className="text-sm text-muted-foreground">{payrollConfig.taxFormDescription}</p>
        </div>
        <div className="space-y-4">
          {payrollConfig.federalDeductions.map((deduction) => (
            <div key={deduction.code}>
              <Label>{deduction.name}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">{deduction.description}</p>
              {deduction.inputType === 'boolean' ? (
                <div className="flex items-center space-x-2 mt-1.5">
                  <Checkbox id={deduction.code} defaultChecked />
                  <label htmlFor={deduction.code} className="text-sm">Enrolled</label>
                </div>
              ) : (
                <Input type="number" defaultValue={deduction.employeeRate || 0} className="mt-1.5 font-mono" />
              )}
            </div>
          ))}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Statutory deductions will be calculated automatically based on {countryConfig?.name || 'local'} tax regulations.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render banking tab based on country
  const renderBankingTab = () => {
    if (isCanada) {
      return (
        <>
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              Banking information is required for direct deposit payments. This information is encrypted and stored securely.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bank_inst">Institution Number</Label>
              <Input id="bank_inst" value={formData.bank_institution} onChange={e => updateFormData('bank_institution', e.target.value)} placeholder="XXX" maxLength={3} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="bank_transit">Transit Number</Label>
              <Input id="bank_transit" value={formData.bank_transit} onChange={e => updateFormData('bank_transit', e.target.value)} placeholder="XXXXX" maxLength={5} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="bank_account">Account Number</Label>
              <Input id="bank_account" value={formData.bank_account} onChange={e => updateFormData('bank_account', e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </>
      );
    }

    if (isUSA) {
      return (
        <>
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              Banking information is required for direct deposit payments. This information is encrypted and stored securely.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bank_routing">Routing Number (ABA)</Label>
              <Input id="bank_routing" value={formData.bank_transit} onChange={e => updateFormData('bank_transit', e.target.value)} placeholder="XXXXXXXXX" maxLength={9} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="bank_account">Account Number</Label>
              <Input id="bank_account" value={formData.bank_account} onChange={e => updateFormData('bank_account', e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="mt-4">
            <Label>Account Type</Label>
            <Select defaultValue="checking">
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    // For other countries
    return (
      <>
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-muted-foreground">
            Banking information is required for salary payments. This information is encrypted and stored securely.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input id="bank_name" value={formData.bank_institution} onChange={e => updateFormData('bank_institution', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bank_branch">Branch Name/Code</Label>
            <Input id="bank_branch" value={formData.bank_transit} onChange={e => updateFormData('bank_transit', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bank_account">Account Number</Label>
            <Input id="bank_account" value={formData.bank_account} onChange={e => updateFormData('bank_account', e.target.value)} className="mt-1.5" />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/employees')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">New Employee Onboarding</h1>
            <p className="text-muted-foreground">Complete the onboarding process for a new employee</p>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Employee
        </Button>
      </div>

      {/* Progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Onboarding Progress</span>
          <span className="text-sm text-muted-foreground">{completedTasks} of {tasks.length} tasks completed</span>
        </div>
        <Progress value={progress} className="h-2" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-0">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                  <TabsTrigger value="banking">Banking</TabsTrigger>
                  <TabsTrigger value="tax">Tax Forms</TabsTrigger>
                </TabsList>
              </CardHeader>
              
              <CardContent className="pt-6">
                <TabsContent value="personal" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input id="first_name" value={formData.first_name} onChange={e => updateFormData('first_name', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input id="last_name" value={formData.last_name} onChange={e => updateFormData('last_name', e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={formData.email} onChange={e => updateFormData('email', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={formData.phone} onChange={e => updateFormData('phone', e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input id="dob" type="date" value={formData.date_of_birth} onChange={e => updateFormData('date_of_birth', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="national_id">{nationalIdLabel}</Label>
                      <Input id="national_id" value={formData.national_id} onChange={e => updateFormData('national_id', e.target.value)} placeholder={nationalIdPlaceholder} className="mt-1.5" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address1">Address Line 1</Label>
                    <Input id="address1" value={formData.address_line1} onChange={e => updateFormData('address_line1', e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={formData.city} onChange={e => updateFormData('city', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="jurisdiction">{jurisdictionLabel} *</Label>
                      <Select value={formData.jurisdiction} onValueChange={v => updateFormData('jurisdiction', v)}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {jurisdictionOptions.map(({ code, name }) => (
                            <SelectItem key={code} value={code}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="postal">{postalCodeLabel}</Label>
                      <Input id="postal" value={formData.postal_code} onChange={e => updateFormData('postal_code', e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Emergency Contact</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="ec_name">Name</Label>
                        <Input id="ec_name" value={formData.emergency_contact_name} onChange={e => updateFormData('emergency_contact_name', e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="ec_phone">Phone</Label>
                        <Input id="ec_phone" value={formData.emergency_contact_phone} onChange={e => updateFormData('emergency_contact_phone', e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="ec_rel">Relationship</Label>
                        <Input id="ec_rel" value={formData.emergency_contact_relationship} onChange={e => updateFormData('emergency_contact_relationship', e.target.value)} className="mt-1.5" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="employment" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hire_date">Hire Date *</Label>
                      <Input id="hire_date" type="date" value={formData.hire_date} onChange={e => updateFormData('hire_date', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="emp_type">Employment Type</Label>
                      <Select value={formData.employment_type} onValueChange={v => updateFormData('employment_type', v)}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_time">Full-Time</SelectItem>
                          <SelectItem value="part_time">Part-Time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="temporary">Temporary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input id="department" value={formData.department} onChange={e => updateFormData('department', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="job_title">Job Title</Label>
                      <Input id="job_title" value={formData.job_title} onChange={e => updateFormData('job_title', e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pay_freq">Pay Frequency</Label>
                      <Select value={formData.pay_frequency} onValueChange={v => updateFormData('pay_frequency', v)}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                          <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="annual_salary">Annual Salary</Label>
                      <Input id="annual_salary" type="number" value={formData.annual_salary} onChange={e => updateFormData('annual_salary', e.target.value)} placeholder={`${payrollConfig.currencySymbol}0.00`} className="mt-1.5" />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="banking" className="space-y-4 mt-0">
                  {renderBankingTab()}
                </TabsContent>

                <TabsContent value="tax" className="space-y-6 mt-0">
                  {renderTaxFormsTab()}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Onboarding Checklist Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Onboarding Checklist</CardTitle>
              <CardDescription>Complete all tasks before finalizing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {taskCategories.map(category => {
                const categoryTasks = tasks.filter(t => t.task_category === category);
                if (categoryTasks.length === 0) return null;
                const CategoryIcon = categoryIcons[category];
                const completedInCategory = categoryTasks.filter(t => t.status === 'completed').length;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <CategoryIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">{category}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{completedInCategory}/{categoryTasks.length}</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {categoryTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 py-1.5 cursor-pointer group"
                          onClick={() => toggleTask(task.id)}
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                          )}
                          <span className={cn(
                            "text-sm",
                            task.status === 'completed' ? "text-muted-foreground line-through" : "text-foreground"
                          )}>
                            {task.task_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
