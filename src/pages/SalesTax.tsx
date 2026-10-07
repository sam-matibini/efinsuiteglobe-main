import { useState, useMemo } from 'react';
import { Calendar, FileText, AlertTriangle, Check, Settings, Plus, Trash2, TrendingUp, BarChart3, Sparkles, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxCodes, useTaxReturns, useCreateTaxCode, useUpdateTaxCode, useDeleteTaxCode, useSalesTaxSettings } from '@/hooks/useSalesTax';
import { useAccounts } from '@/hooks/useAccounts';
import { TaxReportPreview } from '@/components/tax/TaxReportPreview';
import { format, parseISO } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { getCountryLocalization, getPrimaryRetailTaxType, COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { EditTaxCodeDialog } from '@/components/tax/EditTaxCodeDialog';
import { taxCodePostingSides } from '@/lib/retailTaxRateCatalog';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

export default function SalesTax() {
  const confirmDelete = useConfirmDelete();
  const { organization } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();

  // Determine country code from organization (needed for country-aware tax code derivation)
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

  const countryLocalization = useMemo(() => 
    getCountryLocalization(countryCode), 
    [countryCode]
  );

  const { data: taxCodes = [], isLoading: codesLoading } = useTaxCodes(organization?.id, countryCode);
  const { data: taxReturns = [], isLoading: returnsLoading } = useTaxReturns(organization?.id);
  const { data: settings } = useSalesTaxSettings(organization?.id);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(organization?.id);
  const createTaxCode = useCreateTaxCode();
  const updateTaxCode = useUpdateTaxCode();
  const deleteTaxCode = useDeleteTaxCode();


  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [showAddCodeDialog, setShowAddCodeDialog] = useState(false);
  const [editingCode, setEditingCode] = useState<any | null>(null);
  
  // Tax Summary filters
  const [summaryPeriod, setSummaryPeriod] = useState<'current_year' | 'last_year' | 'current_quarter' | 'last_quarter'>('last_year');
  const [summaryAccountType, setSummaryAccountType] = useState<'all' | 'collected' | 'paid' | 'pst'>('all');
  const [summaryCategory, setSummaryCategory] = useState<'gst' | 'pst'>('gst');

  const form = useForm({
    defaultValues: {
      code: '',
      name: '',
      rate: 0,
      jurisdiction: '',
      tax_type: 'both',
      is_recoverable: true,
      is_compound: false,
      is_active: true,
    },
  });

  // Get localized tax terminology
  const taxTerminology = useMemo(() => {
    switch (countryCode) {
      case 'CA':
        return {
          title: 'Sales Tax',
          description: 'GST/HST and PST from the general ledger. CRA account balances are in Tax & CRA.',
          returnLabel: 'Tax Returns',
          collectedLabel: 'Tax Collected (Sales)',
          paidLabel: 'Tax Paid (ITCs)',
          netLabel: 'Net Payable',
          authorityLabel: 'CRA',
          itcLabel: 'ITCs',
        };
      case 'US':
        return {
          title: 'Sales Tax',
          description: 'State sales tax management and reporting',
          returnLabel: 'Tax Returns',
          collectedLabel: 'Tax Collected',
          paidLabel: 'Tax Exempt Sales',
          netLabel: 'Net Remittable',
          authorityLabel: 'State Revenue',
          itcLabel: 'Exemptions',
        };
      case 'ZM':
        return {
          title: 'VAT (Value Added Tax)',
          description: 'VAT management and ZRA reporting',
          returnLabel: 'VAT Returns',
          collectedLabel: 'Output VAT',
          paidLabel: 'Input VAT',
          netLabel: 'Net Payable',
          authorityLabel: 'ZRA',
          itcLabel: 'Input VAT',
        };
      case 'KE':
        return {
          title: 'VAT (Value Added Tax)',
          description: 'VAT management and KRA reporting',
          returnLabel: 'VAT Returns',
          collectedLabel: 'Output VAT',
          paidLabel: 'Input VAT',
          netLabel: 'Net Payable',
          authorityLabel: 'KRA',
          itcLabel: 'Input VAT',
        };
      case 'BI':
        return {
          title: 'TVA (Taxe sur la Valeur Ajoutée)',
          description: 'Gestion TVA et déclarations OBR',
          returnLabel: 'Déclarations TVA',
          collectedLabel: 'TVA Collectée',
          paidLabel: 'TVA Déductible',
          netLabel: 'TVA Nette',
          authorityLabel: 'OBR',
          itcLabel: 'TVA Déductible',
        };
      default: {
        const primary = getPrimaryRetailTaxType(countryCode);
        const paid = primary?.paidName || 'Tax Paid (Input)';
        return {
          title: primary?.name?.replace(/^Collect\s+/i, '') || 'Sales Tax',
          description: primary
            ? `${primary.description} — collected on sales and ${paid.toLowerCase()} on purchases`
            : 'Tax management and reporting',
          returnLabel: 'Tax Returns',
          collectedLabel: primary?.name || 'Tax Collected',
          paidLabel: paid,
          netLabel: 'Net Payable',
          authorityLabel: 'Tax Authority',
          itcLabel: primary?.isRecoverable ? paid : 'Credits',
        };
      }
    }
  }, [countryCode]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(countryLocalization.code === 'BI' ? 'fr-BI' : `en-${countryCode}`, {
      style: 'currency',
      currency: countryLocalization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const currentPeriod = useMemo(() => {
    if (!selectedPeriod && taxReturns.length > 0) {
      return taxReturns[0];
    }
    return taxReturns.find(p => p.id === selectedPeriod) || taxReturns[0];
  }, [selectedPeriod, taxReturns]);

  const annualSummary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearReturns = taxReturns.filter(r => parseLocalDate(r.period_end).getFullYear() === currentYear);
    return {
      collected: yearReturns.reduce((sum, r) => sum + Number(r.tax_collected), 0),
      paid: yearReturns.reduce((sum, r) => sum + Number(r.tax_paid), 0),
      remitted: yearReturns.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.net_payable), 0),
    };
  }, [taxReturns]);

  // Calculate real-time tax balances from GL accounts
  const glTaxSummary = useMemo(() => {
    // Find GST/HST/VAT collected (payable) accounts - includes "Payable" naming convention
    const taxCollectedAccounts = accounts.filter(a => {
      const nameLower = a.name.toLowerCase();
      // Match: GST/HST Payable, GST/HST Collected, VAT Payable, Tax Collected, TVA Collectée
      const isGstHstVat = nameLower.includes('gst') || nameLower.includes('hst') || 
                          nameLower.includes('vat') || nameLower.includes('tva');
      const isCollectedType = nameLower.includes('collected') || nameLower.includes('collectée') ||
                              (nameLower.includes('payable') && !nameLower.includes('pst') && !nameLower.includes('qst'));
      // Exclude ITC/Input accounts
      const isNotInput = !nameLower.includes('input') && !nameLower.includes('itc') && !nameLower.includes('déductible');
      return isGstHstVat && (isCollectedType || (!nameLower.includes('input') && !nameLower.includes('itc'))) && isNotInput;
    });
    
    // Find GST/HST/VAT paid (input/ITC) accounts
    const taxPaidAccounts = accounts.filter(a => {
      const nameLower = a.name.toLowerCase();
      const isGstHstVat = nameLower.includes('gst') || nameLower.includes('hst') || 
                          nameLower.includes('vat') || nameLower.includes('tva');
      const isInputType = nameLower.includes('input') || nameLower.includes('itc') || 
                          nameLower.includes('déductible') || nameLower.includes('credit');
      return isGstHstVat && isInputType;
    });
    
    // Find PST/QST payable accounts (provincial taxes)
    const pstPayableAccounts = accounts.filter(a => {
      const nameLower = a.name.toLowerCase();
      return (nameLower.includes('pst') || nameLower.includes('qst') || nameLower.includes('rst')) && 
             (nameLower.includes('payable') || nameLower.includes('collected'));
    });

    // Sum balances (collected is typically a credit balance, paid is debit)
    const collected = taxCollectedAccounts.reduce((sum, a) => sum + Math.abs(Number(a.current_balance || 0)), 0);
    const paid = taxPaidAccounts.reduce((sum, a) => sum + Math.abs(Number(a.current_balance || 0)), 0);
    const pstPayable = pstPayableAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
    const netPayable = collected - paid;

    return {
      collected,
      paid,
      pstPayable,
      netPayable,
      hasData: collected > 0 || paid > 0 || pstPayable !== 0,
      accounts: {
        collected: taxCollectedAccounts,
        paid: taxPaidAccounts,
        pst: pstPayableAccounts,
      }
    };
  }, [accounts]);

  const statusConfig = {
    draft: { label: countryCode === 'BI' ? 'Brouillon' : 'Draft', color: 'bg-amber-100 text-amber-800' },
    filed: { label: countryCode === 'BI' ? 'Soumis' : 'Filed', color: 'bg-blue-100 text-blue-800' },
    paid: { label: countryCode === 'BI' ? 'Payé' : 'Paid', color: 'bg-green-100 text-green-800' },
  };

  const handleAddTaxCode = async (data: any) => {
    if (!organization?.id) return;
    await createTaxCode.mutateAsync({
      organizationId: organization.id,
      taxCode: data,
    });
    form.reset();
    setShowAddCodeDialog(false);
  };

  const handleDeleteTaxCode = async (id: string) => {
    if (!organization?.id) return;
    await deleteTaxCode.mutateAsync({ id, organizationId: organization.id });
  };

  const isLoading = codesLoading || returnsLoading || accountsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Get tax settings description based on country
  const getSettingsDescription = () => {
    if (!settings) {
      return taxTerminology.description;
    }
    
    switch (countryCode) {
      case 'CA':
        return (
          <>
            {settings.collect_hst ? `HST ${settings.hst_rate}%` : ''}
            {settings.collect_gst ? `GST ${settings.gst_rate}%` : ''}
            {settings.collect_pst ? ` + PST ${settings.pst_rate}%` : ''}
            {' • '}{settings.filing_frequency} filing
          </>
        );
      default:
        const defaultTax = countryLocalization.taxTypes[0];
        return defaultTax 
          ? `${defaultTax.code} ${defaultTax.defaultRate}% • ${settings?.filing_frequency || 'Monthly'} filing`
          : taxTerminology.description;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{taxTerminology.title}</h1>
          <p className="text-muted-foreground">
            {getSettingsDescription()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/tax/setup">
            <Button variant="outline" size="sm">
              <Sparkles className="w-4 h-4 mr-2" />
              Setup Wizard
            </Button>
          </Link>
          <Link to="/tax/reports">
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              Advanced Reports
            </Button>
          </Link>
          <Link to="/settings?tab=sales-tax">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              {countryCode === 'BI' ? 'Paramètres' : 'Tax Settings'}
            </Button>
          </Link>
          {countryCode === 'CA' ? (
            <Button asChild>
              <Link to="/tax-cra/gst-hst">
                <FileText className="w-4 h-4 mr-2" />
                File with CRA
              </Link>
            </Button>
          ) : !isReadOnly && (
            <Button>
              <FileText className="w-4 h-4 mr-2" />
              {countryCode === 'BI' ? 'Soumettre Déclaration' : 'File Return'}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="returns" className="space-y-6">
        <TabsList>
          <TabsTrigger value="returns">{taxTerminology.returnLabel}</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            {countryCode === 'BI' ? 'Rapports' : 'Reports'}
          </TabsTrigger>
          <TabsTrigger value="codes">{countryCode === 'BI' ? 'Codes TVA' : 'Tax Codes'}</TabsTrigger>
          <TabsTrigger value="summary">{countryCode === 'BI' ? 'Résumé' : 'Tax Summary'}</TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="space-y-6">
          {taxReturns.length > 0 && currentPeriod && (
            <>
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {countryCode === 'BI' ? 'Période:' : 'Period:'}
                  </span>
                  <Select value={currentPeriod.id} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taxReturns.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.period_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="ml-auto">
                    <Badge className={statusConfig[currentPeriod.status]?.color || statusConfig.draft.color}>
                      {statusConfig[currentPeriod.status]?.label || currentPeriod.status}
                    </Badge>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 border-l-4 border-l-green-500">
                  <p className="text-sm text-muted-foreground mb-1">{taxTerminology.collectedLabel}</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(Number(currentPeriod.tax_collected))}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-blue-500">
                  <p className="text-sm text-muted-foreground mb-1">{taxTerminology.paidLabel}</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(Number(currentPeriod.tax_paid))}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-amber-500">
                  <p className="text-sm text-muted-foreground mb-1">{taxTerminology.netLabel}</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(Number(currentPeriod.net_payable))}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-destructive">
                  <p className="text-sm text-muted-foreground mb-1">
                    {countryCode === 'BI' ? 'Date Limite' : 'Due Date'}
                  </p>
                  <p className="text-2xl font-bold text-foreground">{format(parseLocalDate(currentPeriod.due_date), 'MMM d, yyyy')}</p>
                  {currentPeriod.status === 'draft' && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {countryCode === 'BI' ? 'Non soumis' : 'Not yet filed'}
                    </p>
                  )}
                </Card>
              </div>
            </>
          )}

          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <h3 className="font-semibold text-foreground">
                {countryCode === 'BI' ? 'Historique des Déclarations' : 'Filing History'}
              </h3>
            </div>
            {taxReturns.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {countryCode === 'BI' 
                  ? 'Aucune déclaration trouvée. Créez votre première déclaration pour commencer.'
                  : 'No tax returns found. Create your first tax return to start tracking.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{countryCode === 'BI' ? 'Période' : 'Period'}</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Date Limite' : 'Due Date'}</TableHead>
                    <TableHead className="text-right">{taxTerminology.collectedLabel}</TableHead>
                    <TableHead className="text-right">{taxTerminology.itcLabel}</TableHead>
                    <TableHead className="text-right">{taxTerminology.netLabel}</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Statut' : 'Status'}</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Actions' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxReturns.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">{period.period_name}</TableCell>
                      <TableCell className="text-muted-foreground">{format(parseLocalDate(period.due_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(period.tax_collected))}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(period.tax_paid))}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(Number(period.net_payable))}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[period.status]?.color || statusConfig.draft.color}>
                          {statusConfig[period.status]?.label || period.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          {countryCode === 'BI' ? 'Voir' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <TaxReportPreview
            organizationId={organization?.id}
            organizationName={organization?.name}
            countryCode={countryCode}
            taxTerminology={taxTerminology}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="codes" className="space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {countryCode === 'BI' ? 'Codes TVA' : 'Tax Codes'}
              </h3>
              {!isReadOnly && (
                <Button variant="outline" size="sm" onClick={() => setShowAddCodeDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {countryCode === 'BI' ? 'Ajouter Code' : 'Add Tax Code'}
                </Button>
              )}
            </div>
            {taxCodes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {countryCode === 'BI'
                  ? 'Aucun code TVA configuré. Ajoutez votre premier code pour commencer.'
                  : 'No tax codes configured. Add your first tax code to start.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Nom' : 'Name'}</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Taux' : 'Rate'}</TableHead>
                    <TableHead>{countryLocalization.jurisdictionLabel}</TableHead>
                    <TableHead>GL Collected</TableHead>
                    <TableHead>GL Paid (ITC)</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Récupérable' : 'Recoverable'}</TableHead>
                    <TableHead>{countryCode === 'BI' ? 'Statut' : 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxCodes.map((code) => {
                    const noPosting = (code as any).is_zero_rated || (code as any).is_exempt || Number(code.rate || 0) === 0;
                    const sides = taxCodePostingSides(code);
                    const needsCollected = !noPosting && sides.collected;
                    const needsPaid = !noPosting && sides.paid;
                    const collectedAcct = accounts.find(a => a.id === (code as any).gl_collected_account_id);
                    const paidAcct = accounts.find(a => a.id === (code as any).gl_paid_account_id);
                    const renderMapping = (
                      needed: boolean,
                      acct: typeof collectedAcct,
                    ) => {
                      if (!needed) return <span className="text-muted-foreground text-xs">N/A</span>;
                      if (!acct) return <Badge variant="destructive" className="text-xs">Not mapped</Badge>;
                      return (
                        <span className="text-xs">
                          <span className="font-mono text-muted-foreground">{acct.code}</span>{' '}
                          {acct.name}
                        </span>
                      );
                    };
                    return (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono font-medium text-primary">{code.code}</TableCell>
                        <TableCell className="font-medium">{code.name}</TableCell>
                        <TableCell className="font-mono">{Number(code.rate).toFixed(2)}%</TableCell>
                        <TableCell className="text-muted-foreground">{code.jurisdiction || '-'}</TableCell>
                        <TableCell>{renderMapping(needsCollected, collectedAcct)}</TableCell>
                        <TableCell>{renderMapping(needsPaid, paidAcct)}</TableCell>
                        <TableCell>
                          {code.is_recoverable ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={code.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                            {code.is_active
                              ? (countryCode === 'BI' ? 'Actif' : 'Active')
                              : (countryCode === 'BI' ? 'Inactif' : 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            {!isReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCode(code)}
                                aria-label="Edit tax code"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {!isReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => confirmDelete(() => handleDeleteTaxCode(code.id), { itemName: code.code, title: 'Delete tax code?' })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          {countryCode === 'CA' && (
            <p className="text-sm text-muted-foreground">
              Amounts on this tab come from the general ledger. CRA account balances, EFILE, and remittances are in{' '}
              <Link to="/tax-cra" className="text-primary underline-offset-4 hover:underline">Tax & CRA</Link>.
            </p>
          )}
          {/* Category Tabs for Canada */}
          {countryCode === 'CA' && (
            <Tabs value={summaryCategory} onValueChange={(v) => setSummaryCategory(v as 'gst' | 'pst')} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="gst"
                  className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-emerald-500"
                >
                  <FileText className="w-4 h-4" />
                  GST/HST (books)
                </TabsTrigger>
                <TabsTrigger
                  value="pst"
                  className="gap-2 data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-sky-500"
                >
                  <FileText className="w-4 h-4" />
                  Provincial (PST/QST)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Summary Filters */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <Label className="text-sm text-muted-foreground">{countryCode === 'BI' ? 'Période:' : 'Period:'}</Label>
            <Select value={summaryPeriod} onValueChange={(v) => setSummaryPeriod(v as any)}>
              <SelectTrigger className="w-[160px] h-9">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_year">{countryCode === 'BI' ? 'Année Courante' : 'Current Year'}</SelectItem>
                <SelectItem value="last_year">{countryCode === 'BI' ? 'Année Dernière' : 'Last Year'}</SelectItem>
                <SelectItem value="current_quarter">{countryCode === 'BI' ? 'Trimestre Courant' : 'Current Quarter'}</SelectItem>
                <SelectItem value="last_quarter">{countryCode === 'BI' ? 'Trimestre Dernier' : 'Last Quarter'}</SelectItem>
              </SelectContent>
            </Select>
            
            {countryCode !== 'CA' && (
              <>
                <Label className="text-sm text-muted-foreground ml-2">{countryCode === 'BI' ? 'Type:' : 'Type:'}</Label>
                <Select value={summaryAccountType} onValueChange={(v) => setSummaryAccountType(v as any)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{countryCode === 'BI' ? 'Tous' : 'All Types'}</SelectItem>
                    <SelectItem value="collected">{countryCode === 'BI' ? 'Collectée' : 'Collected'}</SelectItem>
                    <SelectItem value="paid">{countryCode === 'BI' ? 'Payée' : 'Paid/ITC'}</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Real-time GL Tax Balances - GST/HST or All */}
          {(summaryCategory === 'gst' || countryCode !== 'CA') && glTaxSummary.hasData && (
            <Card className="p-6 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  {countryCode === 'BI' 
                    ? 'Soldes TVA en Temps Réel' 
                    : countryCode === 'CA' 
                      ? 'GST/HST balances from the general ledger' 
                      : 'Current Tax Balances (from GL)'}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {countryCode === 'BI' 
                  ? 'Montants actuels dans vos comptes de taxes du grand livre'
                  : countryCode === 'CA'
                    ? 'Federal GST/HST posted in the general ledger. This is not the CRA account balance.'
                    : 'Current amounts posted to your tax liability accounts'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    {taxTerminology.collectedLabel}
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(glTaxSummary.collected)}
                  </p>
                  {glTaxSummary.accounts.collected.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {glTaxSummary.accounts.collected.map(a => a.code).join(', ')}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    {taxTerminology.paidLabel}
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(glTaxSummary.paid)}
                  </p>
                  {glTaxSummary.accounts.paid.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {glTaxSummary.accounts.paid.map(a => a.code).join(', ')}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    {taxTerminology.netLabel}
                  </p>
                  <p className={`text-2xl font-bold ${glTaxSummary.netPayable >= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                    {formatCurrency(Math.abs(glTaxSummary.netPayable))}
                  </p>
                </div>
                {/* Refund/Owing indicator */}
                <div className={`p-4 rounded-lg ${glTaxSummary.netPayable < 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <p className="text-sm text-muted-foreground mb-1">
                    {countryCode === 'BI' ? 'Remboursement / Dû' : 'Refund / Owing'}
                  </p>
                  <p className={`text-2xl font-bold ${glTaxSummary.netPayable < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {glTaxSummary.netPayable < 0 ? (
                      <>
                        {formatCurrency(Math.abs(glTaxSummary.netPayable))}
                        <span className="text-sm font-normal ml-1">
                          {countryCode === 'BI' ? '(remboursement)' : '(refund)'}
                        </span>
                      </>
                    ) : (
                      <>
                        {formatCurrency(glTaxSummary.netPayable)}
                        <span className="text-sm font-normal ml-1">
                          {countryCode === 'BI' ? '(dû)' : '(owing)'}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* PST Summary for Canada */}
          {summaryCategory === 'pst' && countryCode === 'CA' && (
            <Card className="p-6 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-foreground">
                  Provincial Sales Tax Balances (from GL)
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Provincial sales tax (PST, RST, QST) amounts from your General Ledger accounts
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">PST/QST Payable</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(Math.abs(glTaxSummary.pstPayable))}
                  </p>
                  {glTaxSummary.accounts.pst.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {glTaxSummary.accounts.pst.map(a => a.code).join(', ')}
                    </p>
                  )}
                </div>
                {/* Refund/Owing indicator for PST */}
                <div className={`p-4 rounded-lg ${glTaxSummary.pstPayable < 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <p className="text-sm text-muted-foreground mb-1">Refund / Owing</p>
                  <p className={`text-2xl font-bold ${glTaxSummary.pstPayable < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {glTaxSummary.pstPayable < 0 ? (
                      <>
                        {formatCurrency(Math.abs(glTaxSummary.pstPayable))}
                        <span className="text-sm font-normal ml-1">(refund)</span>
                      </>
                    ) : (
                      <>
                        {formatCurrency(Math.abs(glTaxSummary.pstPayable))}
                        <span className="text-sm font-normal ml-1">(owing)</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Account Breakdown Table */}
          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <h3 className="font-semibold text-foreground">
                {countryCode === 'BI' ? 'Détail des Comptes' : 'Account Breakdown'}
              </h3>
            </div>
            {(summaryCategory === 'gst' || countryCode !== 'CA') ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{countryCode === 'BI' ? 'Compte' : 'Account'}</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">{countryCode === 'BI' ? 'Solde' : 'Balance'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {glTaxSummary.accounts.collected.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{acc.code}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {countryCode === 'BI' ? 'Collectée' : 'Collected'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Math.abs(Number(acc.current_balance || 0)))}</TableCell>
                    </TableRow>
                  ))}
                  {glTaxSummary.accounts.paid.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{acc.code}</TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {countryCode === 'BI' ? 'TVA Déductible' : 'Paid/ITC'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Math.abs(Number(acc.current_balance || 0)))}</TableCell>
                    </TableRow>
                  ))}
                  {glTaxSummary.accounts.collected.length === 0 && glTaxSummary.accounts.paid.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {countryCode === 'BI' 
                          ? 'Aucun compte de taxes trouvé. Configurez vos comptes GST/HST dans le plan comptable.'
                          : 'No tax accounts found. Set up your GST/HST accounts in the chart of accounts.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {glTaxSummary.accounts.pst.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{acc.code}</TableCell>
                      <TableCell>
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          PST/QST
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Math.abs(Number(acc.current_balance || 0)))}</TableCell>
                    </TableRow>
                  ))}
                  {glTaxSummary.accounts.pst.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No PST/QST accounts found. Set up your provincial tax accounts in the chart of accounts.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Annual Summary from Tax Returns */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {new Date().getFullYear()} {countryCode === 'BI' ? 'Résumé des Déclarations' : 'Filed Returns Summary'}
              {countryCode === 'CA' && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({summaryCategory === 'gst' ? 'GST/HST' : 'PST/QST'})
                </span>
              )}
            </h3>
            {taxReturns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {countryCode === 'BI' 
                  ? 'Aucune déclaration soumise. Les soldes ci-dessus proviennent du grand livre.'
                  : 'No tax returns filed yet. The balances above are from your General Ledger.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {countryCode === 'BI' ? 'Total TVA Collectée' : 'Total Tax Collected'}
                  </p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(annualSummary.collected)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {countryCode === 'BI' ? 'Total TVA Déductible' : `Total ${taxTerminology.itcLabel} Claimed`}
                  </p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(annualSummary.paid)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {countryCode === 'BI' ? 'TVA Nette Versée' : 'Net Tax Remitted'}
                  </p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(annualSummary.remitted)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {countryCode === 'BI' ? 'Remboursement / Dû' : 'Refund / Owing'}
                  </p>
                  <p className={`text-3xl font-bold ${annualSummary.remitted < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {annualSummary.remitted < 0 ? (
                      <>{formatCurrency(Math.abs(annualSummary.remitted))} <span className="text-lg">(refund)</span></>
                    ) : (
                      <>{formatCurrency(annualSummary.remitted)} <span className="text-lg">(owing)</span></>
                    )}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddCodeDialog} onOpenChange={setShowAddCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {countryCode === 'BI' ? 'Ajouter Code TVA' : 'Add Tax Code'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleAddTaxCode)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input {...form.register('code')} placeholder={countryCode === 'CA' ? 'HST' : 'VAT'} />
              </div>
              <div className="space-y-2">
                <Label>{countryCode === 'BI' ? 'Taux (%)' : 'Rate (%)'}</Label>
                <Input type="number" step="0.01" {...form.register('rate', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{countryCode === 'BI' ? 'Nom' : 'Name'}</Label>
              <Input {...form.register('name')} placeholder={countryCode === 'CA' ? 'Harmonized Sales Tax' : 'Value Added Tax'} />
            </div>
            <div className="space-y-2">
              <Label>{countryLocalization.jurisdictionLabel}</Label>
              <Input {...form.register('jurisdiction')} placeholder={countryLocalization.jurisdictions[0]?.name || ''} />
            </div>
            <div className="space-y-2">
              <Label>{countryCode === 'BI' ? 'Type de Taxe' : 'Tax Type'}</Label>
              <Select value={form.watch('tax_type')} onValueChange={(v) => form.setValue('tax_type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">{countryCode === 'BI' ? 'Ventes Seulement' : 'Sales Only'}</SelectItem>
                  <SelectItem value="purchase">{countryCode === 'BI' ? 'Achats Seulement' : 'Purchases Only'}</SelectItem>
                  <SelectItem value="both">{countryCode === 'BI' ? 'Les Deux' : 'Both'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{countryCode === 'BI' ? 'Récupérable' : 'Recoverable (ITC)'}</p>
                <p className="text-sm text-muted-foreground">
                  {countryCode === 'BI' ? 'TVA déductible sur achats' : 'Can claim as input tax credit'}
                </p>
              </div>
              <Switch 
                checked={form.watch('is_recoverable')} 
                onCheckedChange={(v) => form.setValue('is_recoverable', v)} 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddCodeDialog(false)}>
                {countryCode === 'BI' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={createTaxCode.isPending}>
                {createTaxCode.isPending 
                  ? (countryCode === 'BI' ? 'Ajout...' : 'Adding...')
                  : (countryCode === 'BI' ? 'Ajouter Code' : 'Add Tax Code')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <EditTaxCodeDialog
        code={editingCode}
        open={!!editingCode}
        onOpenChange={(o) => !o && setEditingCode(null)}
        accounts={accounts}
        onSubmit={async (updates) => {
          if (!organization?.id || !editingCode) return;
          await updateTaxCode.mutateAsync({
            id: editingCode.id,
            organizationId: organization.id,
            updates: {
              ...updates,
              applies_to: editingCode.applies_to,
              paid_name: editingCode.paid_name,
              is_compound: editingCode.is_compound,
              isVirtual: editingCode.isVirtual,
            },
          });
          setEditingCode(null);
        }}
        isPending={updateTaxCode.isPending}
      />
    </div>
  );
}

