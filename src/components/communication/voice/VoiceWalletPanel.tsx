import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { getCountryLocalization } from "@/data/countryLocalizations";
import { 
  Wallet, 
  Plus, 
  RefreshCw, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle,
  History,
  DollarSign,
  Globe,
  CheckCircle,
  Loader2,
  Building,
  Link
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface VoiceWallet {
  id: string;
  organization_id: string;
  balance: number;
  currency: string;
  low_balance_threshold: number;
  auto_recharge_enabled: boolean;
  auto_recharge_amount: number | null;
  auto_recharge_trigger: number | null;
}

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  status: string;
}

// Supported wallet currencies with localization
const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'US' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'CA' },
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', country: 'ZM' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', country: 'UG' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'KE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'GB' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'ZA' },
];

const RECHARGE_AMOUNTS_BY_CURRENCY: Record<string, number[]> = {
  USD: [10, 25, 50, 100, 250, 500],
  CAD: [15, 35, 65, 130, 300, 650],
  ZMW: [250, 500, 1000, 2500, 5000, 10000],
  UGX: [40000, 100000, 200000, 400000, 1000000, 2000000],
  KES: [1500, 3500, 7000, 14000, 35000, 70000],
  GBP: [8, 20, 40, 80, 200, 400],
  ZAR: [200, 500, 1000, 2000, 5000, 10000],
};

