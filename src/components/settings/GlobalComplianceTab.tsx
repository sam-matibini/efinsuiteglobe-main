import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Globe, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Receipt, Wallet, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface GlobalComplianceTabProps {
  organizationId: string;
}

export function GlobalComplianceTab({ organizationId }: GlobalComplianceTabProps) {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const [runningAiSetup, setRunningAiSetup] = useState(false);

  // Fetch countries
  const { data: countries = [], isLoading: countriesLoading } = useQuery({
    queryKey: ['countries-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch organization's current country (including address country for fallback)
  const { data: orgCountry } = useQuery({
    queryKey: ['org-country', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('country_id, country')
        .eq('id', organizationId)
        .single();
      if (error) throw error;
      return data as { country_id: string | null; country: string | null };
    },
  });

  // If no country_id but has address country, try to match and auto-set
  const matchedCountryId = orgCountry?.country_id || (() => {
    if (!orgCountry?.country || countries.length === 0) return null;
    const match = countries.find(c => 
      c.name.toLowerCase() === orgCountry.country?.toLowerCase() ||
      c.code.toLowerCase() === orgCountry.country?.toLowerCase()
    );
    return match?.id || null;
  })();

  // Get the actual country data for display
  const currentCountry = countries.find(c => c.id === matchedCountryId) || null;

  // Fetch tax types for the country
  const { data: taxTypes = [] } = useQuery({
    queryKey: ['tax-types', matchedCountryId],
    queryFn: async () => {
      if (!matchedCountryId) return [];
      const { data, error } = await supabase
        .from('tax_types')
        .select('*')
        .eq('country_id', matchedCountryId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!matchedCountryId,
  });

  // Fetch payroll deduction types for the country
  const { data: payrollDeductions = [] } = useQuery({
    queryKey: ['payroll-deductions', matchedCountryId],
    queryFn: async () => {
      if (!matchedCountryId) return [];
      const { data, error } = await supabase
        .from('payroll_deduction_types')
        .select('*')
        .eq('country_id', matchedCountryId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!matchedCountryId,
  });

  // Fetch AI setup logs
  const { data: aiLogs = [] } = useQuery({
    queryKey: ['ai-setup-logs', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_setup_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Update organization country and auto-run AI setup
  const updateCountryMutation = useMutation({
    mutationFn: async (countryId: string) => {
      const country = countries.find(c => c.id === countryId);
      const { error } = await supabase
        .from('organizations')
        .update({ 
          country_id: countryId,
          currency: country?.default_currency || 'USD',
          country: country?.name || null, // Also update address country for compliance detection
        } as Record<string, unknown>)
        .eq('id', organizationId);
      if (error) throw error;
      return countryId;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['org-country'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Country updated - configuring compliance settings...');
      
      // Auto-run AI setup after country change
      await runAiSetup();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Re-run AI jurisdiction setup
  const runAiSetup = async () => {
    setRunningAiSetup(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-jurisdiction-setup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ organization_id: organizationId }),
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('AI reconfigured compliance settings');
        queryClient.invalidateQueries({ queryKey: ['ai-setup-logs'] });
        queryClient.invalidateQueries({ queryKey: ['tax-types'] });
        queryClient.invalidateQueries({ queryKey: ['payroll-deductions'] });
      } else {
        toast.error(result.error || 'AI setup failed');
      }
    } catch (error) {
      console.error('AI setup error:', error);
      toast.error('Failed to run AI setup');
    } finally {
      setRunningAiSetup(false);
    }
  };

  if (countriesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  

  return (
    <div className="space-y-6">
      {/* Country Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Jurisdiction</h2>
              <p className="text-sm text-muted-foreground">
                Your operating country determines tax and payroll rules
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={runAiSetup}
            disabled={runningAiSetup}
          >
            {runningAiSetup ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Re-run AI Setup
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Country</label>
            <Select 
              value={matchedCountryId || ''} 
              onValueChange={(value) => updateCountryMutation.mutate(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    <div className="flex items-center gap-2">
                      <span>{country.name}</span>
                      <Badge variant="outline" className="text-xs">{country.code}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentCountry && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Currency</p>
                <p className="font-semibold">{currentCountry.default_currency}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Standard</p>
                <p className="font-semibold">{currentCountry.accounting_standard || 'GAAP'}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tax Types */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Tax Types</h2>
          <Badge variant="secondary">{taxTypes.length} configured</Badge>
        </div>
        
        {taxTypes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxTypes.map((tax) => (
                <TableRow key={tax.id}>
                  <TableCell className="font-mono text-sm">{tax.code}</TableCell>
                  <TableCell>{tax.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tax.tax_category}</Badge>
                  </TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>
                    {tax.is_active ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No tax types configured for this jurisdiction.</p>
            <Button variant="link" onClick={runAiSetup} disabled={runningAiSetup}>
              Run AI Setup to configure
            </Button>
          </div>
        )}
      </Card>

      {/* Payroll Deductions */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Payroll Deductions</h2>
          <Badge variant="secondary">{payrollDeductions.length} configured</Badge>
        </div>
        
        {payrollDeductions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Employer</TableHead>
                <TableHead>Employee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollDeductions.map((ded) => (
                <TableRow key={ded.id}>
                  <TableCell className="font-mono text-sm">{ded.code}</TableCell>
                  <TableCell>{ded.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ded.deduction_category}</Badge>
                  </TableCell>
                  <TableCell>
                    {ded.is_employer_contribution ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ded.is_employee_deduction ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No payroll deductions configured for this jurisdiction.</p>
            <Button variant="link" onClick={runAiSetup} disabled={runningAiSetup}>
              Run AI Setup to configure
            </Button>
          </div>
        )}
      </Card>

      {/* AI Setup History */}
      {aiLogs.length > 0 && (
        <Card className="p-6">
          <Accordion type="single" collapsible>
            <AccordionItem value="ai-logs" className="border-none">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">AI Setup History</h2>
                  <Badge variant="secondary">{aiLogs.length} entries</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.setup_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {JSON.stringify(log.detected_value)?.slice(0, 30)}...
                        </TableCell>
                        <TableCell className="text-sm">
                          {JSON.stringify(log.applied_value)?.slice(0, 30)}...
                        </TableCell>
                        <TableCell>
                          {log.confidence_score ? (
                            <Badge variant={log.confidence_score > 0.8 ? 'default' : 'secondary'}>
                              {(log.confidence_score * 100).toFixed(0)}%
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at || '').toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}
    </div>
  );
}
