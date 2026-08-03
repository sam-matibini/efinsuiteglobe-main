import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Shield, DollarSign, Plus, Trash2, Edit, Plug, Palette, Globe, Loader2, RotateCcw, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminIntegrationsTab } from '@/components/admin/AdminIntegrationsTab';
import { TroubleshootingTab } from '@/components/admin/TroubleshootingTab';
import { AdminWiseReceivingAccountsCard } from '@/components/admin/AdminWiseReceivingAccountsCard';

interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_employees: number | null;
  is_active: boolean | null;
  sort_order: number | null;
}

interface SecuritySettings {
  require_email_verification: boolean;
  two_factor_admin: boolean;
  session_timeout_minutes: number;
  password_policy: string;
  login_rate_limiting: boolean;
}

interface BrandingSettings {
  platform_name: string;
  support_email: string;
  logo_url: string;
  favicon_url: string;
}

interface LocalizationSettings {
  default_language: string;
  supported_jurisdictions: string[];
  supported_currencies: string[];
}

const defaultSecuritySettings: SecuritySettings = {
  require_email_verification: true,
  two_factor_admin: false,
  session_timeout_minutes: 30,
  password_policy: 'strong',
  login_rate_limiting: true,
};

const defaultBrandingSettings: BrandingSettings = {
  platform_name: 'EfinSuite',
  support_email: '',
  logo_url: '',
  favicon_url: '',
};

const defaultLocalizationSettings: LocalizationSettings = {
  default_language: 'en-US',
  supported_jurisdictions: ['CA', 'US', 'KE', 'ZM', 'BI'],
  supported_currencies: ['CAD', 'USD', 'KES', 'ZMW', 'BIF'],
};

