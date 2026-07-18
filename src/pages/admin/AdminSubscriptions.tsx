import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MoreHorizontal, Search, CreditCard, RefreshCw, XCircle, Plus, Edit, Trash2, Check, Users, Building, Building2, Package, Upload, Loader2, MapPin, ArrowRightLeft, Mail, Clock, Percent, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import {
  SubscriptionDefaultsCard,
  ExtendTrialDialog,
  OverrideSubscriptionDialog,
  SetDiscountDialog,
} from '@/components/admin/SubscriptionAdminControls';
import { DiscountsTab } from '@/components/admin/DiscountsTab';

interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  organization_name?: string;
  plan_name?: string;
  plan_price?: number;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  cost_monthly?: number;
  cost_yearly?: number;
  margin_percent?: number;
  max_users: number | null;
  max_employees: number | null;
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
}

// Default plan features for reference
const DEFAULT_PLAN_FEATURES = {
  starter: [
    'Up to 5 users',
    'Up to 25 employees',
    'Core accounting (GL, AR, AP)',
    'Basic payroll',
    'Bank reconciliation',
    'Alice AI Assistant',
    'Email support',
    '10GB storage'
  ],
  professional: [
    'Up to 25 users',
    'Up to 100 employees',
    'All Starter features',
    'Fixed Assets & Depreciation',
    'Budgeting & Forecasting',
    'Inventory Management',
    'DocSign (e-signatures)',
    'Communication Hub',
    'Priority support',
    '100GB storage'
  ],
  enterprise: [
    'Unlimited users',
    'Unlimited employees',
    'All Professional features',
    'Practice Management',
    'Donation Management (NPO)',
    'Accountant Dashboard',
    'Multi-country tax compliance',
    'Dedicated account manager',
    'Custom integrations',
    'Unlimited storage'
  ]
};

function SyncToStripeButton() {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'sync-plans' },
      });
      if (error) throw error;
      if (data?.success) {
        const failed = data.results?.filter((r: any) => r.error) || [];
        if (failed.length > 0) {
          toast.warning(`Synced with ${failed.length} error(s): ${failed.map((f: any) => f.error).join(', ')}`);
        } else {
          toast.success(`Successfully synced ${data.results?.length || 0} plans to Stripe`);
        }
        queryClient.invalidateQueries({ queryKey: ['pricing-plans-all'] });
        queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
      } else {
        toast.error(data?.error || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleSync} disabled={syncing}>
      {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
      {syncing ? 'Syncing...' : 'Sync to Stripe'}
    </Button>
  );
}

