import { useState, useMemo } from 'react';
import { Check, Plus, Trash2, Pencil, ChevronDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxCodes, useTaxReturns, useCreateTaxCode, useUpdateTaxCode, useDeleteTaxCode, useSalesTaxSettings, useUpdateTaxReturn } from '@/hooks/useSalesTax';
import { useAccounts } from '@/hooks/useAccounts';
import { TaxReportPreview } from '@/components/tax/TaxReportPreview';
import { TaxDateRangeBar } from '@/components/tax/TaxDateRangeBar';
import { SalesTaxOverview, type SalesTaxAgencyCard } from '@/components/tax/SalesTaxOverview';
import { SalesTaxFilings, type SalesTaxFilingRow } from '@/components/tax/SalesTaxFilings';
import { GstHstSummaryReport } from '@/components/tax/GstHstSummaryReport';
import { GstHstDetailReport } from '@/components/tax/GstHstDetailReport';
import { useGstHstPeriodReport } from '@/hooks/useGstHstPeriodReport';
import { resolveTaxDateRange, toISODate, type TaxDatePreset } from '@/lib/taxPeriodReport';
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
  const updateTaxReturn = useUpdateTaxReturn();

  const [showAddCodeDialog, setShowAddCodeDialog] = useState(false);
  const [editingCode, setEditingCode] = useState<any | null>(null);
  const [showManageCodes, setShowManageCodes] = useState(false);
  const [salesTaxView, setSalesTaxView] = useState<'overview' | 'summary' | 'detail' | 'advanced'>('overview');
  const [filingsTab, setFilingsTab] = useState<'filings' | 'payments'>('filings');
  const [selectedAgencyId, setSelectedAgencyId] = useState('cra-gst-hst');
  const [periodType, setPeriodType] = useState<TaxDatePreset>('this_quarter');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

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

  const dateRange = useMemo(
    () => resolveTaxDateRange(periodType, new Date(), customStartDate, customEndDate),
    [periodType, customStartDate, customEndDate],
  );
  const periodStartStr = toISODate(dateRange.start);
  const periodEndStr = toISODate(dateRange.end);
  const todayIso = toISODate(new Date());

  const { snapshot, isLoading: gstLoading, isFetching: gstFetching, refetch: refetchGst } = useGstHstPeriodReport({
    organizationId: organization?.id,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    authority: taxTerminology.authorityLabel,
    enabled: !!organization?.id,
  });

  const agencyCards: SalesTaxAgencyCard[] = useMemo(
    () =>
      (snapshot.agencies ?? []).map((agency) => ({
        ...agency,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        isCurrent: todayIso >= periodStartStr && todayIso <= periodEndStr,
      })),
    [snapshot.agencies, periodStartStr, periodEndStr, todayIso],
  );

  const filingRows: SalesTaxFilingRow[] = useMemo(() => {
    const rows: SalesTaxFilingRow[] = taxReturns.map((ret) => ({
      id: ret.id,
      taxLabel: taxTerminology.title.includes('GST') || countryCode === 'CA' ? 'GST/HST' : taxTerminology.title,
      periodStart: ret.period_start,
      periodEnd: ret.period_end,
      net: Number(ret.net_payable),
      status: ret.status,
    }));
    const hasCurrent = rows.some((row) => row.periodStart === periodStartStr && row.periodEnd === periodEndStr);
    if (!hasCurrent) {
      rows.unshift({
        id: `current-${periodStartStr}`,
        taxLabel: countryCode === 'CA' ? 'GST/HST' : taxTerminology.title,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        net: snapshot.netTax,
        status: 'draft',
        isSynthetic: true,
      });
    }
    return rows;
  }, [taxReturns, periodStartStr, periodEndStr, snapshot.netTax, taxTerminology.title, countryCode]);

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

  const openQbReport = (view: 'summary' | 'detail' | 'advanced', row?: SalesTaxFilingRow) => {
    if (row) {
      setPeriodType('custom');
      setCustomStartDate(parseLocalDate(row.periodStart));
      setCustomEndDate(parseLocalDate(row.periodEnd));
    }
    setSalesTaxView(view);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          {salesTaxView !== 'overview' && (
            <Button variant="ghost" size="sm" className="mb-1 -ml-2 print:hidden" onClick={() => setSalesTaxView('overview')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Sales Tax overview
            </Button>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {salesTaxView === 'summary'
              ? 'GST/HST Summary Report'
              : salesTaxView === 'detail'
                ? 'GST/HST Detail Report'
                : salesTaxView === 'advanced'
                  ? 'Tax Reports'
                  : 'Sales Tax overview'}
          </h1>
          <p className="text-muted-foreground">{getSettingsDescription()}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="border-[#2CA01C] text-[#2CA01C] hover:bg-[#2CA01C]/10"
            onClick={() => setShowManageCodes(true)}
          >
            Manage sales tax
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-[#2CA01C] hover:bg-[#249018] text-white">
                Reports
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openQbReport('summary')}>GST/HST Summary</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openQbReport('detail')}>GST/HST Detail</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tax/exceptions">Exception details</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openQbReport('advanced')}>Advanced comparison</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-[#2CA01C] hover:bg-[#249018] text-white">
                New
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/tax/filing-periods">Prepare return</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tax/setup">Setup wizard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Tax settings</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {salesTaxView !== 'overview' && (
        <div className="print:hidden">
          <TaxDateRangeBar
            preset={periodType}
            start={dateRange.start}
            end={dateRange.end}
            periodLabel={`${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`}
            countryCode={countryCode}
            isRefreshing={gstFetching}
            onPresetChange={(preset) => {
              setPeriodType(preset);
              if (preset !== 'custom') {
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
              }
            }}
            onStartChange={(date) => {
              setPeriodType('custom');
              setCustomStartDate(date);
            }}
            onEndChange={(date) => {
              setPeriodType('custom');
              setCustomEndDate(date);
            }}
            onRun={() => refetchGst()}
          />
        </div>
      )}

      {salesTaxView === 'overview' && (
        <>
          <SalesTaxOverview
            cards={agencyCards}
            selectedId={selectedAgencyId}
            formatCurrency={formatCurrency}
            onSelect={setSelectedAgencyId}
          />
          <div className="flex items-center justify-between border-b">
            <Tabs value={filingsTab} onValueChange={(value) => setFilingsTab(value as 'filings' | 'payments')}>
              <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger
                  value="filings"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2CA01C] data-[state=active]:shadow-none"
                >
                  Filings
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2CA01C] data-[state=active]:shadow-none"
                >
                  Payments
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {filingsTab === 'filings' ? (
            gstLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <SalesTaxFilings
                rows={filingRows}
                formatCurrency={formatCurrency}
                isReadOnly={isReadOnly}
                onPrepareReturn={(row) => openQbReport('summary', row)}
                onViewSummary={(row) => openQbReport('summary', row)}
                onViewDetail={(row) => openQbReport('detail', row)}
                onUndoFiling={async (row) => {
                  if (!organization?.id || row.isSynthetic) return;
                  await updateTaxReturn.mutateAsync({
                    id: row.id,
                    organizationId: organization.id,
                    updates: { status: 'draft', filed_at: null },
                  });
                }}
              />
            )
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Record GST/HST and PST remittances from{' '}
              <Link to="/treasury/tax-payments" className="text-[#2CA01C] underline">
                Tax payments
              </Link>
              .
            </Card>
          )}
        </>
      )}

      {salesTaxView === 'summary' && (
        gstLoading ? <Skeleton className="h-96" /> : (
          <GstHstSummaryReport
            organizationName={organization?.legal_name || organization?.name}
            snapshot={snapshot}
            formatCurrency={formatCurrency}
          />
        )
      )}

      {salesTaxView === 'detail' && (
        gstLoading ? <Skeleton className="h-96" /> : (
          <GstHstDetailReport
            organizationName={organization?.legal_name || organization?.name}
            snapshot={snapshot}
            formatCurrency={formatCurrency}
          />
        )
      )}

      {salesTaxView === 'advanced' && (
        <TaxReportPreview
          organizationId={organization?.id}
          organizationName={organization?.name}
          countryCode={countryCode}
          taxTerminology={taxTerminology}
          formatCurrency={formatCurrency}
        />
      )}

      <Dialog open={showManageCodes} onOpenChange={setShowManageCodes}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage sales tax</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

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