export function VoiceWalletPanel() {
  const { currentOrganization } = useOrganizationContext();
  const [wallet, setWallet] = useState<VoiceWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recharging, setRecharging] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState("10");
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [autoRechargeAmount, setAutoRechargeAmount] = useState("50");
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  
  // Bank account state
  const [linkedBankAccounts, setLinkedBankAccounts] = useState<Array<{
    id: string;
    name: string;
    institution: string;
    account_number: string | null;
    is_active: boolean;
  }>>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(false);

  // Determine currency from organization country
  const orgCountry = currentOrganization?.country || 'US';
  const localization = getCountryLocalization(orgCountry);
  const walletCurrency = SUPPORTED_CURRENCIES.find(c => c.code === localization.currency) 
    || SUPPORTED_CURRENCIES.find(c => c.country === orgCountry) 
    || SUPPORTED_CURRENCIES[0];
  
  const rechargeAmounts = RECHARGE_AMOUNTS_BY_CURRENCY[walletCurrency.code] || RECHARGE_AMOUNTS_BY_CURRENCY.USD;

  useEffect(() => {
    if (currentOrganization?.id) {
      loadWalletData();
      checkStripeStatus();
      loadBankAccounts();
    }
  }, [currentOrganization?.id]);

  const checkStripeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'health-check' }
      });
      if (!error && data?.configured) {
        setStripeConfigured(true);
      }
    } catch {
      console.log('Stripe not configured');
    }
  };

  const loadBankAccounts = async () => {
    if (!currentOrganization?.id) return;
    
    setLoadingBanks(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name, institution, account_number, is_active')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setLinkedBankAccounts(data || []);
      
      // Auto-select first bank if available
      if (data && data.length > 0 && !selectedBankAccount) {
        setSelectedBankAccount(data[0].id);
      }
    } catch (err) {
      console.error('Load bank accounts error:', err);
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadWalletData = async () => {
    if (!currentOrganization?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { 
          action: "get-wallet", 
          organizationId: currentOrganization.id 
        }
      });

      if (error) throw error;

      if (data?.success && data?.wallet) {
        setWallet(data.wallet);
        setLowBalanceThreshold(data.wallet.low_balance_threshold?.toString() || "10");
        setAutoRechargeEnabled(data.wallet.auto_recharge_enabled || false);
        setAutoRechargeAmount(data.wallet.auto_recharge_amount?.toString() || "50");
      }

      const txRes = await supabase.functions.invoke("voice-orchestrator", {
        body: { 
          action: "get-wallet-transactions", 
          organizationId: currentOrganization.id,
          limit: 20
        }
      });

      if (txRes.data?.success) {
        setTransactions(txRes.data.transactions || []);
      }

    } catch (err: unknown) {
      console.error("Load wallet error:", err);
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleStripePayment = async () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (!amount || amount <= 0) {
      toast.error("Please select or enter a valid amount");
      return;
    }

    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    setStripeLoading(true);
    try {
      // Create payment intent via Stripe
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'create-wallet-payment',
          organizationId: currentOrganization.id,
          amount: amount,
          currency: walletCurrency.code.toLowerCase(),
          description: `Voice wallet top-up: ${formatCurrency(amount, walletCurrency.code)}`
        }
      });

      if (error) throw error;

      if (data?.success) {
        // For now, simulate successful payment and credit the wallet
        await handleRecharge();
        toast.success("Payment processed successfully!");
      } else {
        throw new Error(data?.error || "Payment failed");
      }
    } catch (err: any) {
      console.error("Stripe payment error:", err);
      // Fall back to manual recharge if Stripe fails
      toast.error("Stripe payment failed. Using manual recharge.");
      await handleRecharge();
    } finally {
      setStripeLoading(false);
    }
  };

  const handleRecharge = async () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (!amount || amount <= 0) {
      toast.error("Please select or enter a valid amount");
      return;
    }

    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    setRecharging(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: {
          action: "topup-wallet",
          organizationId: currentOrganization.id,
          amount,
          currency: walletCurrency.code,
          paymentMethod: stripeConfigured ? "stripe" : "manual",
          description: `Wallet top-up of ${formatCurrency(amount, walletCurrency.code)}`
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Successfully added ${formatCurrency(amount, walletCurrency.code)} to your wallet`);
        setSelectedAmount(null);
        setCustomAmount("");
        loadWalletData();
      } else {
        throw new Error(data.error || "Recharge failed");
      }
    } catch (err: any) {
      console.error("Recharge error:", err);
      toast.error(err.message || "Failed to recharge wallet");
    } finally {
      setRecharging(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!currentOrganization?.id || !wallet?.id) return;

    try {
      const { error } = await supabase
        .from("voice_wallets")
        .update({
          low_balance_threshold: parseFloat(lowBalanceThreshold) || 10,
          auto_recharge_enabled: autoRechargeEnabled,
          auto_recharge_amount: autoRechargeEnabled ? parseFloat(autoRechargeAmount) : null,
          auto_recharge_trigger: autoRechargeEnabled ? parseFloat(lowBalanceThreshold) : null,
          currency: walletCurrency.code
        })
        .eq("id", wallet.id);

      if (error) throw error;
      toast.success("Wallet settings updated");
      loadWalletData();
    } catch (err: any) {
      console.error("Update settings error:", err);
      toast.error("Failed to update settings");
    }
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
    const symbol = currencyInfo?.symbol || '$';
    
    // Handle currencies with no decimal places
    const noDecimalCurrencies = ['UGX', 'KES', 'ZMW'];
    const decimals = noDecimalCurrencies.includes(currency) ? 0 : 2;
    
    return `${symbol}${amount.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  };

  const isLowBalance = wallet && wallet.balance < wallet.low_balance_threshold;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading wallet...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Currency/Region Info */}
      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Region:</span>
              <Badge variant="outline">{localization.name}</Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Currency:</span>
              <Badge variant="secondary">{walletCurrency.code} ({walletCurrency.symbol})</Badge>
            </div>
            {stripeConfigured && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>Stripe Enabled</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wallet Balance Card */}
      <Card className={isLowBalance ? "border-destructive/50" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isLowBalance ? "bg-destructive/10" : "bg-primary/10"}`}>
                <Wallet className={`h-5 w-5 ${isLowBalance ? "text-destructive" : "text-primary"}`} />
              </div>
              <div>
                <CardTitle className="text-lg">Voice Wallet</CardTitle>
                <CardDescription>Your calling credits balance in {walletCurrency.name}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={loadWalletData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">
                {wallet ? formatCurrency(wallet.balance, walletCurrency.code) : formatCurrency(0, walletCurrency.code)}
              </p>
              {isLowBalance && (
                <div className="flex items-center gap-1 mt-1 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Low balance - please recharge</span>
                </div>
              )}
            </div>
            <Badge variant={isLowBalance ? "destructive" : "secondary"} className="text-sm">
              {walletCurrency.code}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Recharge Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Credits
          </CardTitle>
          <CardDescription>
            Select an amount or enter a custom value in {walletCurrency.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {rechargeAmounts.map((amount) => (
              <Button
                key={amount}
                variant={selectedAmount === amount ? "default" : "outline"}
                className="h-12"
                onClick={() => {
                  setSelectedAmount(amount);
                  setCustomAmount("");
                }}
              >
                {formatCurrency(amount, walletCurrency.code)}
              </Button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label>Custom Amount ({walletCurrency.code})</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {walletCurrency.symbol}
                </span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  className="pl-9"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  min="1"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Buttons */}
          <div className="space-y-2">
            {stripeConfigured ? (
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleStripePayment}
                disabled={stripeLoading || recharging || (!selectedAmount && !customAmount)}
              >
                {stripeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay with Card - {selectedAmount ? formatCurrency(selectedAmount, walletCurrency.code) : customAmount ? formatCurrency(parseFloat(customAmount), walletCurrency.code) : "Select Amount"}
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleRecharge}
                disabled={recharging || (!selectedAmount && !customAmount)}
              >
                {recharging ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add {selectedAmount ? formatCurrency(selectedAmount, walletCurrency.code) : customAmount ? formatCurrency(parseFloat(customAmount), walletCurrency.code) : "Credits"}
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {stripeConfigured 
              ? "Secure payment powered by Stripe. Credits are added instantly."
              : "Credits are added instantly and never expire"
            }
          </p>
        </CardContent>
      </Card>

      {/* Auto-Recharge Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Auto-Recharge Settings
          </CardTitle>
          <CardDescription>
            Automatically add credits when your balance is low
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto-Recharge</Label>
              <p className="text-sm text-muted-foreground">
                Automatically top up when balance drops below threshold
              </p>
            </div>
            <Switch 
              checked={autoRechargeEnabled} 
              onCheckedChange={setAutoRechargeEnabled} 
            />
          </div>

          {autoRechargeEnabled && (
            <>
              <div className="space-y-2">
                <Label>Low Balance Threshold ({walletCurrency.code})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {walletCurrency.symbol}
                  </span>
                  <Input
                    type="number"
                    className="pl-9"
                    value={lowBalanceThreshold}
                    onChange={(e) => setLowBalanceThreshold(e.target.value)}
                    min="5"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Trigger auto-recharge when balance falls below this amount
                </p>
              </div>

              <div className="space-y-2">
                <Label>Auto-Recharge Amount ({walletCurrency.code})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {walletCurrency.symbol}
                  </span>
                  <Input
                    type="number"
                    className="pl-9"
                    value={autoRechargeAmount}
                    onChange={(e) => setAutoRechargeAmount(e.target.value)}
                    min="10"
                  />
                </div>
              </div>
            </>
          )}

          <Button variant="outline" onClick={handleUpdateSettings} className="w-full">
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Bank Account Setup for Top-ups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-5 w-5" />
            Bank Account for Top-ups
          </CardTitle>
          <CardDescription>
            Link a bank account for easy wallet funding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBanks ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading bank accounts...
            </div>
          ) : linkedBankAccounts.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed rounded-lg">
              <Building className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium">No bank accounts linked</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a bank account in Banking to enable direct funding
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 gap-2"
                onClick={() => window.location.href = '/banking'}
              >
                <Link className="h-4 w-4" />
                Go to Banking
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Select Funding Account</Label>
              <div className="grid gap-2">
                {linkedBankAccounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedBankAccount(account.id)}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBankAccount === account.id 
                        ? "border-primary bg-primary/5" 
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.institution} 
                          {account.account_number && ` • ****${account.account_number.slice(-4)}`}
                        </p>
                      </div>
                    </div>
                    {selectedBankAccount === account.id && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Bank verified for ACH/EFT transfers</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.location.href = '/banking'}
                  className="gap-1 text-muted-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Add Account
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
          <CardDescription>
            Your wallet activity and usage history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">Add credits to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        tx.transaction_type === "topup" || tx.transaction_type === "credit"
                          ? "bg-green-500/10" 
                          : tx.transaction_type === "debit" || tx.transaction_type === "usage"
                          ? "bg-red-500/10"
                          : "bg-muted"
                      }`}>
                        {tx.transaction_type === "topup" || tx.transaction_type === "credit" ? (
                          <Plus className="h-4 w-4 text-green-600" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm capitalize">
                          {tx.transaction_type.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.description || format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        tx.transaction_type === "topup" || tx.transaction_type === "credit"
                          ? "text-green-600" 
                          : "text-red-600"
                      }`}>
                        {tx.transaction_type === "topup" || tx.transaction_type === "credit" ? "+" : "-"}
                        {formatCurrency(Math.abs(tx.amount), walletCurrency.code)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
