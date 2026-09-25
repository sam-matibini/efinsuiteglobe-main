import { useState, useMemo } from 'react';
import { Wand2, Receipt, Users, ChevronRight, Check, Sparkles, Loader2, Search, Brain, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { INDUSTRIES, getIndustryConfig } from '@/data/industries';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';

// Get countries with tax regimes
const countries = Object.values(COUNTRY_LOCALIZATIONS).map(loc => ({
  code: loc.code,
  name: loc.name,
  flag: loc.flag,
  taxRegimes: loc.taxRegimes,
  currency: loc.currency,
}));

const organizationSizes = [
  { id: 'small', name: 'Small', description: '1-10 employees', accounts: '40-60 accounts' },
  { id: 'medium', name: 'Medium', description: '11-50 employees', accounts: '60-100 accounts' },
  { id: 'large', name: 'Large', description: '50+ employees', accounts: '100-150 accounts' },
];

interface ChartOfAccountsGeneratorProps {
  organizationId: string;
}

export function ChartOfAccountsGenerator({ organizationId }: ChartOfAccountsGeneratorProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedTaxRegime, setSelectedTaxRegime] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [generationMeta, setGenerationMeta] = useState<any>(null);
  
  const queryClient = useQueryClient();

  // Filter industries based on search
  const filteredIndustries = useMemo(() => {
    if (!searchQuery.trim()) return INDUSTRIES;
    const query = searchQuery.toLowerCase();
    return INDUSTRIES.filter(
      ind => ind.label.toLowerCase().includes(query) || 
             ind.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get selected industry config
  const industryConfig = useMemo(() => {
    return selectedIndustry ? getIndustryConfig(selectedIndustry) : null;
  }, [selectedIndustry]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const query = searchQuery.toLowerCase();
    return countries.filter(c => c.name.toLowerCase().includes(query));
  }, [searchQuery]);

  const handleGenerateWithAI = async () => {
    if (!selectedIndustry || !selectedSize || !selectedCountry || !selectedTaxRegime || !industryConfig) {
      toast.error('Please complete all steps');
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-coa-generator', {
        body: {
          industry: selectedIndustry,
          industryLabel: industryConfig.label,
          country: selectedCountry,
          countryName: countries.find(c => c.code === selectedCountry)?.name || selectedCountry,
          taxRegime: selectedTaxRegime,
          organizationSize: selectedSize,
          accountingFramework: industryConfig.accountingFramework,
          specializedAccounts: industryConfig.specializedAccounts,
          cogsRequired: industryConfig.cogsRequired,
          inventoryRequired: industryConfig.inventoryRequired,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const accounts = data.accounts;
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts generated');
      }

      // Insert accounts into database
      const accountIdMap = new Map<string, string>();
      
      // First pass: Create all accounts without parent_id
      for (const account of accounts) {
        const { parent_code: _parentCode, ...accountData } = account;
        
        const { data: insertedAccount, error: insertError } = await supabase
          .from('accounts')
          .insert({
            organization_id: organizationId,
            code: accountData.code,
            name: accountData.name,
            account_type: accountData.account_type as any,
            is_header: accountData.is_header,
            normal_balance: accountData.normal_balance,
            is_active: true,
            opening_balance: 0,
            current_balance: 0,
            account_class: accountData.account_class,
            account_group: accountData.account_group,
            account_sub_group: accountData.account_sub_group || null,
            is_current: accountData.is_current,
            posting_allowed: accountData.posting_allowed,
            description: accountData.description || null,
          })
          .select('id')
          .single();
        
        if (insertError) {
          console.error(`Error creating account ${accountData.code}:`, insertError);
          continue;
        }
        
        if (insertedAccount) {
          accountIdMap.set(accountData.code, insertedAccount.id);
        }
      }
      
      // Second pass: Update parent relationships
      for (const account of accounts) {
        if (account.parent_code) {
          const accountId = accountIdMap.get(account.code);
          const parentId = accountIdMap.get(account.parent_code);
          
          if (accountId && parentId) {
            await supabase
              .from('accounts')
              .update({ parent_id: parentId })
              .eq('id', accountId);
          }
        }
      }
      
      setGeneratedCount(accountIdMap.size);
      setGenerationMeta(data.meta);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`AI generated ${accountIdMap.size} industry-specific accounts`);
      setStep(5);
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate with AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSearchQuery('');
    setSelectedIndustry(null);
    setSelectedCountry(null);
    setSelectedTaxRegime(null);
    setSelectedSize(null);
    setGeneratedCount(0);
    setGenerationMeta(null);
  };

  const steps = [
    { number: 1, title: 'Industry' },
    { number: 2, title: 'Country' },
    { number: 3, title: 'Tax Regime' },
    { number: 4, title: 'Size' },
    { number: 5, title: 'Complete' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-3">
          <Brain className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">AI-Powered Chart of Accounts Generator</h2>
        <p className="text-muted-foreground mt-1">
          Generate intelligent, industry-specific accounts using AI
        </p>
        
        {/* AI Toggle */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
            useAI ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Sparkles className="w-4 h-4" />
            <span>AI-Enhanced</span>
          </div>
          <Switch checked={useAI} onCheckedChange={setUseAI} />
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, index) => (
          <div key={s.number} className="flex items-center">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
              step >= s.number
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {step > s.number ? <Check className="w-4 h-4" /> : s.number}
            </div>
            <span className={cn(
              "ml-2 text-sm hidden sm:inline",
              step >= s.number ? "text-foreground" : "text-muted-foreground"
            )}>
              {s.title}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-3 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Select Your Industry</h3>
              <p className="text-sm text-muted-foreground">
                {useAI ? 'AI will generate specialized accounts for your industry' : 'Choose from pre-built templates'}
              </p>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search industries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Industry Grid */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredIndustries.map((industry) => (
                  <button
                    key={industry.value}
                    onClick={() => {
                      setSelectedIndustry(industry.value);
                      setSearchQuery('');
                    }}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left",
                      selectedIndustry === industry.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      selectedIndustry === industry.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{industry.label}</h4>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {industry.accountingFramework}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{industry.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            
            {filteredIndustries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No industries match your search
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Select Your Country</h3>
              <p className="text-sm text-muted-foreground">This determines tax and compliance settings</p>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <ScrollArea className="h-[350px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => {
                      setSelectedCountry(country.code);
                      setSelectedTaxRegime(null);
                      setSearchQuery('');
                    }}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all",
                      selectedCountry === country.code
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-3xl">{country.flag}</span>
                    <div className="text-center">
                      <span className="font-semibold block text-sm">{country.name}</span>
                      <span className="text-xs text-muted-foreground">{country.currency}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Select Tax Regime</h3>
              <p className="text-sm text-muted-foreground">Choose your applicable tax structure</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {countries
                .find((c) => c.code === selectedCountry)
                ?.taxRegimes.map((regime) => (
                  <button
                    key={regime}
                    onClick={() => setSelectedTaxRegime(regime)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all",
                      selectedTaxRegime === regime
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Receipt className={cn(
                      "w-8 h-8",
                      selectedTaxRegime === regime ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-semibold">{regime}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Organization Size</h3>
              <p className="text-sm text-muted-foreground">This determines the level of account detail</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {organizationSizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size.id)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all",
                    selectedSize === size.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Users className={cn(
                    "w-8 h-8",
                    selectedSize === size.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="text-center">
                    <span className="font-semibold block">{size.name}</span>
                    <span className="text-sm text-muted-foreground">{size.description}</span>
                    <span className="text-xs text-primary mt-1 block">{size.accounts}</span>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Industry Info Card */}
            {industryConfig && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Industry Configuration</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Framework:</span>
                    <Badge variant="outline" className="ml-2">{industryConfig.accountingFramework}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">COGS Required:</span>
                    <span className="ml-2">{industryConfig.cogsRequired ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Inventory:</span>
                    <span className="ml-2">{industryConfig.inventoryRequired ? 'Yes' : 'No'}</span>
                  </div>
                  {industryConfig.specializedAccounts.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Specialized:</span>
                      <span className="ml-2">{industryConfig.specializedAccounts.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 mb-3">
                <Check className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Chart of Accounts Generated!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {useAI ? 'AI has created your industry-optimized chart of accounts' : 'Your chart of accounts is ready'}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">Generation Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Industry:</span>
                  <span className="ml-2 font-medium">
                    {industryConfig?.label}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Country:</span>
                  <span className="ml-2 font-medium">
                    {countries.find(c => c.code === selectedCountry)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tax Regime:</span>
                  <span className="ml-2 font-medium">{selectedTaxRegime}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Accounts:</span>
                  <span className="ml-2 font-medium">{generatedCount}</span>
                </div>
                {generationMeta?.accountingFramework && (
                  <div>
                    <span className="text-muted-foreground">Framework:</span>
                    <Badge variant="outline" className="ml-2">{generationMeta.accountingFramework}</Badge>
                  </div>
                )}
              </div>
              
              {useAI && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h5 className="font-medium text-sm text-primary">AI-Enhanced Features</h5>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>✓ Industry-specific account naming conventions</li>
                    <li>✓ Optimized account hierarchy for your business type</li>
                    <li>✓ Tax-compliant structure for {selectedTaxRegime}</li>
                    <li>✓ Current/Non-current classification per {industryConfig?.accountingFramework}</li>
                  </ul>
                </div>
              )}
            </div>
            <Button className="w-full" onClick={resetWizard}>
              Generate Another
            </Button>
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 5 && (
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => {
                setStep(step - 1);
                setSearchQuery('');
              }}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => {
                  setStep(step + 1);
                  setSearchQuery('');
                }}
                disabled={
                  (step === 1 && !selectedIndustry) ||
                  (step === 2 && !selectedCountry) ||
                  (step === 3 && !selectedTaxRegime)
                }
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerateWithAI}
                disabled={!selectedSize || isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : useAI ? (
                  <>
                    <Brain className="w-4 h-4" />
                    Generate with AI
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Generate Accounts
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