export default function AdminSubscriptions() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [newPlanId, setNewPlanId] = useState<string>('');
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [setDiscountOpen, setSetDiscountOpen] = useState(false);
  
  // Assign subscription state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignOrgId, setAssignOrgId] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignBillingCycle, setAssignBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [assignStatus, setAssignStatus] = useState<'active' | 'trialing'>('active');
  const [assignCustomPrice, setAssignCustomPrice] = useState<string>('');
  const [assignDiscountPercent, setAssignDiscountPercent] = useState<string>('0');
  const [assignPaymentMethod, setAssignPaymentMethod] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Credit card billing fields
  const [assignCardName, setAssignCardName] = useState('');
  const [assignCardNumber, setAssignCardNumber] = useState('');
  const [assignCardExpiry, setAssignCardExpiry] = useState('');
  const [assignCardCvv, setAssignCardCvv] = useState('');

  // Billing address fields
  const [assignBillingAddress, setAssignBillingAddress] = useState('');
  const [assignBillingCity, setAssignBillingCity] = useState('');
  const [assignBillingState, setAssignBillingState] = useState('');
  const [assignBillingZip, setAssignBillingZip] = useState('');
  const [assignBillingCountry, setAssignBillingCountry] = useState('');

  // Bank/ACH/EFT fields
  const [assignBankAccountHolder, setAssignBankAccountHolder] = useState('');
  const [assignBankName, setAssignBankName] = useState('');
  const [assignBankRoutingNumber, setAssignBankRoutingNumber] = useState('');
  const [assignBankAccountNumber, setAssignBankAccountNumber] = useState('');
  const [assignBankAccountType, setAssignBankAccountType] = useState<'checking' | 'savings'>('checking');

  // Bank address fields
  const [assignBankAddress, setAssignBankAddress] = useState('');
  const [assignBankCity, setAssignBankCity] = useState('');
  const [assignBankState, setAssignBankState] = useState('');
  const [assignBankZip, setAssignBankZip] = useState('');
  const [assignBankCountry, setAssignBankCountry] = useState('');

  // e-Transfer fields
  const [assignEtransferEmail, setAssignEtransferEmail] = useState('');
  const [assignEtransferName, setAssignEtransferName] = useState('');
  const [assignEtransferSecurityQ, setAssignEtransferSecurityQ] = useState('');
  const [assignEtransferSecurityA, setAssignEtransferSecurityA] = useState('');

  const resetBillingFields = () => {
    setAssignCardName(''); setAssignCardNumber(''); setAssignCardExpiry(''); setAssignCardCvv('');
    setAssignBillingAddress(''); setAssignBillingCity(''); setAssignBillingState(''); setAssignBillingZip(''); setAssignBillingCountry('');
    setAssignBankAccountHolder(''); setAssignBankName(''); setAssignBankRoutingNumber(''); setAssignBankAccountNumber(''); setAssignBankAccountType('checking');
    setAssignBankAddress(''); setAssignBankCity(''); setAssignBankState(''); setAssignBankZip(''); setAssignBankCountry('');
    setAssignEtransferEmail(''); setAssignEtransferName(''); setAssignEtransferSecurityQ(''); setAssignEtransferSecurityA('');
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  // Plan management state
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    cost_monthly: 0,
    cost_yearly: 0,
    margin_percent: 0,
    max_users: 5,
    max_employees: 25,
    features: '',
    is_active: true,
    sort_order: 0
  });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const [subsRes, orgsRes, plansRes] = await Promise.all([
        supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('organizations').select('id, name'),
        supabase.from('pricing_plans').select('*'),
      ]);

      if (subsRes.error) throw subsRes.error;

      const orgs = orgsRes.data || [];
      const plans = plansRes.data || [];

      return subsRes.data.map(sub => {
        const org = orgs.find(o => o.id === sub.organization_id);
        const plan = plans.find(p => p.id === sub.plan_id);
        return {
          ...sub,
          organization_name: org?.name || 'Unknown',
          plan_name: plan?.name || 'No Plan',
          plan_price: plan?.price_monthly || 0,
        };
      }) as Subscription[];
    },
    enabled: isAdmin,
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['pricing-plans-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data as Plan[];
    },
    enabled: isAdmin,
  });
  
  const { data: activePlans } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as Plan[];
    },
    enabled: isAdmin,
  });

  // Orgs without active/trialing subscriptions
  const { data: freeOrgs } = useQuery({
    queryKey: ['free-organizations', subscriptions],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('id, name').order('name');
      if (error) throw error;
      const activeOrgIds = new Set(
        (subscriptions || [])
          .filter(s => s.status === 'active' || s.status === 'trialing')
          .map(s => s.organization_id)
      );
      return (data || []).filter(org => !activeOrgIds.has(org.id));
    },
    enabled: isAdmin && assignDialogOpen,
  });

  const assignSubscription = useMutation({
    mutationFn: async () => {
      if (!assignOrgId || !assignPlanId) throw new Error('Organization and plan are required');
      const isCustom = assignPlanId === 'custom';
      if (isCustom && (!assignCustomPrice || parseFloat(assignCustomPrice) <= 0)) {
        throw new Error('Custom subscription requires a price amount');
      }
      const now = new Date();
      const periodEnd = new Date(now);
      if (assignBillingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      const insertData: Record<string, unknown> = {
        organization_id: assignOrgId,
        plan_id: isCustom ? null : assignPlanId,
        billing_cycle: assignBillingCycle,
        status: assignStatus,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      };
      if (isCustom) {
        insertData.custom_price = parseFloat(assignCustomPrice);
      } else {
        if (assignCustomPrice && parseFloat(assignCustomPrice) > 0) {
          insertData.custom_price = parseFloat(assignCustomPrice);
        }
        if (assignDiscountPercent && parseFloat(assignDiscountPercent) > 0) {
          insertData.discount_percent = parseFloat(assignDiscountPercent);
        }
      }
      if (assignPaymentMethod) {
        insertData.payment_method = assignPaymentMethod;
      }
      // Build billing details JSON
      const billingDetails: Record<string, unknown> = {};
      if (assignPaymentMethod === 'credit_card') {
        billingDetails.card = { name: assignCardName, last4: assignCardNumber.replace(/\s/g, '').slice(-4), expiry: assignCardExpiry };
        billingDetails.billing_address = { address: assignBillingAddress, city: assignBillingCity, state: assignBillingState, zip: assignBillingZip, country: assignBillingCountry };
      } else if (assignPaymentMethod === 'ach' || assignPaymentMethod === 'eft') {
        billingDetails.bank = { account_holder: assignBankAccountHolder, bank_name: assignBankName, routing_number: assignBankRoutingNumber, account_last4: assignBankAccountNumber.slice(-4), account_type: assignBankAccountType };
        billingDetails.bank_address = { address: assignBankAddress, city: assignBankCity, state: assignBankState, zip: assignBankZip, country: assignBankCountry };
      } else if (assignPaymentMethod === 'interac_etransfer') {
        billingDetails.etransfer = { email: assignEtransferEmail, name: assignEtransferName, security_question: assignEtransferSecurityQ || undefined, security_answer: assignEtransferSecurityA || undefined };
      }
      const noteParts: string[] = [];
      if (assignNotes.trim()) noteParts.push(assignNotes.trim());
      if (Object.keys(billingDetails).length > 0) noteParts.push('billing_details: ' + JSON.stringify(billingDetails));
      if (noteParts.length > 0) insertData.admin_notes = noteParts.join('\n---\n');
      const { error } = await supabase.from('subscriptions').insert(insertData as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Subscription assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setAssignDialogOpen(false);
      setAssignOrgId('');
      setAssignPlanId('');
      setAssignBillingCycle('monthly');
      setAssignStatus('active');
      setAssignCustomPrice('');
      setAssignDiscountPercent('0');
      setAssignPaymentMethod('');
      setAssignNotes('');
      resetBillingFields();
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign subscription: ${error.message}`);
    },
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Subscription updated');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setChangePlanDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
  
  const savePlan = useMutation({
    mutationFn: async (plan: Partial<Plan> & { id?: string }) => {
      const planData = {
        name: plan.name,
        description: plan.description,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_users: plan.max_users,
        max_employees: plan.max_employees,
        features: plan.features,
        is_active: plan.is_active,
        sort_order: plan.sort_order
      };
      
      if (plan.id) {
        const { error } = await supabase
          .from('pricing_plans')
          .update(planData)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_plans')
          .insert(planData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(selectedPlan ? 'Plan updated' : 'Plan created');
      queryClient.invalidateQueries({ queryKey: ['pricing-plans-all'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
      setEditPlanDialogOpen(false);
      resetPlanForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save plan: ${error.message}`);
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
      queryClient.invalidateQueries({ queryKey: ['pricing-plans-all'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete plan: ${error.message}`);
    },
  });
  
  const resetPlanForm = () => {
    setSelectedPlan(null);
    setPlanForm({
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      cost_monthly: 0,
      cost_yearly: 0,
      margin_percent: 0,
      max_users: 5,
      max_employees: 25,
      features: '',
      is_active: true,
      sort_order: 0
    });
  };
  
  const openEditPlan = (plan?: Plan) => {
    if (plan) {
      setSelectedPlan(plan);
      // Calculate margin if costs exist
      const marginPercent = plan.cost_monthly && plan.price_monthly > 0 
        ? Math.round(((plan.price_monthly - plan.cost_monthly) / plan.price_monthly) * 100)
        : 0;
      setPlanForm({
        name: plan.name,
        description: plan.description || '',
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        cost_monthly: plan.cost_monthly || 0,
        cost_yearly: plan.cost_yearly || 0,
        margin_percent: marginPercent,
        max_users: plan.max_users || 5,
        max_employees: plan.max_employees || 25,
        features: (plan.features || []).join('\n'),
        is_active: plan.is_active,
        sort_order: plan.sort_order
      });
    } else {
      resetPlanForm();
    }
    setEditPlanDialogOpen(true);
  };
  
  const handleSavePlan = () => {
    const featuresArray = planForm.features
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
    
    savePlan.mutate({
      id: selectedPlan?.id,
      name: planForm.name,
      description: planForm.description,
      price_monthly: planForm.price_monthly,
      price_yearly: planForm.price_yearly,
      max_users: planForm.max_users,
      max_employees: planForm.max_employees,
      features: featuresArray,
      is_active: planForm.is_active,
      sort_order: planForm.sort_order
    });
  };

  // Note: Admin access is now verified at route level by AdminRoute component
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredSubs = subscriptions?.filter(sub =>
    sub.organization_name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-accent/20 text-accent border-accent/30">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Canceled</Badge>;
      case 'incomplete':
        return <Badge className="bg-muted text-muted-foreground">Incomplete</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Helper to calculate effective price for a subscription
  const getEffectivePrice = (sub: any) => {
    if (sub.custom_price != null && sub.custom_price > 0) return sub.custom_price;
    const basePrice = sub.plan_price || 0;
    const discount = sub.discount_percent || 0;
    return basePrice * (1 - discount / 100);
  };

  const totalMRR = subscriptions
    ?.filter(s => s.status === 'active')
    .reduce((sum, s) => sum + getEffectivePrice(s), 0) || 0;

  // Selected plan for pricing display in assign dialog
  const selectedAssignPlan = activePlans?.find(p => p.id === assignPlanId);
  const assignBasePrice = selectedAssignPlan
    ? (assignBillingCycle === 'yearly' ? selectedAssignPlan.price_yearly : selectedAssignPlan.price_monthly)
    : 0;
  const assignDiscount = parseFloat(assignDiscountPercent) || 0;
  const assignEffectivePrice = assignCustomPrice && parseFloat(assignCustomPrice) > 0
    ? parseFloat(assignCustomPrice)
    : assignBasePrice * (1 - assignDiscount / 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions & Pricing</h1>
          <p className="text-muted-foreground">Manage subscription plans, pricing tiers, and billing</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="w-4 h-4" />
              Total Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Check className="w-4 h-4" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {subscriptions?.filter(s => s.status === 'active').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              Pricing Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMRR.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Plans</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="subscriptions" className="mt-4 space-y-4">
          <SubscriptionDefaultsCard />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Subscriptions</CardTitle>
                  <CardDescription>View and manage organization subscriptions</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setAssignDialogOpen(true)} size="sm" variant="default">
                    <Plus className="w-4 h-4 mr-1" /> Assign Subscription
                  </Button>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by organization..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                       <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredSubs.length > 0 ? (
                    filteredSubs.map(sub => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.organization_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            {sub.plan_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm">${getEffectivePrice(sub).toFixed(2)}</span>
                            {((sub as any).custom_price > 0 || (sub as any).discount_percent > 0) && (
                              <Badge variant="secondary" className="text-xs">Discounted</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell className="capitalize">{sub.billing_cycle || '-'}</TableCell>
                        <TableCell>
                          {sub.current_period_end
                            ? format(new Date(sub.current_period_end), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedSub(sub);
                                setNewPlanId(sub.plan_id || '');
                                setChangePlanDialogOpen(true);
                              }}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Change Plan
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedSub(sub); setExtendTrialOpen(true); }}>
                                <Clock className="w-4 h-4 mr-2" />
                                Extend trial
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedSub(sub); setOverrideOpen(true); }}>
                                <Sliders className="w-4 h-4 mr-2" />
                                Override…
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedSub(sub); setSetDiscountOpen(true); }}>
                                <Percent className="w-4 h-4 mr-2" />
                                Set discount…
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {sub.status === 'active' && (
                                <DropdownMenuItem
                                  onClick={() => updateSubscription.mutate({
                                    id: sub.id,
                                    updates: { status: 'canceled' }
                                  })}
                                  className="text-destructive"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancel Subscription
                                </DropdownMenuItem>
                              )}
                              {sub.status === 'canceled' && (
                                <DropdownMenuItem
                                  onClick={() => updateSubscription.mutate({
                                    id: sub.id,
                                    updates: { status: 'active' }
                                  })}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No subscriptions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pricing Plans</CardTitle>
                  <CardDescription>Configure pricing tiers and features</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <SyncToStripeButton />
                  <Button onClick={() => openEditPlan()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Plan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {plans?.map(plan => (
                    <Card key={plan.id} className={`relative ${!plan.is_active ? 'opacity-60' : ''}`}>
                      {!plan.is_active && (
                        <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl">{plan.name}</CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditPlan(plan)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Plan
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => deletePlan.mutate(plan.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Plan
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-3xl font-bold">${plan.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                          <div className="text-sm text-muted-foreground">${plan.price_yearly}/yr (save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)})</div>
                        </div>
                        
                        {/* Cost & Margin Section */}
                        {(plan.cost_monthly || plan.margin_percent) && (
                          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Operating Cost:</span>
                              <span className="font-medium">${plan.cost_monthly?.toFixed(2) || '0.00'}/mo</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Gross Margin:</span>
                              <Badge variant={
                                (plan.margin_percent || 0) >= 50 ? "default" : 
                                (plan.margin_percent || 0) >= 30 ? "secondary" : "destructive"
                              }>
                                {plan.margin_percent || Math.round(((plan.price_monthly - (plan.cost_monthly || 0)) / plan.price_monthly) * 100)}%
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Net Profit:</span>
                              <span className="font-medium text-success">
                                ${((plan.price_monthly - (plan.cost_monthly || 0))).toFixed(2)}/mo
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {plan.max_users || '∞'} users
                          </div>
                          <div className="flex items-center gap-1">
                            <Building className="w-4 h-4" />
                            {plan.max_employees || '∞'} employees
                          </div>
                        </div>
                        <div className="border-t pt-4">
                          <div className="text-sm font-medium mb-2">Features:</div>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {(plan.features || []).slice(0, 5).map((feature, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                {feature}
                              </li>
                            ))}
                            {(plan.features || []).length > 5 && (
                              <li className="text-xs text-muted-foreground">
                                +{(plan.features || []).length - 5} more features
                              </li>
                            )}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Plan Dialog */}
      <Dialog open={changePlanDialogOpen} onOpenChange={setChangePlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Update the plan for {selectedSub?.organization_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Plan</Label>
              <p className="text-muted-foreground">{selectedSub?.plan_name}</p>
            </div>
            <div className="space-y-2">
              <Label>New Plan</Label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans?.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price_monthly}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSub && newPlanId) {
                  updateSubscription.mutate({
                    id: selectedSub.id,
                    updates: { plan_id: newPlanId }
                  });
                }
              }}
              disabled={updateSubscription.isPending || !newPlanId}
            >
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit/Create Plan Dialog */}
      <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPlan ? 'Edit Pricing Plan' : 'Create Pricing Plan'}</DialogTitle>
            <DialogDescription>
              {selectedPlan ? 'Update the pricing plan details' : 'Add a new pricing tier'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input 
                  value={planForm.name}
                  onChange={e => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Professional"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input 
                  type="number"
                  value={planForm.sort_order}
                  onChange={e => setPlanForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={planForm.description}
                onChange={e => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. For growing businesses with advanced needs"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Price ($)</Label>
                <Input 
                  type="number"
                  value={planForm.price_monthly}
                  onChange={e => setPlanForm(prev => ({ ...prev, price_monthly: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly Price ($)</Label>
                <Input 
                  type="number"
                  value={planForm.price_yearly}
                  onChange={e => setPlanForm(prev => ({ ...prev, price_yearly: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            {/* Operating Costs Section */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-base font-semibold">Operating Costs & Margins</Label>
              <p className="text-sm text-muted-foreground mb-4">Track costs to calculate profitability per plan</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Cost ($)</Label>
                  <Input 
                    type="number"
                    value={planForm.cost_monthly}
                    onChange={e => {
                      const cost = parseFloat(e.target.value) || 0;
                      const margin = planForm.price_monthly > 0 
                        ? Math.round(((planForm.price_monthly - cost) / planForm.price_monthly) * 100)
                        : 0;
                      setPlanForm(prev => ({ ...prev, cost_monthly: cost, margin_percent: margin }));
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yearly Cost ($)</Label>
                  <Input 
                    type="number"
                    value={planForm.cost_yearly}
                    onChange={e => setPlanForm(prev => ({ ...prev, cost_yearly: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margin (%)</Label>
                  <Input 
                    type="number"
                    value={planForm.margin_percent}
                    onChange={e => setPlanForm(prev => ({ ...prev, margin_percent: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              {planForm.price_monthly > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between text-sm">
                    <span>Net Profit per Month:</span>
                    <span className={`font-bold ${(planForm.price_monthly - planForm.cost_monthly) > 0 ? 'text-success' : 'text-destructive'}`}>
                      ${(planForm.price_monthly - planForm.cost_monthly).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input 
                  type="number"
                  value={planForm.max_users}
                  onChange={e => setPlanForm(prev => ({ ...prev, max_users: parseInt(e.target.value) || 0 }))}
                  placeholder="0 for unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Employees</Label>
                <Input 
                  type="number"
                  value={planForm.max_employees}
                  onChange={e => setPlanForm(prev => ({ ...prev, max_employees: parseInt(e.target.value) || 0 }))}
                  placeholder="0 for unlimited"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features (one per line)</Label>
              <Textarea 
                value={planForm.features}
                onChange={e => setPlanForm(prev => ({ ...prev, features: e.target.value }))}
                placeholder="Up to 25 users&#10;All Starter features&#10;Fixed Assets & Depreciation"
                rows={6}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={planForm.is_active}
                onCheckedChange={checked => setPlanForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Active (visible to customers)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePlan} disabled={savePlan.isPending || !planForm.name}>
              {savePlan.isPending ? 'Saving...' : selectedPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Subscription Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Subscription</DialogTitle>
            <DialogDescription>Convert a free organization to a paid subscription plan.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6" style={{ overflow: 'auto' }}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={assignOrgId} onValueChange={setAssignOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {freeOrgs?.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                    {freeOrgs?.length === 0 && (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">All organizations have active subscriptions</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={assignPlanId} onValueChange={(v) => {
                  setAssignPlanId(v);
                  if (v === 'custom') {
                    setAssignCustomPrice('');
                    setAssignDiscountPercent('0');
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activePlans?.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — ${assignBillingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly}/{assignBillingCycle === 'yearly' ? 'yr' : 'mo'}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <span className="font-medium">Custom Subscription</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom subscription amount (shown when "Custom" is selected) */}
              {assignPlanId === 'custom' && (
                <div className="space-y-2">
                  <Label>Subscription Amount ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={assignCustomPrice}
                    onChange={(e) => setAssignCustomPrice(e.target.value)}
                    placeholder="Enter custom amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    This amount will be charged per billing cycle. No plan limits apply.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={assignBillingCycle === 'monthly' ? 'default' : 'outline'}
                    onClick={() => setAssignBillingCycle('monthly')}
                  >Monthly</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={assignBillingCycle === 'yearly' ? 'default' : 'outline'}
                    onClick={() => setAssignBillingCycle('yearly')}
                  >Yearly</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assignStatus} onValueChange={(v) => setAssignStatus(v as 'active' | 'trialing')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Discount % - only for standard plans */}
              {assignPlanId && assignPlanId !== 'custom' && (
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={assignDiscountPercent}
                    onChange={(e) => setAssignDiscountPercent(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}

              {/* Custom Price Override - only for standard plans */}
              {assignPlanId && assignPlanId !== 'custom' && (
                <div className="space-y-2">
                  <Label>Custom Price Override (optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={assignCustomPrice}
                    onChange={(e) => setAssignCustomPrice(e.target.value)}
                    placeholder="Leave empty to use plan price"
                  />
                </div>
              )}

              {/* Effective Price Preview */}
              {assignPlanId && assignPlanId !== 'custom' && selectedAssignPlan && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Price:</span>
                    <span>${assignBasePrice.toFixed(2)}/{assignBillingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                  {assignDiscount > 0 && !assignCustomPrice && (
                    <div className="flex justify-between text-warning">
                      <span>Discount ({assignDiscount}%):</span>
                      <span>-${(assignBasePrice * assignDiscount / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Effective Price:</span>
                    <span>${assignEffectivePrice.toFixed(2)}/{assignBillingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                </div>
              )}

              {/* Custom price preview */}
              {assignPlanId === 'custom' && assignCustomPrice && parseFloat(assignCustomPrice) > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex justify-between font-semibold">
                    <span>Custom Amount:</span>
                    <span>${parseFloat(assignCustomPrice).toFixed(2)}/{assignBillingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={assignPaymentMethod} onValueChange={(v) => { setAssignPaymentMethod(v); resetBillingFields(); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="ach">ACH (Direct Debit)</SelectItem>
                    <SelectItem value="eft">EFT</SelectItem>
                    <SelectItem value="interac_etransfer">Interac e-Transfer</SelectItem>
                    <SelectItem value="manual">Manual / Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Credit Card Details */}
              {assignPaymentMethod === 'credit_card' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CreditCard className="w-4 h-4" />
                      Card Details
                    </div>
                    <div className="space-y-2">
                      <Label>Cardholder Name</Label>
                      <Input value={assignCardName} onChange={(e) => setAssignCardName(e.target.value)} placeholder="Name on card" />
                    </div>
                    <div className="space-y-2">
                      <Label>Card Number</Label>
                      <Input
                        value={assignCardNumber}
                        onChange={(e) => setAssignCardNumber(formatCardNumber(e.target.value))}
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Expiry (MM/YY)</Label>
                        <Input
                          value={assignCardExpiry}
                          onChange={(e) => setAssignCardExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          maxLength={5}
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CVV</Label>
                        <Input
                          value={assignCardCvv}
                          onChange={(e) => setAssignCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          maxLength={4}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="w-4 h-4" />
                      Billing Address
                    </div>
                    <div className="space-y-2">
                      <Label>Street Address</Label>
                      <Input value={assignBillingAddress} onChange={(e) => setAssignBillingAddress(e.target.value)} placeholder="123 Main St" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={assignBillingCity} onChange={(e) => setAssignBillingCity(e.target.value)} placeholder="City" />
                      </div>
                      <div className="space-y-2">
                        <Label>State / Province</Label>
                        <Input value={assignBillingState} onChange={(e) => setAssignBillingState(e.target.value)} placeholder="State" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>ZIP / Postal Code</Label>
                        <Input value={assignBillingZip} onChange={(e) => setAssignBillingZip(e.target.value)} placeholder="12345" />
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input value={assignBillingCountry} onChange={(e) => setAssignBillingCountry(e.target.value)} placeholder="Country" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ACH / EFT Bank Details */}
              {(assignPaymentMethod === 'ach' || assignPaymentMethod === 'eft') && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Building2 className="w-4 h-4" />
                      Bank Account Details
                    </div>
                    <div className="space-y-2">
                      <Label>Account Holder Name</Label>
                      <Input value={assignBankAccountHolder} onChange={(e) => setAssignBankAccountHolder(e.target.value)} placeholder="Account holder name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input value={assignBankName} onChange={(e) => setAssignBankName(e.target.value)} placeholder="Bank name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{assignPaymentMethod === 'eft' ? 'Institution Number' : 'Routing Number'}</Label>
                        <Input value={assignBankRoutingNumber} onChange={(e) => setAssignBankRoutingNumber(e.target.value.replace(/\D/g, ''))} placeholder={assignPaymentMethod === 'eft' ? '003' : '021000021'} inputMode="numeric" />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <Input value={assignBankAccountNumber} onChange={(e) => setAssignBankAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="Account number" inputMode="numeric" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <Select value={assignBankAccountType} onValueChange={(v) => setAssignBankAccountType(v as 'checking' | 'savings')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="w-4 h-4" />
                      Bank Address
                    </div>
                    <div className="space-y-2">
                      <Label>Street Address</Label>
                      <Input value={assignBankAddress} onChange={(e) => setAssignBankAddress(e.target.value)} placeholder="123 Main St" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={assignBankCity} onChange={(e) => setAssignBankCity(e.target.value)} placeholder="City" />
                      </div>
                      <div className="space-y-2">
                        <Label>State / Province</Label>
                        <Input value={assignBankState} onChange={(e) => setAssignBankState(e.target.value)} placeholder="State" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>ZIP / Postal Code</Label>
                        <Input value={assignBankZip} onChange={(e) => setAssignBankZip(e.target.value)} placeholder="12345" />
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input value={assignBankCountry} onChange={(e) => setAssignBankCountry(e.target.value)} placeholder="Country" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Interac e-Transfer Details */}
              {assignPaymentMethod === 'interac_etransfer' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ArrowRightLeft className="w-4 h-4" />
                      e-Transfer Details
                    </div>
                    <div className="space-y-2">
                      <Label>Recipient Email</Label>
                      <Input value={assignEtransferEmail} onChange={(e) => setAssignEtransferEmail(e.target.value)} placeholder="email@example.com" type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label>Recipient Name</Label>
                      <Input value={assignEtransferName} onChange={(e) => setAssignEtransferName(e.target.value)} placeholder="Recipient name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Security Question (optional)</Label>
                      <Input value={assignEtransferSecurityQ} onChange={(e) => setAssignEtransferSecurityQ(e.target.value)} placeholder="e.g. What is the invoice number?" />
                    </div>
                    <div className="space-y-2">
                      <Label>Security Answer (optional)</Label>
                      <Input value={assignEtransferSecurityA} onChange={(e) => setAssignEtransferSecurityA(e.target.value)} placeholder="Answer" />
                    </div>
                  </div>
                </>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Internal notes about this subscription..."
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignSubscription.mutate()}
              disabled={assignSubscription.isPending || !assignOrgId || !assignPlanId || (assignPlanId === 'custom' && (!assignCustomPrice || parseFloat(assignCustomPrice) <= 0))}
            >
              {assignSubscription.isPending ? 'Assigning...' : 'Assign Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {selectedSub && (
        <>
          <ExtendTrialDialog
            open={extendTrialOpen}
            onOpenChange={setExtendTrialOpen}
            sub={selectedSub}
            onDone={() => queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })}
          />
          <OverrideSubscriptionDialog
            open={overrideOpen}
            onOpenChange={setOverrideOpen}
            sub={selectedSub}
            plans={plans || []}
            onDone={() => queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })}
          />
          <SetDiscountDialog
            open={setDiscountOpen}
            onOpenChange={setSetDiscountOpen}
            sub={selectedSub}
            onDone={() => queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })}
          />
        </>
      )}
    </div>
  );
}
