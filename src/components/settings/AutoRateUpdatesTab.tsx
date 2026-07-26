import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  TrendingUp,
  Receipt,
  Wallet,
  Play,
  Loader2,
  Globe,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AutoRateUpdatesTabProps {
  organizationId: string;
}

// Historical rates for all supported countries (2 previous years)
const HISTORICAL_RATES: Record<string, Record<number, any>> = {
  CA: {
    2024: {
      sales_tax: [
        { code: 'GST', rate: 5, source: 'CRA RC4022' },
        { code: 'HST-ON', rate: 13, source: 'CRA RC4022' },
        { code: 'HST-ATL', rate: 15, source: 'CRA RC4022' },
        { code: 'PST-BC', rate: 7, source: 'BC Ministry of Finance' },
        { code: 'QST', rate: 9.975, source: 'Revenu Québec' },
      ],
      payroll: [
        { code: 'CPP', employee_rate: 5.95, employer_rate: 5.95, max_earnings: 68500, source: 'CRA T4032' },
        { code: 'EI', employee_rate: 1.66, employer_rate: 2.32, max_earnings: 63200, source: 'CRA T4032' },
      ],
      tax_credits: [
        { code: 'BPA', name: 'Federal Basic Personal Amount', amount: 15705, type: 'federal' },
        { code: 'CEA', name: 'Canada Employment Amount', amount: 1433, type: 'federal' },
      ],
      effective_date: '2024-01-01',
      source: 'CRA Publications 2024'
    },
    2025: {
      sales_tax: [
        { code: 'GST', rate: 5, source: 'CRA RC4022' },
        { code: 'HST-ON', rate: 13, source: 'CRA RC4022' },
        { code: 'HST-ATL', rate: 15, source: 'CRA RC4022' },
        { code: 'PST-BC', rate: 7, source: 'BC Ministry of Finance' },
        { code: 'QST', rate: 9.975, source: 'Revenu Québec' },
      ],
      payroll: [
        { code: 'CPP', employee_rate: 5.95, employer_rate: 5.95, max_earnings: 71300, source: 'CRA T4032' },
        { code: 'CPP2', employee_rate: 4.0, employer_rate: 4.0, max_earnings: 81200, source: 'CRA T4032' },
        { code: 'EI', employee_rate: 1.64, employer_rate: 2.30, max_earnings: 65700, source: 'CRA T4032' },
      ],
      tax_credits: [
        { code: 'BPA', name: 'Federal Basic Personal Amount', amount: 16129, type: 'federal' },
        { code: 'CEA', name: 'Canada Employment Amount', amount: 1472, type: 'federal' },
      ],
      effective_date: '2025-01-01',
      source: 'CRA Publications 2025'
    }
  },
  US: {
    2024: {
      sales_tax: [],
      payroll: [
        { code: 'FICA-SS', employee_rate: 6.2, employer_rate: 6.2, max_earnings: 168600, source: 'IRS Pub 15' },
        { code: 'FICA-MED', employee_rate: 1.45, employer_rate: 1.45, source: 'IRS Pub 15' },
      ],
      tax_brackets: [
        { bracket: '10%', threshold: 11600, filing: 'Single' },
        { bracket: '12%', threshold: 47150, filing: 'Single' },
        { bracket: '22%', threshold: 100525, filing: 'Single' },
        { bracket: '24%', threshold: 191950, filing: 'Single' },
      ],
      tax_credits: [
        { code: 'STD-S', name: 'Standard Deduction (Single)', amount: 14600 },
        { code: 'STD-MFJ', name: 'Standard Deduction (MFJ)', amount: 29200 },
      ],
      effective_date: '2024-01-01',
      source: 'IRS Rev. Proc. 2023-34'
    },
    2025: {
      sales_tax: [],
      payroll: [
        { code: 'FICA-SS', employee_rate: 6.2, employer_rate: 6.2, max_earnings: 176100, source: 'IRS Pub 15' },
        { code: 'FICA-MED', employee_rate: 1.45, employer_rate: 1.45, source: 'IRS Pub 15' },
      ],
      tax_brackets: [
        { bracket: '10%', threshold: 11925, filing: 'Single' },
        { bracket: '12%', threshold: 48475, filing: 'Single' },
        { bracket: '22%', threshold: 103350, filing: 'Single' },
        { bracket: '24%', threshold: 197300, filing: 'Single' },
      ],
      tax_credits: [
        { code: 'STD-S', name: 'Standard Deduction (Single)', amount: 15000 },
        { code: 'STD-MFJ', name: 'Standard Deduction (MFJ)', amount: 30000 },
      ],
      effective_date: '2025-01-01',
      source: 'IRS Rev. Proc. 2024-40'
    }
  },
  ZM: {
    2024: {
      sales_tax: [
        { code: 'VAT', rate: 16, source: 'ZRA VAT Act' },
      ],
      payroll: [
        { code: 'NAPSA', employee_rate: 5, employer_rate: 5, max_earnings: 314400, source: 'NAPSA Act' },
        { code: 'NHIMA', employee_rate: 1, employer_rate: 1, source: 'NHIMA Act' },
      ],
      tax_brackets: [
        { threshold: 4800, rate: 0 },
        { threshold: 6800, rate: 20 },
        { threshold: 8900, rate: 30 },
        { threshold: 999999, rate: 37.5 },
      ],
      effective_date: '2024-01-01',
      source: 'ZRA 2024 Budget'
    },
    2025: {
      sales_tax: [
        { code: 'VAT', rate: 16, source: 'ZRA VAT Act' },
      ],
      payroll: [
        { code: 'NAPSA', employee_rate: 5, employer_rate: 5, max_earnings: 332460, source: 'NAPSA Act' },
        { code: 'NHIMA', employee_rate: 1, employer_rate: 1, source: 'NHIMA Act' },
      ],
      tax_brackets: [
        { threshold: 5100, rate: 0 },
        { threshold: 7100, rate: 20 },
        { threshold: 9200, rate: 30 },
        { threshold: 999999, rate: 37.5 },
      ],
      effective_date: '2025-01-01',
      source: 'ZRA 2025 Budget'
    }
  },
  KE: {
    2024: {
      sales_tax: [
        { code: 'VAT', rate: 16, source: 'KRA VAT Act' },
      ],
      payroll: [
        { code: 'NSSF', employee_rate: 6, employer_rate: 6, max_earnings: 36000, source: 'NSSF Act' },
        { code: 'NHIF', employee_rate: 0, notes: 'Band-based (150-1700 KES)', source: 'NHIF Act' },
        { code: 'AHL', employee_rate: 1.5, employer_rate: 1.5, source: 'Finance Act 2023' },
      ],
      tax_brackets: [
        { threshold: 24000, rate: 10 },
        { threshold: 32333, rate: 25 },
        { threshold: 500000, rate: 30 },
        { threshold: 800000, rate: 32.5 },
      ],
      tax_credits: [
        { code: 'PR', name: 'Personal Relief', amount: 2400 },
      ],
      effective_date: '2024-01-01',
      source: 'KRA 2024'
    },
    2025: {
      sales_tax: [
        { code: 'VAT', rate: 16, source: 'KRA VAT Act' },
      ],
      payroll: [
        { code: 'NSSF-TI', employee_rate: 6, employer_rate: 6, max_earnings: 7000, source: 'NSSF Act 2013' },
        { code: 'NSSF-TII', employee_rate: 6, employer_rate: 6, max_earnings: 36000, source: 'NSSF Act 2013' },
        { code: 'SHIF', employee_rate: 2.75, notes: 'Replaced NHIF', source: 'SHA Act 2023' },
        { code: 'AHL', employee_rate: 1.5, employer_rate: 1.5, source: 'Finance Act 2024' },
      ],
      tax_brackets: [
        { threshold: 24000, rate: 10 },
        { threshold: 32333, rate: 25 },
        { threshold: 500000, rate: 30 },
        { threshold: 800000, rate: 32.5 },
      ],
      tax_credits: [
        { code: 'PR', name: 'Personal Relief', amount: 2400 },
      ],
      effective_date: '2025-01-01',
      source: 'KRA 2025'
    }
  },
  BI: {
    2024: {
      sales_tax: [
        { code: 'TVA', rate: 18, source: 'OBR Code Fiscal' },
      ],
      payroll: [
        { code: 'INSS', employee_rate: 4, employer_rate: 6, source: 'INSS' },
        { code: 'INSS-Risk', employer_rate: 3, source: 'INSS' },
      ],
      tax_brackets: [
        { threshold: 150000, rate: 0 },
        { threshold: 300000, rate: 20 },
        { threshold: 500000, rate: 30 },
        { threshold: 999999, rate: 35 },
      ],
      effective_date: '2024-01-01',
      source: 'OBR 2024'
    },
    2025: {
      sales_tax: [
        { code: 'TVA', rate: 18, source: 'OBR Code Fiscal' },
      ],
      payroll: [
        { code: 'INSS', employee_rate: 4, employer_rate: 6, source: 'INSS' },
        { code: 'INSS-Risk', employer_rate: 3, source: 'INSS' },
      ],
      tax_brackets: [
        { threshold: 150000, rate: 0 },
        { threshold: 300000, rate: 20 },
        { threshold: 500000, rate: 30 },
        { threshold: 999999, rate: 35 },
      ],
      effective_date: '2025-01-01',
      source: 'OBR 2025'
    }
  },
  NG: {
    2024: {
      sales_tax: [
        { code: 'VAT', rate: 7.5, source: 'NRS VAT Act (Finance Act 2020)' },
        { code: 'WHT-CONTRACT', rate: 5, source: 'NRS WHT Regulations' },
        { code: 'WHT-PROF', rate: 10, source: 'NRS WHT Regulations' },
      ],
      payroll: [
        { code: 'PENSION', employee_rate: 8, employer_rate: 10, source: 'PenCom PRA 2014' },
        { code: 'NHF', employee_rate: 2.5, source: 'NHF Act' },
        { code: 'ITF', employer_rate: 1, source: 'ITF Act' },
        { code: 'NSITF', employer_rate: 1, source: 'ECS Act 2010' },
      ],
      tax_brackets: [
        { threshold: 300000, rate: 7 },
        { threshold: 600000, rate: 11 },
        { threshold: 1100000, rate: 15 },
        { threshold: 1600000, rate: 19 },
        { threshold: 3200000, rate: 21 },
        { threshold: 999999999, rate: 24 },
      ],
      tax_credits: [
        { code: 'CRA', name: 'Consolidated Relief Allowance', amount: 200000, notes: '20% of gross + higher of ₦200,000 or 1% of gross' },
      ],
      effective_date: '2024-01-01',
      source: 'NRS / Finance Act 2023'
    },
    2025: {
      sales_tax: [
        { code: 'VAT', rate: 7.5, source: 'NRS VAT Act (Finance Act 2020)' },
        { code: 'WHT-CONTRACT', rate: 5, source: 'NRS WHT Regulations' },
        { code: 'WHT-PROF', rate: 10, source: 'NRS WHT Regulations' },
        { code: 'TET', rate: 3, source: 'Finance Act 2023' },
      ],
      payroll: [
        { code: 'PENSION', employee_rate: 8, employer_rate: 10, source: 'PenCom PRA 2014' },
        { code: 'NHF', employee_rate: 2.5, source: 'NHF Act' },
        { code: 'ITF', employer_rate: 1, source: 'ITF Act' },
        { code: 'NSITF', employer_rate: 1, source: 'ECS Act 2010' },
      ],
      tax_brackets: [
        { threshold: 300000, rate: 7 },
        { threshold: 600000, rate: 11 },
        { threshold: 1100000, rate: 15 },
        { threshold: 1600000, rate: 19 },
        { threshold: 3200000, rate: 21 },
        { threshold: 999999999, rate: 24 },
      ],
      tax_credits: [
        { code: 'CRA', name: 'Consolidated Relief Allowance', amount: 200000, notes: '20% of gross + higher of ₦200,000 or 1% of gross' },
      ],
      effective_date: '2025-01-01',
      source: 'NRS / Finance Act 2023'
    }
  }
};