export default function AdminSettings() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    max_users: 5,
    max_employees: 10,
  });

  // Settings state
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(defaultSecuritySettings);
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings>(defaultBrandingSettings);
  const [localizationSettings, setLocalizationSettings] = useState<LocalizationSettings>(defaultLocalizationSettings);

  // Fetch platform settings
  const { data: platformSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (platformSettings) {
      const security = platformSettings.find(s => s.setting_key === 'security');
      const branding = platformSettings.find(s => s.setting_key === 'branding');
      const localization = platformSettings.find(s => s.setting_key === 'localization');

      if (security?.setting_value && typeof security.setting_value === 'object' && !Array.isArray(security.setting_value)) {
        const val = security.setting_value as Record<string, unknown>;
        setSecuritySettings({
          require_email_verification: Boolean(val.require_email_verification ?? defaultSecuritySettings.require_email_verification),
          two_factor_admin: Boolean(val.two_factor_admin ?? defaultSecuritySettings.two_factor_admin),
          session_timeout_minutes: Number(val.session_timeout_minutes ?? defaultSecuritySettings.session_timeout_minutes),
          password_policy: String(val.password_policy ?? defaultSecuritySettings.password_policy),
          login_rate_limiting: Boolean(val.login_rate_limiting ?? defaultSecuritySettings.login_rate_limiting),
        });
      }
      if (branding?.setting_value && typeof branding.setting_value === 'object' && !Array.isArray(branding.setting_value)) {
        const val = branding.setting_value as Record<string, unknown>;
        setBrandingSettings({
          platform_name: String(val.platform_name ?? defaultBrandingSettings.platform_name),
          support_email: String(val.support_email ?? defaultBrandingSettings.support_email),
          logo_url: String(val.logo_url ?? defaultBrandingSettings.logo_url),
          favicon_url: String(val.favicon_url ?? defaultBrandingSettings.favicon_url),
        });
      }
      if (localization?.setting_value && typeof localization.setting_value === 'object' && !Array.isArray(localization.setting_value)) {
        const val = localization.setting_value as Record<string, unknown>;
        setLocalizationSettings({
          default_language: String(val.default_language ?? defaultLocalizationSettings.default_language),
          supported_jurisdictions: Array.isArray(val.supported_jurisdictions) 
            ? val.supported_jurisdictions.map(String) 
            : defaultLocalizationSettings.supported_jurisdictions,
          supported_currencies: Array.isArray(val.supported_currencies) 
            ? val.supported_currencies.map(String) 
            : defaultLocalizationSettings.supported_currencies,
        });
      }
    }
  }, [platformSettings]);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-pricing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data as PricingPlan[];
    },
    enabled: isAdmin,
  });

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: SecuritySettings | BrandingSettings | LocalizationSettings }) => {
      // Convert to JSON-compatible format
      const jsonValue = JSON.parse(JSON.stringify(value));
      const { error } = await supabase
        .from('platform_settings')
        .update({ setting_value: jsonValue })
        .eq('setting_key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const savePlan = useMutation({
    mutationFn: async (plan: { name: string; description: string | null; price_monthly: number; price_yearly: number; max_users: number | null; max_employees: number | null; is_active: boolean }) => {
      if (selectedPlan) {
        const { error } = await supabase
          .from('pricing_plans')
          .update(plan)
          .eq('id', selectedPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_plans')
          .insert([plan]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(selectedPlan ? 'Plan updated' : 'Plan created');
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
      setEditPlanDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('pricing_plans')
        .delete()
        .eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plan deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const togglePlanActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('pricing_plans')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
    },
  });

  if (authLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const openEditDialog = (plan?: PricingPlan) => {
    if (plan) {
      setSelectedPlan(plan);
      setPlanForm({
        name: plan.name,
        description: plan.description || '',
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_users: plan.max_users || 5,
        max_employees: plan.max_employees || 10,
      });
    } else {
      setSelectedPlan(null);
      setPlanForm({
        name: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        max_users: 5,
        max_employees: 10,
      });
    }
    setEditPlanDialogOpen(true);
  };

  const handleSaveSecuritySettings = () => {
    saveSettings.mutate({ key: 'security', value: securitySettings });
  };

  const handleSaveBrandingSettings = () => {
    saveSettings.mutate({ key: 'branding', value: brandingSettings });
  };

  const handleSaveLocalizationSettings = () => {
    saveSettings.mutate({ key: 'localization', value: localizationSettings });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Settings</h1>
          <p className="text-muted-foreground">Configure platform-wide settings, integrations, and pricing</p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Pricing Plans</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="localization" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Localization</span>
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Troubleshooting</span>
          </TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <AdminIntegrationsTab />
        </TabsContent>

        {/* Pricing Plans Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Pricing Plans
                  </CardTitle>
                  <CardDescription>Manage subscription pricing tiers</CardDescription>
                </div>
                <Button onClick={() => openEditDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Yearly</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : plans && plans.length > 0 ? (
                    plans.map(plan => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{plan.name}</p>
                            {plan.description && (
                              <p className="text-xs text-muted-foreground">{plan.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>${plan.price_monthly}</TableCell>
                        <TableCell>${plan.price_yearly}</TableCell>
                        <TableCell>{plan.max_users || '∞'}</TableCell>
                        <TableCell>{plan.max_employees || '∞'}</TableCell>
                        <TableCell>
                          <Switch
                            checked={plan.is_active || false}
                            onCheckedChange={(checked) => togglePlanActive.mutate({ id: plan.id, isActive: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Delete this plan?')) {
                                  deletePlan.mutate(plan.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No pricing plans configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Platform Security
              </CardTitle>
              <CardDescription>Configure platform-wide security options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require Email Verification</p>
                  <p className="text-sm text-muted-foreground">Users must verify email before accessing the platform</p>
                </div>
                <Switch
                  checked={securitySettings.require_email_verification}
                  onCheckedChange={(checked) =>
                    setSecuritySettings(prev => ({ ...prev, require_email_verification: checked }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Require 2FA for admin users</p>
                </div>
                <Switch
                  checked={securitySettings.two_factor_admin}
                  onCheckedChange={(checked) =>
                    setSecuritySettings(prev => ({ ...prev, two_factor_admin: checked }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Session Timeout (minutes)</p>
                  <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                </div>
                <Select
                  value={String(securitySettings.session_timeout_minutes)}
                  onValueChange={(value) =>
                    setSecuritySettings(prev => ({ ...prev, session_timeout_minutes: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Password Policy</p>
                  <p className="text-sm text-muted-foreground">Minimum requirements for user passwords</p>
                </div>
                <Select
                  value={securitySettings.password_policy}
                  onValueChange={(value) =>
                    setSecuritySettings(prev => ({ ...prev, password_policy: value }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="strong">Strong</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Login Rate Limiting</p>
                  <p className="text-sm text-muted-foreground">Prevent brute force attacks</p>
                </div>
                <Switch
                  checked={securitySettings.login_rate_limiting}
                  onCheckedChange={(checked) =>
                    setSecuritySettings(prev => ({ ...prev, login_rate_limiting: checked }))
                  }
                />
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveSecuritySettings} disabled={saveSettings.isPending}>
                  {saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Security Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Platform Branding
              </CardTitle>
              <CardDescription>Customize the platform appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Platform Name</Label>
                  <Input
                    value={brandingSettings.platform_name}
                    onChange={(e) =>
                      setBrandingSettings(prev => ({ ...prev, platform_name: e.target.value }))
                    }
                    placeholder="EfinSuite"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={brandingSettings.support_email}
                    onChange={(e) =>
                      setBrandingSettings(prev => ({ ...prev, support_email: e.target.value }))
                    }
                    placeholder="support@efinsuite.com"
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={brandingSettings.logo_url}
                    onChange={(e) =>
                      setBrandingSettings(prev => ({ ...prev, logo_url: e.target.value }))
                    }
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">Recommended: 200x50px</p>
                </div>
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <Input
                    value={brandingSettings.favicon_url}
                    onChange={(e) =>
                      setBrandingSettings(prev => ({ ...prev, favicon_url: e.target.value }))
                    }
                    placeholder="https://example.com/favicon.png"
                  />
                  <p className="text-xs text-muted-foreground">Recommended: 32x32px</p>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveBrandingSettings} disabled={saveSettings.isPending}>
                  {saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Localization Tab */}
        <TabsContent value="localization">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Localization Settings
              </CardTitle>
              <CardDescription>Configure supported regions and languages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Language</Label>
                <Select
                  value={localizationSettings.default_language}
                  onValueChange={(value) =>
                    setLocalizationSettings(prev => ({ ...prev, default_language: value }))
                  }
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-CA">English (Canada)</SelectItem>
                    <SelectItem value="fr-CA">French (Canada)</SelectItem>
                    <SelectItem value="sw">Swahili</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <p className="font-medium mb-3">Supported Jurisdictions</p>
                <div className="flex flex-wrap gap-2">
                  {localizationSettings.supported_jurisdictions.map((code) => (
                    <Badge key={code}>{code}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Jurisdiction configuration is managed through the Countries table
                </p>
              </div>
              <Separator />
              <div>
                <p className="font-medium mb-3">Supported Currencies</p>
                <div className="flex flex-wrap gap-2">
                  {localizationSettings.supported_currencies.map((code) => (
                    <Badge key={code} variant="outline">{code}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Currency configuration is managed through the Currencies table
                </p>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveLocalizationSettings} disabled={saveSettings.isPending}>
                  {saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Localization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting">
          <TroubleshootingTab />
        </TabsContent>
      </Tabs>

      {/* Edit Plan Dialog */}
      <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
            <DialogDescription>
              {selectedPlan ? 'Update pricing plan details' : 'Add a new pricing tier'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="e.g., Professional"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Price ($)</Label>
                <Input
                  type="number"
                  value={planForm.price_monthly}
                  onChange={(e) => setPlanForm({ ...planForm, price_monthly: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly Price ($)</Label>
                <Input
                  type="number"
                  value={planForm.price_yearly}
                  onChange={(e) => setPlanForm({ ...planForm, price_yearly: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  value={planForm.max_users}
                  onChange={(e) => setPlanForm({ ...planForm, max_users: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Employees</Label>
                <Input
                  type="number"
                  value={planForm.max_employees}
                  onChange={(e) => setPlanForm({ ...planForm, max_employees: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                savePlan.mutate({
                  name: planForm.name,
                  description: planForm.description || null,
                  price_monthly: planForm.price_monthly,
                  price_yearly: planForm.price_yearly,
                  max_users: planForm.max_users,
                  max_employees: planForm.max_employees,
                  is_active: true,
                });
              }}
              disabled={savePlan.isPending}
            >
              {savePlan.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
