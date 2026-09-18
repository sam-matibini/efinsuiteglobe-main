import { useState, useMemo } from 'react';
import { Calendar, FileText, AlertTriangle, Check, Settings, Plus, Trash2, BarChart3, Sparkles, Pencil } from 'lucide-react';
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
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { getCountryLocalization, getPrimaryRetailTaxType, COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { taxCodePostingSides, taxCodeSelectType } from '@/lib/retailTaxRateCatalog';
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
          description: 'GST/HST/PST management and CRA reporting',
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
          <Link to="/settings">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              {countryCode === 'BI' ? 'Paramètres' : 'Tax Settings'}
            </Button>
          </Link>
          {!isReadOnly && (
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
          <TaxReportPreview
            organizationId={organization?.id}
            organizationName={organization?.name}
            countryCode={countryCode}
            taxTerminology={taxTerminology}
            formatCurrency={formatCurrency}
          />

          {/* Annual Summary from Tax Returns */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {new Date().getFullYear()} {countryCode === 'BI' ? 'Résumé des Déclarations' : 'Filed Returns Summary'}
            </h3>
            {taxReturns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {countryCode === 'BI' 
                  ? 'Aucune déclaration soumise. Les soldes ci-dessus proviennent du grand livre.'
                  : 'No tax returns filed yet.'}
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

function EditTaxCodeDialog({
  code,
  open,
  onOpenChange,
  accounts,
  onSubmit,
  isPending,
}: {
  code: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{ id: string; code: string; name: string; account_type: string }>;
  onSubmit: (updates: Record<string, any>) => Promise<void>;
  isPending: boolean;
}) {
  const [form, setForm] = useState<any>({});

  // Reset form when the dialog opens with a different code
  useMemo(() => {
    if (code) {
      setForm({
        code: code.code ?? '',
        name: code.name ?? '',
        rate: Number(code.rate ?? 0),
        jurisdiction: code.jurisdiction ?? '',
        tax_type: taxCodeSelectType(code),
        original_tax_type: code.tax_type ?? 'both',
        is_recoverable: code.is_recoverable ?? true,
        is_active: code.is_active ?? true,
        gl_collected_account_id: code.gl_collected_account_id ?? null,
        gl_paid_account_id: code.gl_paid_account_id ?? null,
      });
    }
  }, [code?.id]);

  const noPosting =
    !!code && ((code as any).is_zero_rated || (code as any).is_exempt || Number(form.rate || 0) === 0);
  const sides = taxCodePostingSides({
    code: form.code,
    tax_type: form.tax_type,
    applies_to: code?.applies_to,
  });
  const needsCollected = !noPosting && sides.collected;
  const needsPaid = !noPosting && sides.paid;

  const liabilityAccounts = accounts.filter((a) => a.account_type === 'liability');
  const assetAccounts = accounts.filter((a) => a.account_type === 'asset');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialSelect = code ? taxCodeSelectType(code) : 'both';
    const taxTypeUnchanged = form.tax_type === initialSelect;
    await onSubmit({
      code: form.code,
      name: form.name,
      rate: Number(form.rate) || 0,
      jurisdiction: form.jurisdiction || null,
      tax_type: taxTypeUnchanged ? (form.original_tax_type || form.tax_type) : form.tax_type,
      is_recoverable: !!form.is_recoverable,
      is_active: !!form.is_active,
      gl_collected_account_id: needsCollected ? form.gl_collected_account_id || null : null,
      gl_paid_account_id: needsPaid ? form.gl_paid_account_id || null : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tax Code</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.rate ?? 0}
                onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Jurisdiction</Label>
            <Input
              value={form.jurisdiction ?? ''}
              onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tax Type</Label>
            <Select value={form.tax_type ?? 'both'} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales Only</SelectItem>
                <SelectItem value="purchase">Purchases Only</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsCollected && (
            <div className="space-y-2">
              <Label>GL Collected Account (Liability)</Label>
              <Select
                value={form.gl_collected_account_id ?? ''}
                onValueChange={(v) => setForm({ ...form, gl_collected_account_id: v || null })}
              >
                <SelectTrigger><SelectValue placeholder="Select liability account" /></SelectTrigger>
                <SelectContent>
                  {liabilityAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono mr-2">{a.code}</span>{a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tax collected on sales is credited here (e.g. GST/HST Payable).
              </p>
            </div>
          )}

          {needsPaid && (
            <div className="space-y-2">
              <Label>GL Paid / ITC Account (Asset)</Label>
              <Select
                value={form.gl_paid_account_id ?? ''}
                onValueChange={(v) => setForm({ ...form, gl_paid_account_id: v || null })}
              >
                <SelectTrigger><SelectValue placeholder="Select asset account" /></SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono mr-2">{a.code}</span>{a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tax paid on purchases is debited here (e.g. GST/HST ITC).
              </p>
            </div>
          )}

          {noPosting && (
            <p className="text-xs text-muted-foreground">
              This code is zero-rated / exempt / 0% — no GL posting accounts required.
            </p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Recoverable (ITC)</p>
              <p className="text-sm text-muted-foreground">Can claim as input tax credit</p>
            </div>
            <Switch
              checked={!!form.is_recoverable}
              onCheckedChange={(v) => setForm({ ...form, is_recoverable: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Active</p>
              <p className="text-sm text-muted-foreground">Available for use on transactions</p>
            </div>
            <Switch
              checked={!!form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