const COUNTRY_LABELS: Record<string, { name: string; flag: string; currency: string; authority: string }> = {
  CA: { name: 'Canada', flag: '🇨🇦', currency: 'CAD', authority: 'CRA' },
  US: { name: 'United States', flag: '🇺🇸', currency: 'USD', authority: 'IRS' },
  NG: { name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', authority: 'FIRS' },
  ZM: { name: 'Zambia', flag: '🇿🇲', currency: 'ZMW', authority: 'ZRA' },
  KE: { name: 'Kenya', flag: '🇰🇪', currency: 'KES', authority: 'KRA' },
  BI: { name: 'Burundi', flag: '🇧🇮', currency: 'BIF', authority: 'OBR' },
};


export function AutoRateUpdatesTab({ organizationId }: AutoRateUpdatesTabProps) {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const [checkingRates, setCheckingRates] = useState(false);
  const [updateType, setUpdateType] = useState<'both' | 'sales_tax' | 'payroll'>('both');
  const [selectedCountry, setSelectedCountry] = useState<string>('CA');

  // Get organization's country code
  const orgCountryCode = useMemo(() => {
    return organization?.country || 'CA';
  }, [organization]);

  // Fetch rate update logs
  const { data: rateLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['rate-update-logs', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_update_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Deduplicate pending logs - keep only most recent per effective date
  const uniquePendingLogs = useMemo(() => {
    const pending = rateLogs.filter(l => l.status === 'pending');
    const seen = new Map<string, typeof pending[0]>();
    
    pending.forEach(log => {
      const key = log.effective_date;
      const existing = seen.get(key);
      if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
        seen.set(key, log);
      }
    });
    
    return Array.from(seen.values());
  }, [rateLogs]);

  // Fetch scheduled rate updates
  const { data: scheduledUpdates = [] } = useQuery({
    queryKey: ['scheduled-rate-updates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_rate_updates')
        .select('*')
        .gte('effective_date', new Date().toISOString().split('T')[0])
        .order('effective_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Check for rate updates
  const checkRatesMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('ai-rate-update', {
        body: {
          organization_id: organizationId,
          update_type: updateType,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rate-update-logs'] });
      if (data.changes?.sales_tax_changes?.length > 0 || data.changes?.payroll_changes?.length > 0) {
        toast.success('Rate updates found! Review and apply changes below.');
      } else {
        toast.info('No rate updates detected for your jurisdiction.');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to check rates: ${error.message}`);
    },
  });

  // Apply rate updates
  const applyRatesMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('apply-rate-update', {
        body: { log_id: logId },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rate-update-logs'] });
      queryClient.invalidateQueries({ queryKey: ['tax-types'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-deductions'] });
      if (data.success) {
        toast.success('Rate updates applied successfully!');
      } else {
        toast.warning('Rate updates applied with some errors. Check the log for details.');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply rates: ${error.message}`);
    },
  });

  const handleCheckRates = async () => {
    setCheckingRates(true);
    try {
      await checkRatesMutation.mutateAsync();
    } finally {
      setCheckingRates(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Applied</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const currentYear = new Date().getFullYear();
  const nextJan1 = new Date(currentYear + 1, 0, 1);
  const daysUntilNewYear = Math.ceil((nextJan1.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Get historical rates for selected country
  const historicalRates = HISTORICAL_RATES[selectedCountry] || {};
  const availableYears = Object.keys(historicalRates).map(Number).sort((a, b) => b - a);

  if (logsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Automatic Rate Updates</h2>
              <p className="text-sm text-muted-foreground">
                AI-powered tax and payroll rate updates from official revenue authorities
              </p>
            </div>
          </div>
        </div>

        {/* New Year Alert */}
        {daysUntilNewYear <= 60 && (
          <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <Calendar className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">Upcoming Rate Changes</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              New tax rates take effect on January 1st, {currentYear + 1} ({daysUntilNewYear} days away). 
              Check for updates to ensure your rates are current.
            </AlertDescription>
          </Alert>
        )}

        {/* Organization Province/State & Payroll Account Info */}
        {(organization?.province || organization?.payroll_account_number) && (
          <Alert className="mb-4">
            <Globe className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              {organization?.province && (
                <div>Organization province/state: <strong>{organization.province}</strong> — Rate updates will target this jurisdiction's provincial/state rates.</div>
              )}
              {organization?.payroll_account_number && (
                <div>Payroll account number: <strong>{organization.payroll_account_number}</strong> — This number will be applied to T4/T4A slips.</div>
              )}
              {!organization?.payroll_account_number && (
                <div className="text-muted-foreground text-xs">⚠️ No payroll account number set. Configure it in Organization Settings to populate T4/T4A slips correctly.</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Update Type</label>
            <Select value={updateType} onValueChange={(v) => setUpdateType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Both Tax & Payroll
                  </div>
                </SelectItem>
                <SelectItem value="sales_tax">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Sales Tax Only
                  </div>
                </SelectItem>
                <SelectItem value="payroll">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Payroll Only
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              className="w-full" 
              onClick={handleCheckRates}
              disabled={checkingRates}
            >
              {checkingRates ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking Rates...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check for Rate Updates
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-primary">{currentYear}</p>
              <p className="text-xs text-muted-foreground">Current Tax Year</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-foreground">{rateLogs.filter(l => l.status === 'applied').length}</p>
              <p className="text-xs text-muted-foreground">Updates Applied</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Pending Updates - Deduplicated */}
      {uniquePendingLogs.length > 0 && (
        <Card className="p-6 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">Pending Rate Update</h2>
            <Badge variant="secondary">{uniquePendingLogs.length} pending</Badge>
          </div>
          
          {uniquePendingLogs.map((log) => {
            const changes = log.changes_detected as any;
            return (
              <div key={log.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">
                      Rate Update for {format(new Date(log.effective_date), 'MMMM d, yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Detected on {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => applyRatesMutation.mutate(log.id)}
                    disabled={applyRatesMutation.isPending}
                  >
                    {applyRatesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    Apply Updates
                  </Button>
                </div>

                {/* Sales Tax Changes */}
                {changes?.sales_tax_changes?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Receipt className="w-4 h-4" /> Sales Tax Updates
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {changes.sales_tax_changes.slice(0, 6).map((change: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 rounded bg-muted/50">
                          <span className="font-mono">{change.code}</span>
                          <span className="text-primary ml-2">{change.current_rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payroll Changes */}
                {changes?.payroll_changes?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> Payroll Rate Updates
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {changes.payroll_changes.map((change: any, idx: number) => {
                        // Convert decimal rates to percentages if they appear to be decimals
                        const formatRate = (rate: number) => {
                          if (rate === undefined || rate === null) return null;
                          // If rate is less than 1, it's likely a decimal (0.0595 = 5.95%)
                          const displayRate = rate < 1 ? rate * 100 : rate;
                          return displayRate.toFixed(2).replace(/\.?0+$/, '');
                        };
                        return (
                          <div key={idx} className="text-sm p-2 rounded bg-muted/50">
                            <span className="font-mono">{change.code}</span>
                            {change.employee_rate !== undefined && (
                              <span className="text-muted-foreground ml-2">
                                EE: {formatRate(change.employee_rate)}%
                              </span>
                            )}
                            {change.employer_rate !== undefined && (
                              <span className="text-muted-foreground ml-2">
                                ER: {formatRate(change.employer_rate)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tax Credits */}
                {changes?.tax_credits?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Personal Tax Credits
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {changes.tax_credits.slice(0, 6).map((credit: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">{credit.code}</span>
                            <Badge variant="outline" className="text-[10px] px-1">
                              {credit.type}
                            </Badge>
                          </div>
                          <span className="text-primary font-medium">${credit.amount?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tax Brackets */}
                {changes?.tax_brackets?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Income Tax Brackets
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {[...new Set((changes.tax_brackets as any[]).map((b: any) => b.rate))].slice(0, 5).map((rate: number, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[10px]">
                          {rate}%
                        </Badge>
                      ))}
                      {[...new Set((changes.tax_brackets as any[]).map((b: any) => b.rate))].length > 5 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{[...new Set((changes.tax_brackets as any[]).map((b: any) => b.rate))].length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Authority Sources */}
                {(changes?.cra_sources?.length > 0 || changes?.authority_sources?.length > 0) && (
                  <div className="mb-3 border-t pt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Official Sources:</p>
                    <div className="flex flex-wrap gap-1">
                      {(changes.cra_sources || changes.authority_sources || []).slice(0, 4).map((source: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {log.ai_confidence && (
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant={log.ai_confidence > 0.8 ? 'default' : 'secondary'}>
                      {(Number(log.ai_confidence) * 100).toFixed(0)}% confidence
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Source: {(log.ai_source === 'lovable_ai' || log.ai_source === 'efinsuite_ai') ? 'EfinSuite AI' : log.ai_source === 'fallback' ? 'Fallback Data' : log.ai_source}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Historical Rates by Country */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Historical Rate Reference</h2>
          <Badge variant="outline">Last 2 Years</Badge>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Select Country</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(COUNTRY_LABELS).map(([code, info]) => (
              <Button
                key={code}
                variant={selectedCountry === code ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCountry(code)}
                className="gap-2"
              >
                <span>{info.flag}</span>
                <span>{info.name}</span>
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue={availableYears[0]?.toString()} className="w-full">
          <TabsList className="mb-4">
            {availableYears.map(year => (
              <TabsTrigger key={year} value={year.toString()}>
                {year}
              </TabsTrigger>
            ))}
          </TabsList>

          {availableYears.map(year => {
            const rates = historicalRates[year];
            if (!rates) return null;
            
            const countryInfo = COUNTRY_LABELS[selectedCountry];

            return (
              <TabsContent key={year} value={year.toString()} className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span>Effective from {rates.effective_date}</span>
                  <Badge variant="outline" className="text-xs">{countryInfo.authority}</Badge>
                </div>

                {/* Sales Tax */}
                {rates.sales_tax?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Receipt className="w-4 h-4" /> Sales Tax / VAT
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {rates.sales_tax.map((tax: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 rounded bg-muted/50">
                          <span className="font-mono">{tax.code}</span>
                          <span className="text-primary ml-2">{tax.rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payroll Rates */}
                {rates.payroll?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> Payroll Contributions
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {rates.payroll.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 rounded bg-muted/50 space-y-1">
                          <div className="font-medium">{item.code}</div>
                          <div className="text-muted-foreground text-xs">
                            {item.employee_rate !== undefined && <span>EE: {item.employee_rate}% </span>}
                            {item.employer_rate !== undefined && <span>ER: {item.employer_rate}%</span>}
                            {item.max_earnings && (
                              <span className="ml-2">
                                Max: {countryInfo.currency} {item.max_earnings.toLocaleString()}
                              </span>
                            )}
                            {item.notes && <span className="block italic">{item.notes}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tax Credits / Deductions */}
                {rates.tax_credits?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Tax Credits / Deductions
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {rates.tax_credits.map((credit: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 rounded bg-muted/50">
                          <div className="font-mono text-xs">{credit.code}</div>
                          <div className="text-primary font-medium">
                            {countryInfo.currency} {credit.amount?.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{credit.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tax Brackets */}
                {rates.tax_brackets?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Income Tax Brackets
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {rates.tax_brackets.map((bracket: any, idx: number) => (
                        <Badge key={idx} variant="outline">
                          {bracket.rate}% {bracket.filing && `(${bracket.filing})`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Source: {rates.source}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </Card>

      {/* Update History */}
      <Card className="p-6">
        <Accordion type="single" collapsible defaultValue="history">
          <AccordionItem value="history" className="border-none">
            <AccordionTrigger className="hover:no-underline py-0">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Update History</h2>
                <Badge variant="secondary">{rateLogs.length} entries</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              {rateLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(new Date(log.effective_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.update_type}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(log.ai_source === 'lovable_ai' || log.ai_source === 'efinsuite_ai') ? 'EfinSuite AI' : log.ai_source === 'fallback' ? 'Fallback Data' : log.ai_source === 'fallback_after_error' ? 'Fallback (Error)' : log.ai_source || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.applied_at 
                            ? format(new Date(log.applied_at), 'MMM d, yyyy')
                            : '—'
                          }
                        </TableCell>
                        <TableCell>
                          {log.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => applyRatesMutation.mutate(log.id)}
                              disabled={applyRatesMutation.isPending}
                              className="gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Apply
                            </Button>
                          )}
                          {log.status === 'applied' && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Applied
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No rate updates yet.</p>
                  <p className="text-sm">Click "Check for Rate Updates" to get started.</p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Info Card */}
      <Card className="p-6 bg-muted/30">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-primary mt-1" />
          <div>
            <h3 className="font-semibold mb-1">AI-Powered Tax Authority Rate Updates</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>🇨🇦 Canada:</strong> CRA - GST/HST/PST, CPP/EI, Federal & Provincial Tax Credits (TD1)</li>
              <li>• <strong>🇺🇸 USA:</strong> IRS - FICA, Medicare, FUTA, Federal Tax Brackets</li>
              <li>• <strong>🇳🇬 Nigeria:</strong> FIRS - VAT, WHT, PAYE Brackets, Pension, NHF, ITF, NSITF, TET, CIT</li>
              <li>• <strong>🇿🇲 Zambia:</strong> ZRA - VAT, NAPSA, NHIMA, PAYE Brackets</li>
              <li>• <strong>🇰🇪 Kenya:</strong> KRA - VAT, NSSF, SHIF, Housing Levy, PAYE</li>
              <li>• <strong>🇧🇮 Burundi:</strong> OBR - TVA, INSS, IPR Brackets</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
