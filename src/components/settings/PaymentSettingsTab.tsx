import { useState, useEffect } from 'react';
import { CreditCard, Building2, CheckCircle2, XCircle, Loader2, ExternalLink, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EmailSenderSettings } from './EmailSenderSettings';
import { WiseInvoicePaymentsCard } from './WiseInvoicePaymentsCard';

type ConnectionStatus = 'loading' | 'connected' | 'not-configured' | 'error';

export function PaymentSettingsTab() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('loading');
  const [isTesting, setIsTesting] = useState(false);

  const org = organization as unknown as Record<string, unknown> | undefined;
  const [enableOnlinePayments, setEnableOnlinePayments] = useState(false);
  const [creditCardEnabled, setCreditCardEnabled] = useState(true);
  const [achEnabled, setAchEnabled] = useState(false);
  const [interacEnabled, setInteracEnabled] = useState(false);

  // Payment detail fields
  const [ccInstructions, setCcInstructions] = useState('');
  const [achInstitution, setAchInstitution] = useState('');
  const [achAccountName, setAchAccountName] = useState('');
  const [achAccountNumber, setAchAccountNumber] = useState('');
  const [achTransitNumber, setAchTransitNumber] = useState('');
  const [etransferEmail, setEtransferEmail] = useState('');

  useEffect(() => {
    if (org) {
      setEnableOnlinePayments((org.invoice_enable_online_payments as boolean) ?? false);
      setCreditCardEnabled((org.invoice_credit_card_enabled as boolean) ?? true);
      setAchEnabled((org.invoice_ach_enabled as boolean) ?? false);
      setInteracEnabled((org.invoice_interac_enabled as boolean) ?? false);
      setCcInstructions((org.invoice_cc_instructions as string) ?? '');
      setAchInstitution((org.invoice_ach_institution as string) ?? '');
      setAchAccountName((org.invoice_ach_account_name as string) ?? '');
      setAchAccountNumber((org.invoice_ach_account_number as string) ?? '');
      setAchTransitNumber((org.invoice_ach_transit_number as string) ?? '');
      setEtransferEmail((org.invoice_etransfer_email as string) ?? '');
    }
  }, [org]);

  // Health check on mount
  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stripe-integration', {
          body: { action: 'health-check' },
        });
        if (error) {
          setConnectionStatus('error');
        } else if (data?.configured) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('not-configured');
        }
      } catch {
        setConnectionStatus('error');
      }
    };
    check();
  }, []);

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'test' },
      });
      if (error || !data?.success) {
        setConnectionStatus('error');
        toast.error(data?.error || 'Failed to connect to Stripe');
      } else {
        setConnectionStatus('connected');
        toast.success(`Stripe connected (Account: ${data.accountId})`);
      }
    } catch {
      setConnectionStatus('error');
      toast.error('Failed to test Stripe connection');
    } finally {
      setIsTesting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No organization');
      const { error } = await supabase
        .from('organizations')
        .update({
          invoice_enable_online_payments: enableOnlinePayments,
          invoice_credit_card_enabled: creditCardEnabled,
          invoice_ach_enabled: achEnabled,
          invoice_interac_enabled: interacEnabled,
          invoice_cc_instructions: ccInstructions || null,
          invoice_ach_institution: achInstitution || null,
          invoice_ach_account_name: achAccountName || null,
          invoice_ach_account_number: achAccountNumber || null,
          invoice_ach_transit_number: achTransitNumber || null,
          invoice_etransfer_email: etransferEmail || null,
        } as any)
        .eq('id', organization.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Payment settings saved');
    },
    onError: (error: Error) => toast.error(`Failed to save: ${error.message}`),
  });

  return (
    <div className="space-y-6">
      <EmailSenderSettings />
      {/* Stripe Connection */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          <CreditCard className="w-5 h-5 inline-block mr-2" />
          Stripe Connection
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect your Stripe account to accept online payments on invoices.
        </p>

        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground">Connection Status</span>
              {connectionStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {connectionStatus === 'connected' && (
                <Badge className="bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                </Badge>
              )}
              {connectionStatus === 'not-configured' && (
                <Badge variant="secondary">
                  <XCircle className="w-3 h-3 mr-1" /> Not Configured
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge className="bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Error
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your Stripe API key is managed by your administrator. Contact your admin to configure or update the key.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={isTesting}
          >
            {isTesting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Test Connection
          </Button>
        </div>

        {connectionStatus === 'not-configured' && (
          <div className="mt-3 p-3 rounded-lg border border-dashed text-sm text-muted-foreground flex items-start gap-2">
            <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              To set up Stripe, your admin needs to add the Stripe Secret Key. Find it in{' '}
              <strong>Stripe Dashboard → Developers → API Keys</strong>.
            </span>
          </div>
        )}
      </Card>

      {/* Payment Methods */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Payment Methods</h2>

        {connectionStatus !== 'connected' && connectionStatus !== 'loading' && (
          <div className="p-4 rounded-lg border border-warning/30 bg-warning/5 text-warning text-sm mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Connect Stripe above before enabling payment methods.</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Enable Online Payments</p>
              <p className="text-sm text-muted-foreground">Allow customers to pay invoices online</p>
            </div>
            <Switch
              checked={enableOnlinePayments}
              onCheckedChange={setEnableOnlinePayments}
              disabled={connectionStatus !== 'connected'}
            />
          </div>

          {enableOnlinePayments && connectionStatus === 'connected' && (
            <>
              <div className="p-4 border border-dashed rounded-lg bg-background">
                <p className="text-sm text-muted-foreground mb-4">
                  Select the payment methods you want to accept on invoices.
                </p>
                <div className="space-y-4">
                  {/* Credit Card */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Credit Card</p>
                          <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                        </div>
                      </div>
                      <Switch checked={creditCardEnabled} onCheckedChange={setCreditCardEnabled} />
                    </div>
                    {creditCardEnabled && (
                      <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                        <div className="pt-3">
                          <Label htmlFor="cc-instructions" className="text-xs font-medium text-muted-foreground">
                            Credit Card Payment Instructions
                          </Label>
                          <Input
                            id="cc-instructions"
                            placeholder="e.g. Payments processed via Stripe. 2.9% + $0.30 per transaction."
                            value={ccInstructions}
                            onChange={(e) => setCcInstructions(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACH / EFT */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">ACH / EFT Bank Transfer</p>
                          <p className="text-xs text-muted-foreground">Direct bank payments</p>
                        </div>
                      </div>
                      <Switch checked={achEnabled} onCheckedChange={setAchEnabled} />
                    </div>
                    {achEnabled && (
                      <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                        <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="ach-institution" className="text-xs font-medium text-muted-foreground">Institution</Label>
                            <Input id="ach-institution" placeholder="e.g. Bank of Nova Scotia" value={achInstitution} onChange={(e) => setAchInstitution(e.target.value)} className="mt-1.5" />
                          </div>
                          <div>
                            <Label htmlFor="ach-account-name" className="text-xs font-medium text-muted-foreground">Account Name</Label>
                            <Input id="ach-account-name" placeholder="e.g. Chequing - Business" value={achAccountName} onChange={(e) => setAchAccountName(e.target.value)} className="mt-1.5" />
                          </div>
                          <div>
                            <Label htmlFor="ach-transit" className="text-xs font-medium text-muted-foreground">Transit / Routing Number</Label>
                            <Input id="ach-transit" placeholder="e.g. 00152" value={achTransitNumber} onChange={(e) => setAchTransitNumber(e.target.value)} className="mt-1.5" />
                          </div>
                          <div>
                            <Label htmlFor="ach-account" className="text-xs font-medium text-muted-foreground">Account Number</Label>
                            <Input id="ach-account" placeholder="e.g. 1234567" value={achAccountNumber} onChange={(e) => setAchAccountNumber(e.target.value)} className="mt-1.5" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interac e-Transfer */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Interac e-Transfer</p>
                          <p className="text-xs text-muted-foreground">Canadian e-Transfer</p>
                        </div>
                      </div>
                      <Switch checked={interacEnabled} onCheckedChange={setInteracEnabled} />
                    </div>
                    {interacEnabled && (
                      <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                        <div className="pt-3">
                          <Label htmlFor="etransfer-email" className="text-xs font-medium text-muted-foreground">e-Transfer Email Address</Label>
                          <Input id="etransfer-email" type="email" placeholder="e.g. payments@yourcompany.com" value={etransferEmail} onChange={(e) => setEtransferEmail(e.target.value)} className="mt-1.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  <strong>✓ Stripe Connected</strong> — Customers will see a "Pay Now" button on eligible invoices.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || connectionStatus !== 'connected'}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Payment Settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
