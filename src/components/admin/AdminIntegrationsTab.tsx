import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  RefreshCw,
  CreditCard,
  Mail,
  Cloud,
  Building2,
  AlertTriangle,
  Zap,
  Key,
  ExternalLink,
  PhoneCall
} from 'lucide-react';
import { VoiceSettingsPanel } from '@/components/communication/VoiceSettingsPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IntegrationStatus {
  configured: boolean;
  lastTested: string | null;
  status: 'connected' | 'error' | 'unknown';
  message?: string;
}

export function AdminIntegrationsTab() {
  // Twilio states
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [twilioEnabled, setTwilioEnabled] = useState(true);
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<IntegrationStatus>({
    configured: false,
    lastTested: null,
    status: 'unknown'
  });

  // Stripe states
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeTesting, setStripeTesting] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<IntegrationStatus>({
    configured: false,
    lastTested: null,
    status: 'unknown'
  });

  // SendGrid states
  const [sendgridApiKey, setSendgridApiKey] = useState('');
  const [showSendgridKey, setShowSendgridKey] = useState(false);
  const [sendgridEnabled, setSendgridEnabled] = useState(false);
  const [sendgridTesting, setSendgridTesting] = useState(false);
  const [sendgridSaving, setSendgridSaving] = useState(false);
  const [sendgridStatus, setSendgridStatus] = useState<IntegrationStatus>({
    configured: false,
    lastTested: null,
    status: 'unknown'
  });

  // Mailchimp Transactional states
  const [mailchimpApiKey, setMailchimpApiKey] = useState('');
  const [showMailchimpKey, setShowMailchimpKey] = useState(false);
  const [mailchimpEnabled, setMailchimpEnabled] = useState(false);
  const [mailchimpTesting, setMailchimpTesting] = useState(false);
  const [mailchimpSaving, setMailchimpSaving] = useState(false);
  const [mailchimpStatus, setMailchimpStatus] = useState<IntegrationStatus>({
    configured: false,
    lastTested: null,
    status: 'unknown'
  });

  // Plaid states
  const [plaidClientId, setPlaidClientId] = useState('');
  const [plaidSecret, setPlaidSecret] = useState('');
  const [plaidEnvironment, setPlaidEnvironment] = useState('sandbox');
  const [showPlaidSecret, setShowPlaidSecret] = useState(false);
  const [plaidEnabled, setPlaidEnabled] = useState(false);
  const [plaidTesting, setPlaidTesting] = useState(false);
  const [plaidSaving, setPlaidSaving] = useState(false);
  const [plaidStatus, setPlaidStatus] = useState<IntegrationStatus>({
    configured: false,
    lastTested: null,
    status: 'unknown'
  });

  // Load integration statuses on mount
  useEffect(() => {
    loadIntegrationStatuses();
  }, []);

  const loadIntegrationStatuses = async () => {
    // Check Twilio
    checkTwilioStatus();
    // Check Stripe
    checkStripeStatus();
    // Check SendGrid
    checkSendgridStatus();
    // Check Mailchimp
    checkMailchimpStatus();
    // Check Plaid
    checkPlaidStatus();
    
    // Load saved settings from database
    loadSavedSettings();
  };

  const loadSavedSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*');
      
      if (error) {
        console.warn('Could not load integration settings:', error);
        return;
      }

      data?.forEach((setting: any) => {
        const settings = setting.settings || {};
        switch (setting.integration_name) {
          case 'twilio':
            setTwilioEnabled(setting.is_enabled);
            if (settings.phoneNumber) setTwilioPhoneNumber(settings.phoneNumber);
            if (setting.connection_status === 'connected') {
              setTwilioStatus(prev => ({ ...prev, status: 'connected', configured: true }));
            }
            break;
          case 'stripe':
            setStripeEnabled(setting.is_enabled);
            if (settings.publishableKey) setStripePublishableKey(settings.publishableKey);
            if (setting.connection_status === 'connected') {
              setStripeStatus(prev => ({ ...prev, status: 'connected', configured: true }));
            }
            break;
          case 'sendgrid':
            setSendgridEnabled(setting.is_enabled);
            if (setting.connection_status === 'connected') {
              setSendgridStatus(prev => ({ ...prev, status: 'connected', configured: true }));
            }
            break;
          case 'mailchimp':
            setMailchimpEnabled(setting.is_enabled);
            if (setting.connection_status === 'connected') {
              setMailchimpStatus(prev => ({ ...prev, status: 'connected', configured: true }));
            }
            break;
          case 'plaid':
            setPlaidEnabled(setting.is_enabled);
            if (settings.environment) setPlaidEnvironment(settings.environment);
            if (setting.connection_status === 'connected') {
              setPlaidStatus(prev => ({ ...prev, status: 'connected', configured: true }));
            }
            break;
        }
      });
    } catch (err) {
      console.warn('Error loading settings:', err);
    }
  };

  const checkTwilioStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { action: 'health-check' }
      });
      
      if (!error && data?.configured) {
        setTwilioStatus({
          configured: true,
          lastTested: new Date().toISOString(),
          status: 'connected'
        });
      } else {
        setTwilioStatus({
          configured: false,
          lastTested: new Date().toISOString(),
          status: error ? 'error' : 'unknown',
          message: error?.message
        });
      }
    } catch {
      setTwilioStatus({
        configured: false,
        lastTested: null,
        status: 'unknown'
      });
    }
  };

  const checkStripeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'health-check' }
      });
      
      if (!error && data?.configured) {
        setStripeStatus({
          configured: true,
          lastTested: new Date().toISOString(),
          status: 'connected'
        });
      } else {
        setStripeStatus({
          configured: false,
          lastTested: new Date().toISOString(),
          status: 'unknown'
        });
      }
    } catch {
      setStripeStatus({ configured: false, lastTested: null, status: 'unknown' });
    }
  };

  const checkSendgridStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('resend-integration', {
        body: { action: 'health-check' }
      });
      
      if (!error && data?.configured) {
        setSendgridStatus({
          configured: true,
          lastTested: new Date().toISOString(),
          status: 'connected'
        });
      } else {
        setSendgridStatus({
          configured: false,
          lastTested: new Date().toISOString(),
          status: 'unknown'
        });
      }
    } catch {
      setSendgridStatus({ configured: false, lastTested: null, status: 'unknown' });
    }
  };

  const checkMailchimpStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('mailchimp-transactional', {
        body: { action: 'health-check' }
      });
      
      if (!error && data?.configured) {
        setMailchimpStatus({
          configured: true,
          lastTested: new Date().toISOString(),
          status: 'connected'
        });
      } else {
        setMailchimpStatus({
          configured: false,
          lastTested: new Date().toISOString(),
          status: 'unknown'
        });
      }
    } catch {
      setMailchimpStatus({ configured: false, lastTested: null, status: 'unknown' });
    }
  };

  const checkPlaidStatus = async () => {
    const isValidEnv = (v?: string | null) =>
      v === 'sandbox' || v === 'development' || v === 'production';

    try {
      const { data, error } = await supabase.functions.invoke('plaid-integration', {
        body: { action: 'health-check', environment: plaidEnvironment }
      });
      
      if (!error && data?.configured) {
        setPlaidStatus({
          configured: true,
          lastTested: new Date().toISOString(),
          status: 'connected'
        });
        if (isValidEnv(data.environment)) setPlaidEnvironment(data.environment);
      } else {
        setPlaidStatus({
          configured: false,
          lastTested: new Date().toISOString(),
          status: error ? 'error' : 'unknown',
          message: (data as any)?.error || error?.message
        });
      }
    } catch {
      setPlaidStatus({ configured: false, lastTested: null, status: 'unknown' });
    }
  };

  // Test functions
  const testTwilioConnection = async () => {
    setTwilioTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { action: 'test', phoneNumber: twilioPhoneNumber || '+15555555555' }
      });

      if (error) throw new Error(error.message);

      setTwilioStatus({
        configured: true,
        lastTested: new Date().toISOString(),
        status: 'connected'
      });
      toast.success('Twilio connection verified successfully');
    } catch (error: any) {
      setTwilioStatus(prev => ({
        ...prev,
        lastTested: new Date().toISOString(),
        status: 'error',
        message: error.message
      }));
      toast.error(`Twilio test failed: ${error.message}`);
    } finally {
      setTwilioTesting(false);
    }
  };

  const testStripeConnection = async () => {
    setStripeTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'test' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Connection failed');
      }

      setStripeStatus({
        configured: true,
        lastTested: new Date().toISOString(),
        status: 'connected'
      });
      toast.success('Stripe connection verified successfully');
    } catch (error: any) {
      setStripeStatus(prev => ({
        ...prev,
        lastTested: new Date().toISOString(),
        status: 'error',
        message: error.message
      }));
      toast.error(`Stripe test failed: ${error.message}`);
    } finally {
      setStripeTesting(false);
    }
  };

  const testSendgridConnection = async () => {
    setSendgridTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-integration', {
        body: { action: 'test' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Connection failed');
      }

      setSendgridStatus({
        configured: true,
        lastTested: new Date().toISOString(),
        status: 'connected'
      });
      toast.success('Resend connection verified successfully');
    } catch (error: any) {
      setSendgridStatus(prev => ({
        ...prev,
        lastTested: new Date().toISOString(),
        status: 'error',
        message: error.message
      }));
      toast.error(`Resend test failed: ${error.message}`);
    } finally {
      setSendgridTesting(false);
    }
  };

  const testMailchimpConnection = async () => {
    setMailchimpTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('mailchimp-transactional', {
        body: { action: 'test' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Connection failed');
      }

      setMailchimpStatus({
        configured: true,
        lastTested: new Date().toISOString(),
        status: 'connected'
      });
      toast.success('Mailchimp Transactional connection verified successfully');
    } catch (error: any) {
      setMailchimpStatus(prev => ({
        ...prev,
        lastTested: new Date().toISOString(),
        status: 'error',
        message: error.message
      }));
      toast.error(`Mailchimp test failed: ${error.message}`);
    } finally {
      setMailchimpTesting(false);
    }
  };

  const testPlaidConnection = async () => {
    setPlaidTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-integration', {
        body: { action: 'test', environment: plaidEnvironment }
      });

      if (error || !data?.success) {
        const hint = (data as any)?.hint;
        const recommended = (data as any)?.recommendedEnvironment as string | undefined;

        // If backend detected a better matching environment (e.g. keys are sandbox keys),
        // switch to it and retry once to "self-heal".
        if (recommended && recommended !== plaidEnvironment) {
          setPlaidEnvironment(recommended);

          const retry = await supabase.functions.invoke('plaid-integration', {
            body: { action: 'test', environment: recommended }
          });

          if (!retry.error && retry.data?.success) {
            setPlaidStatus({
              configured: true,
              lastTested: new Date().toISOString(),
              status: 'connected'
            });
            toast.success(`Plaid verified (switched to ${recommended})`);
            return;
          }
        }

        const details = [hint, recommended ? `Recommended: ${recommended}` : null]
          .filter(Boolean)
          .join(' ');
        throw new Error(`${data?.error || error?.message || 'Connection failed'}${details ? ` — ${details}` : ''}`);
      }

      setPlaidStatus({
        configured: true,
        lastTested: new Date().toISOString(),
        status: 'connected'
      });
      toast.success('Plaid connection verified successfully');
    } catch (error: any) {
      setPlaidStatus(prev => ({
        ...prev,
        lastTested: new Date().toISOString(),
        status: 'error',
        message: error.message
      }));
      toast.error(`Plaid test failed: ${error.message}`);
    } finally {
      setPlaidTesting(false);
    }
  };

  // Save functions
  const saveTwilioSettings = async () => {
    setTwilioSaving(true);
    try {
      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          integration_name: 'twilio',
          is_enabled: twilioEnabled,
          settings: { phoneNumber: twilioPhoneNumber },
          connection_status: twilioStatus.status,
          last_tested_at: twilioStatus.lastTested,
          updated_at: new Date().toISOString()
        }, { onConflict: 'integration_name' });

      if (error) throw error;
      toast.success('Twilio settings saved. Note: API credentials must be added as secrets in the backend.');
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setTwilioSaving(false);
    }
  };

  const saveStripeSettings = async () => {
    setStripeSaving(true);
    try {
      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          integration_name: 'stripe',
          is_enabled: stripeEnabled,
          settings: { publishableKey: stripePublishableKey },
          connection_status: stripeStatus.status,
          last_tested_at: stripeStatus.lastTested,
          updated_at: new Date().toISOString()
        }, { onConflict: 'integration_name' });

      if (error) throw error;
      toast.success('Stripe settings saved. Note: Secret key must be added as a secret in the backend.');
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setStripeSaving(false);
    }
  };

  const saveSendgridSettings = async () => {
    setSendgridSaving(true);
    try {
      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          integration_name: 'sendgrid',
          is_enabled: sendgridEnabled,
          settings: {},
          connection_status: sendgridStatus.status,
          last_tested_at: sendgridStatus.lastTested,
          updated_at: new Date().toISOString()
        }, { onConflict: 'integration_name' });

      if (error) throw error;
      toast.success('Resend settings saved. Ensure RESEND_API_KEY is set in Edge Function secrets.');
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSendgridSaving(false);
    }
  };

  const saveMailchimpSettings = async () => {
    setMailchimpSaving(true);
    try {
      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          integration_name: 'mailchimp',
          is_enabled: mailchimpEnabled,
          settings: {},
          connection_status: mailchimpStatus.status,
          last_tested_at: mailchimpStatus.lastTested,
          updated_at: new Date().toISOString()
        }, { onConflict: 'integration_name' });

      if (error) throw error;
      toast.success('Mailchimp settings saved. Note: API key must be added as a secret in the backend.');
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setMailchimpSaving(false);
    }
  };

  const savePlaidSettings = async () => {
    setPlaidSaving(true);
    try {
      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          integration_name: 'plaid',
          is_enabled: plaidEnabled,
          settings: { environment: plaidEnvironment },
          connection_status: plaidStatus.status,
          last_tested_at: plaidStatus.lastTested,
          updated_at: new Date().toISOString()
        }, { onConflict: 'integration_name' });

      if (error) throw error;
      toast.success('Plaid settings saved. Note: Credentials must be added as secrets in the backend.');
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setPlaidSaving(false);
    }
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status.status) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Not Configured
          </Badge>
        );
    }
  };

  const IntegrationCard = ({ 
    title, 
    description, 
    icon: Icon, 
    iconColor, 
    status, 
    enabled, 
    onEnabledChange,
    docsUrl,
    children 
  }: {
    title: string;
    description: string;
    icon: React.ElementType;
    iconColor: string;
    status: IntegrationStatus;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    docsUrl?: string;
    children?: React.ReactNode;
  }) => (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${iconColor} rounded-lg`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(status)}
            <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          </div>
        </div>
        {docsUrl && (
          <a 
            href={docsUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            View Documentation
          </a>
        )}
      </CardHeader>
      {enabled && children && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">System Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Configure third-party services and API connections for the platform
          </p>
        </div>
        <Button variant="outline" onClick={loadIntegrationStatuses}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* Info Card about Secrets */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">API Keys & Secrets</h3>
              <p className="text-sm text-muted-foreground mt-1">
                API keys and secrets must be configured in the backend environment. The input fields below 
                are for reference only. Add secrets via the efinsuite Cloud secrets manager to enable integrations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Twilio SMS Integration */}
      <IntegrationCard
        title="Twilio SMS"
        description="Send OTP codes, MFA verification, and SMS notifications"
        icon={Phone}
        iconColor="bg-red-500/10 text-red-600"
        status={twilioStatus}
        enabled={twilioEnabled}
        onEnabledChange={setTwilioEnabled}
        docsUrl="https://www.twilio.com/docs/sms"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="twilioAccountSid">Account SID</Label>
              <Input
                id="twilioAccountSid"
                value={twilioAccountSid}
                onChange={(e) => setTwilioAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Secret: TWILIO_ACCOUNT_SID</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="twilioAuthToken">Auth Token</Label>
              <div className="relative">
                <Input
                  id="twilioAuthToken"
                  type={showTwilioToken ? 'text' : 'password'}
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowTwilioToken(!showTwilioToken)}
                >
                  {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Secret: TWILIO_AUTH_TOKEN</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="twilioPhoneNumber">Phone Number</Label>
            <Input
              id="twilioPhoneNumber"
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Secret: TWILIO_PHONE_NUMBER</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button 
              onClick={testTwilioConnection} 
              variant="outline" 
              disabled={twilioTesting}
            >
              {twilioTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={saveTwilioSettings} disabled={twilioSaving}>
              {twilioSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>

          {twilioStatus.lastTested && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(twilioStatus.lastTested).toLocaleString()}
              {twilioStatus.message && ` - ${twilioStatus.message}`}
            </p>
          )}
        </div>
      </IntegrationCard>

      {/* Twilio Voice Integration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <PhoneCall className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Twilio Voice</CardTitle>
                <CardDescription>IVR, Click-to-Call, Voicemail, and AI Voice Agent</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {twilioStatus.status === 'connected' ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Requires SMS Config
                </Badge>
              )}
            </div>
          </div>
          <a 
            href="https://www.twilio.com/docs/voice" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            View Documentation
          </a>
        </CardHeader>
        <CardContent>
          <VoiceSettingsPanel />
        </CardContent>
      </Card>

      {/* Stripe Payments Integration */}
      <IntegrationCard
        title="Stripe Payments"
        description="Process payments, manage subscriptions, and handle billing"
        icon={CreditCard}
        iconColor="bg-purple-500/10 text-purple-600"
        status={stripeStatus}
        enabled={stripeEnabled}
        onEnabledChange={setStripeEnabled}
        docsUrl="https://stripe.com/docs"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stripePublishableKey">Publishable Key</Label>
              <Input
                id="stripePublishableKey"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Can be stored in frontend code</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="stripeSecretKey">Secret Key</Label>
              <div className="relative">
                <Input
                  id="stripeSecretKey"
                  type={showStripeSecret ? 'text' : 'password'}
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowStripeSecret(!showStripeSecret)}
                >
                  {showStripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Secret: STRIPE_SECRET_KEY</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={testStripeConnection} variant="outline" disabled={stripeTesting}>
              {stripeTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={saveStripeSettings} disabled={stripeSaving}>
              {stripeSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>

          {stripeStatus.lastTested && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(stripeStatus.lastTested).toLocaleString()}
              {stripeStatus.message && ` - ${stripeStatus.message}`}
            </p>
          )}
        </div>
      </IntegrationCard>

      {/* SendGrid Email Integration */}
      <IntegrationCard
        title="Resend Email"
        description="Send transactional emails for invitations and notifications"
        icon={Mail}
        iconColor="bg-blue-500/10 text-blue-600"
        status={sendgridStatus}
        enabled={sendgridEnabled}
        onEnabledChange={setSendgridEnabled}
        docsUrl="https://resend.com/docs"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sendgridApiKey">API Key</Label>
            <div className="relative">
              <Input
                id="sendgridApiKey"
                type={showSendgridKey ? 'text' : 'password'}
                value={sendgridApiKey}
                onChange={(e) => setSendgridApiKey(e.target.value)}
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSendgridKey(!showSendgridKey)}
              >
                {showSendgridKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Secret: RESEND_API_KEY</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={testSendgridConnection} variant="outline" disabled={sendgridTesting}>
              {sendgridTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={saveSendgridSettings} disabled={sendgridSaving}>
              {sendgridSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>

          {sendgridStatus.lastTested && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(sendgridStatus.lastTested).toLocaleString()}
              {sendgridStatus.message && ` - ${sendgridStatus.message}`}
            </p>
          )}
        </div>
      </IntegrationCard>

      {/* Mailchimp Transactional Integration */}
      <IntegrationCard
        title="Mailchimp Transactional"
        description="Send transactional emails via Mandrill for DocSign and invitations"
        icon={Mail}
        iconColor="bg-amber-500/10 text-amber-600"
        status={mailchimpStatus}
        enabled={mailchimpEnabled}
        onEnabledChange={setMailchimpEnabled}
        docsUrl="https://mailchimp.com/developer/transactional/docs/fundamentals/"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mailchimpApiKey">API Key</Label>
            <div className="relative">
              <Input
                id="mailchimpApiKey"
                type={showMailchimpKey ? 'text' : 'password'}
                value={mailchimpApiKey}
                onChange={(e) => setMailchimpApiKey(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxx-us1"
                className="font-mono text-sm pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowMailchimpKey(!showMailchimpKey)}
              >
                {showMailchimpKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Secret: MAILCHIMP_TRANSACTIONAL_API_KEY</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={testMailchimpConnection} variant="outline" disabled={mailchimpTesting}>
              {mailchimpTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={saveMailchimpSettings} disabled={mailchimpSaving}>
              {mailchimpSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>

          {mailchimpStatus.lastTested && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(mailchimpStatus.lastTested).toLocaleString()}
              {mailchimpStatus.message && ` - ${mailchimpStatus.message}`}
            </p>
          )}
        </div>
      </IntegrationCard>

      {/* Plaid Banking Integration */}
      <IntegrationCard
        title="Plaid Banking"
        description="Connect bank accounts for automatic transaction sync"
        icon={Building2}
        iconColor="bg-green-500/10 text-green-600"
        status={plaidStatus}
        enabled={plaidEnabled}
        onEnabledChange={setPlaidEnabled}
        docsUrl="https://plaid.com/docs"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plaidClientId">Client ID</Label>
              <Input
                id="plaidClientId"
                value={plaidClientId}
                onChange={(e) => setPlaidClientId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Secret: PLAID_CLIENT_ID</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="plaidSecret">Secret</Label>
              <div className="relative">
                <Input
                  id="plaidSecret"
                  type={showPlaidSecret ? 'text' : 'password'}
                  value={plaidSecret}
                  onChange={(e) => setPlaidSecret(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPlaidSecret(!showPlaidSecret)}
                >
                  {showPlaidSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Secret: PLAID_SECRET</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plaidEnvironment">Environment</Label>
            <Select value={plaidEnvironment} onValueChange={setPlaidEnvironment}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Secret: PLAID_ENVIRONMENT</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={testPlaidConnection} variant="outline" disabled={plaidTesting}>
              {plaidTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={savePlaidSettings} disabled={plaidSaving}>
              {plaidSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>

          {plaidStatus.lastTested && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(plaidStatus.lastTested).toLocaleString()}
              {plaidStatus.message && ` - ${plaidStatus.message}`}
            </p>
          )}
        </div>
      </IntegrationCard>

      {/* Cloud Storage Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg">
                <Cloud className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Cloud Storage</CardTitle>
                <CardDescription>Google Drive & OneDrive document sync</CardDescription>
              </div>
            </div>
            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Available
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cloud storage integrations are configured per-organization in the DocSign module settings.
          </p>
        </CardContent>
      </Card>

      {/* AI Services */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Services</CardTitle>
                <CardDescription>OpenAI & Google Gemini for smart features</CardDescription>
              </div>
            </div>
            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Built-in
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI services are provided through the platform and do not require additional configuration.
          </p>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">Secure Credential Storage</h3>
              <p className="text-sm text-muted-foreground mt-1">
                All API keys and secrets are encrypted and stored securely. Changes to integration 
                credentials require admin privileges and are logged in the audit trail.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
