import { useState } from 'react';
import { 
  ArrowRight, 
  Check, 
  Clock, 
  Mail, 
  Phone, 
  Users, 
  Settings, 
  Calendar,
  AlertCircle,
  GripVertical,
  Plus,
  Trash2,
  Send,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Signer {
  id: string;
  email: string;
  name: string;
  role: 'signer' | 'approver' | 'carbon_copy';
  authMethod: 'email' | 'sms' | 'in_app';
  phone?: string;
}

interface WorkflowSettings {
  signingOrder: 'sequential' | 'parallel';
  expirationDays: number;
  reminderEnabled: boolean;
  reminderDays: number;
  customMessage: string;
  accessCode: boolean;
}

interface DocumentWorkflowProps {
  documentId: string;
  documentTitle: string;
  onSend: (signers: Signer[], settings: WorkflowSettings) => void;
  onBack: () => void;
}

export function DocumentWorkflow({ documentId, documentTitle, onSend, onBack }: DocumentWorkflowProps) {
  const [signers, setSigners] = useState<Signer[]>([
    { id: '1', email: '', name: '', role: 'signer', authMethod: 'email' }
  ]);
  const [settings, setSettings] = useState<WorkflowSettings>({
    signingOrder: 'sequential',
    expirationDays: 30,
    reminderEnabled: true,
    reminderDays: 3,
    customMessage: '',
    accessCode: false,
  });
  const [activeStep, setActiveStep] = useState(0);

  const addSigner = () => {
    setSigners(prev => [
      ...prev,
      { 
        id: Date.now().toString(), 
        email: '', 
        name: '', 
        role: 'signer', 
        authMethod: 'email' 
      }
    ]);
  };

  const updateSigner = (id: string, updates: Partial<Signer>) => {
    setSigners(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const removeSigner = (id: string) => {
    setSigners(prev => prev.filter(s => s.id !== id));
  };

  const moveSigner = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === signers.length - 1)
    ) return;

    const newSigners = [...signers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSigners[index], newSigners[targetIndex]] = [newSigners[targetIndex], newSigners[index]];
    setSigners(newSigners);
  };

  const validSigners = signers.filter(s => s.email.trim() && s.role !== 'carbon_copy');
  const canSend = validSigners.length > 0 && validSigners.every(s => 
    s.email.includes('@') && (s.authMethod !== 'sms' || s.phone)
  );

  const steps = ['Add Recipients', 'Configure Workflow', 'Review & Send'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 py-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <button
              onClick={() => setActiveStep(index)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full transition-colors',
                activeStep === index 
                  ? 'bg-accent text-accent-foreground' 
                  : activeStep > index
                    ? 'bg-green-100 text-green-700'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {activeStep > index ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs">
                  {index + 1}
                </span>
              )}
              <span className="text-sm font-medium">{step}</span>
            </button>
            {index < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {activeStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Add Recipients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {signers.map((signer, index) => (
              <div 
                key={signer.id} 
                className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30"
              >
                {settings.signingOrder === 'sequential' && (
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <button 
                      onClick={() => moveSigner(index, 'up')}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                    <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                  </div>
                )}

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="recipient@example.com"
                        value={signer.email}
                        onChange={(e) => updateSigner(signer.id, { email: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="Recipient Name"
                      value={signer.name}
                      onChange={(e) => updateSigner(signer.id, { name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Role</Label>
                    <Select 
                      value={signer.role} 
                      onValueChange={(v: Signer['role']) => updateSigner(signer.id, { role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="signer">Needs to Sign</SelectItem>
                        <SelectItem value="approver">Needs to Approve</SelectItem>
                        <SelectItem value="carbon_copy">Receives a Copy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Authentication</Label>
                    <Select 
                      value={signer.authMethod} 
                      onValueChange={(v: Signer['authMethod']) => updateSigner(signer.id, { authMethod: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <span className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email Link
                          </span>
                        </SelectItem>
                        <SelectItem value="sms">
                          <span className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            SMS Verification
                          </span>
                        </SelectItem>
                        <SelectItem value="in_app">
                          <span className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            In-App Signing
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {signer.authMethod === 'sms' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs">Phone Number *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="+1 (555) 123-4567"
                          value={signer.phone || ''}
                          onChange={(e) => updateSigner(signer.id, { phone: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {signers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSigner(signer.id)}
                    className="text-destructive hover:text-destructive mt-6"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button variant="outline" onClick={addSigner} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Recipient
            </Button>
          </CardContent>
        </Card>
      )}

      {activeStep === 1 && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Signing Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={cn(
                    'p-4 border rounded-lg text-left transition-colors',
                    settings.signingOrder === 'sequential' && 'border-accent bg-accent/5'
                  )}
                  onClick={() => setSettings(s => ({ ...s, signingOrder: 'sequential' }))}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-5 h-5 text-accent" />
                    <span className="font-medium">Sequential</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Recipients sign one after another in order
                  </p>
                </button>

                <button
                  className={cn(
                    'p-4 border rounded-lg text-left transition-colors',
                    settings.signingOrder === 'parallel' && 'border-accent bg-accent/5'
                  )}
                  onClick={() => setSettings(s => ({ ...s, signingOrder: 'parallel' }))}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-accent" />
                    <span className="font-medium">Parallel</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All recipients can sign at the same time
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Expiration & Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Document Expiration</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-expire if not completed
                  </p>
                </div>
                <Select 
                  value={settings.expirationDays.toString()} 
                  onValueChange={(v) => setSettings(s => ({ ...s, expirationDays: parseInt(v) }))}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Send Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically remind recipients
                  </p>
                </div>
                <Switch
                  checked={settings.reminderEnabled}
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, reminderEnabled: checked }))}
                />
              </div>

              {settings.reminderEnabled && (
                <div className="flex items-center justify-between pl-4 border-l-2 border-accent">
                  <Label className="text-sm">Remind every</Label>
                  <Select 
                    value={settings.reminderDays.toString()} 
                    onValueChange={(v) => setSettings(s => ({ ...s, reminderDays: parseInt(v) }))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Custom Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add a personal message to include in the signing request email..."
                value={settings.customMessage}
                onChange={(e) => setSettings(s => ({ ...s, customMessage: e.target.value }))}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Review & Send
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Document</h4>
              <p className="text-sm">{documentTitle}</p>
            </div>

            <div>
              <h4 className="font-medium mb-3">Recipients ({validSigners.length})</h4>
              <div className="space-y-2">
                {signers.filter(s => s.email.trim()).map((signer, index) => (
                  <div key={signer.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {settings.signingOrder === 'sequential' && signer.role !== 'carbon_copy' && (
                        <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                      )}
                      <div>
                        <p className="font-medium">{signer.name || signer.email}</p>
                        {signer.name && <p className="text-sm text-muted-foreground">{signer.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {signer.role.replace('_', ' ')}
                      </Badge>
                      {signer.authMethod === 'sms' && (
                        <Phone className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Signing Order:</span>
                <p className="font-medium capitalize">{settings.signingOrder}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Expires in:</span>
                <p className="font-medium">{settings.expirationDays} days</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Reminders:</span>
                <p className="font-medium">
                  {settings.reminderEnabled ? `Every ${settings.reminderDays} day(s)` : 'Disabled'}
                </p>
              </div>
            </div>

            {!canSend && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Please complete all required recipient fields to send.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={activeStep === 0 ? onBack : () => setActiveStep(s => s - 1)}>
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        
        {activeStep < steps.length - 1 ? (
          <Button onClick={() => setActiveStep(s => s + 1)} className="bg-accent hover:bg-accent/90">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={() => onSend(signers, settings)}
            disabled={!canSend}
            className="bg-accent hover:bg-accent/90"
          >
            <Send className="w-4 h-4 mr-2" />
            Prepare & Send
          </Button>
        )}
      </div>
    </div>
  );
}
