import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { 
  FileText, 
  Plus, 
  Building2, 
  Car, 
  Laptop, 
  MoreHorizontal,
  DollarSign,
  TrendingDown,
  Eye,
  Trash2,
  Edit,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeases, useLeasePaymentSchedule, usePostLeaseCommencement, useLeaseLiabilityCurrentPortion, Lease, LeasePaymentSchedule } from '@/hooks/useLeases';
import { AddLeaseDialog } from '@/components/leases/AddLeaseDialog';
import { RunLeaseAmortizationDialog } from '@/components/leases/RunLeaseAmortizationDialog';
import { RepairLeaseGLDialog } from '@/components/leases/RepairLeaseGLDialog';
import { toast } from 'sonner';

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization, COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

// WhatsApp icon component (lucide doesn't have official WhatsApp icon)
const WhatsAppIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function Leases() {
  const { data: leases = [], isLoading, refetch } = useLeases();
  const { data: liabilityParts = [] } = useLeaseLiabilityCurrentPortion();
  const { organization } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [runAmortizationOpen, setRunAmortizationOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const postCommencement = usePostLeaseCommencement();
  const [repairLease, setRepairLease] = useState<Lease | null>(null);


  // Determine country code from organization
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

  // Get localized lease terminology
  const leaseTerminology = useMemo(() => {
    switch (countryCode) {
      case 'CA':
        return {
          standard: 'IFRS 16 / ASPE 3065',
          rouAsset: 'ROU Assets',
          leaseLiability: 'Lease Liabilities',
          addLease: 'Add Lease',
          viewSchedule: 'View Schedule',
          editLease: 'Edit Lease',
          delete: 'Delete',
          noLeases: 'No leases yet',
          noLeasesDesc: 'Add your first lease to start tracking ROU assets and liabilities',
          leaseAgreements: 'Lease Agreements',
          leaseAgreementsDesc: 'Manage your organization\'s lease portfolio with full GL integration',
          term: 'Term',
          months: 'months',
          payment: 'Payment',
          status: 'Status',
          lessor: 'Lessor',
          active: 'Active',
          draft: 'Draft',
          terminated: 'Terminated',
          expired: 'Expired',
          monthlyPayments: 'Monthly Payments',
          activeLeases: 'Active Leases',
        };
      case 'US':
        return {
          standard: 'ASC 842',
          rouAsset: 'ROU Assets',
          leaseLiability: 'Lease Liabilities',
          addLease: 'Add Lease',
          viewSchedule: 'View Schedule',
          editLease: 'Edit Lease',
          delete: 'Delete',
          noLeases: 'No leases yet',
          noLeasesDesc: 'Add your first lease to start tracking ROU assets and liabilities',
          leaseAgreements: 'Lease Agreements',
          leaseAgreementsDesc: 'Manage your organization\'s lease portfolio with full GL integration',
          term: 'Term',
          months: 'months',
          payment: 'Payment',
          status: 'Status',
          lessor: 'Lessor',
          active: 'Active',
          draft: 'Draft',
          terminated: 'Terminated',
          expired: 'Expired',
          monthlyPayments: 'Monthly Payments',
          activeLeases: 'Active Leases',
        };
      case 'BI':
        return {
          standard: 'OHADA / IFRS 16',
          rouAsset: 'Actifs DU',
          leaseLiability: 'Passifs de Location',
          addLease: 'Ajouter Bail',
          viewSchedule: 'Voir Échéancier',
          editLease: 'Modifier',
          delete: 'Supprimer',
          noLeases: 'Aucun bail',
          noLeasesDesc: 'Ajoutez votre premier bail pour commencer le suivi des actifs DU et passifs',
          leaseAgreements: 'Contrats de Location',
          leaseAgreementsDesc: 'Gérer le portefeuille de baux avec intégration GL complète',
          term: 'Durée',
          months: 'mois',
          payment: 'Paiement',
          status: 'Statut',
          lessor: 'Bailleur',
          active: 'Actif',
          draft: 'Brouillon',
          terminated: 'Résilié',
          expired: 'Expiré',
          monthlyPayments: 'Paiements Mensuels',
          activeLeases: 'Baux Actifs',
        };
      default:
        return {
          standard: 'IFRS 16',
          rouAsset: 'ROU Assets',
          leaseLiability: 'Lease Liabilities',
          addLease: 'Add Lease',
          viewSchedule: 'View Schedule',
          editLease: 'Edit Lease',
          delete: 'Delete',
          noLeases: 'No leases yet',
          noLeasesDesc: 'Add your first lease to start tracking ROU assets and liabilities',
          leaseAgreements: 'Lease Agreements',
          leaseAgreementsDesc: 'Manage your organization\'s lease portfolio with full GL integration',
          term: 'Term',
          months: 'months',
          payment: 'Payment',
          status: 'Status',
          lessor: 'Lessor',
          active: 'Active',
          draft: 'Draft',
          terminated: 'Terminated',
          expired: 'Expired',
          monthlyPayments: 'Monthly Payments',
          activeLeases: 'Active Leases',
        };
    }
  }, [countryCode]);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat(countryCode === 'BI' ? 'fr-BI' : `en-${countryCode}`, { 
      style: 'currency', 
      currency: countryLocalization.currency 
    }).format(amount);

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'real_estate': return Building2;
      case 'vehicle': return Car;
      case 'equipment': return Laptop;
      default: return FileText;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: typeof CheckCircle2 }> = {
      active: { variant: 'default', icon: CheckCircle2 },
      draft: { variant: 'secondary', icon: Clock },
      modified: { variant: 'secondary', icon: Edit },
      terminated: { variant: 'destructive', icon: AlertTriangle },
      expired: { variant: 'secondary', icon: Clock }
    };
    const { variant, icon: Icon } = variants[status] || variants.draft;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getLeaseTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      finance: 'bg-primary/10 text-primary',
      operating: 'bg-blue-500/10 text-blue-500',
      short_term: 'bg-orange-500/10 text-orange-500',
      low_value: 'bg-muted text-muted-foreground'
    };
    return (
      <Badge className={colors[type] || colors.finance}>
        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  // Summary calculations
  const totalROUAssets = leases.reduce((sum, l) => sum + (l.rou_asset_current || 0), 0);
  const totalLeaseLiabilities = leases.reduce((sum, l) => sum + (l.lease_liability_current || 0), 0);
  const activeLeases = leases.filter(l => l.status === 'active').length;
  const totalMonthlyPayments = leases
    .filter(l => l.status === 'active')
    .reduce((sum, l) => {
      const multiplier = l.payment_frequency === 'monthly' ? 1 : l.payment_frequency === 'bi_weekly' ? 12/26 : l.payment_frequency === 'quarterly' ? 1/3 : 1/12;
      return sum + (l.payment_amount * multiplier);
    }, 0);

  const handleExportSchedule = (lease: Lease, schedule: LeasePaymentSchedule[]) => {
    const data = schedule.map(p => ({
      'Payment #': p.payment_number,
      'Date': p.payment_date,
      'Payment': p.payment_amount,
      'Interest': p.interest_amount,
      'Principal': p.principal_amount,
      'Opening Liability': p.opening_liability,
      'Closing Liability': p.closing_liability,
      'Depreciation': p.depreciation_amount,
      'ROU Asset': p.rou_asset_closing,
      'Status': p.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Amortization');
    XLSX.writeFile(wb, `Lease_Schedule_${lease.lease_number}.xlsx`);
    toast.success('Schedule exported');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {countryCode === 'BI' ? 'Gestion des Baux' : 'Lease Management'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {leaseTerminology.standard} {countryCode === 'BI' ? 'comptabilité des baux conforme' : 'compliant lease accounting'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={() => setRunAmortizationOpen(true)} className="gap-2">
                <Play className="w-4 h-4" />
                Run Amortization
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                {leaseTerminology.addLease}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{leaseTerminology.rouAsset}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalROUAssets)}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{leaseTerminology.leaseLiability}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalLeaseLiabilities)}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <TrendingDown className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{leaseTerminology.activeLeases}</p>
                <p className="text-2xl font-bold">{activeLeases}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{leaseTerminology.monthlyPayments}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalMonthlyPayments)}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leases Table */}
      <Card>
        <CardHeader>
          <CardTitle>{leaseTerminology.leaseAgreements}</CardTitle>
          <CardDescription>
            {leaseTerminology.leaseAgreementsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">{leaseTerminology.noLeases}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {leaseTerminology.noLeasesDesc}
              </p>
              {!isReadOnly && (
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {leaseTerminology.addLease}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{countryCode === 'BI' ? 'Bail' : 'Lease'}</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>{leaseTerminology.lessor}</TableHead>
                  <TableHead>{leaseTerminology.term}</TableHead>
                  <TableHead className="text-right">{leaseTerminology.payment}</TableHead>
                  <TableHead className="text-right">{leaseTerminology.rouAsset}</TableHead>
                  <TableHead className="text-right">{countryCode === 'BI' ? 'Passif' : 'Liability'}</TableHead>
                  <TableHead className="text-right">Current / Long-term</TableHead>
                  <TableHead>{leaseTerminology.status}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>

              </TableHeader>
              <TableBody>
                {leases.map(lease => {
                  const AssetIcon = getAssetIcon(lease.asset_type);
                  return (
                    <TableRow key={lease.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <AssetIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{lease.name}</p>
                            <p className="text-xs text-muted-foreground">{lease.lease_number}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getLeaseTypeBadge(lease.lease_type)}</TableCell>
                      <TableCell>{lease.lessor_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{lease.term_months} {leaseTerminology.months}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseLocalDate(lease.commencement_date), 'MMM yyyy')} - {format(parseLocalDate(lease.end_date), 'MMM yyyy')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <p>{formatCurrency(lease.payment_amount)}</p>
                          <p className="text-xs text-muted-foreground">{lease.payment_frequency}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lease.rou_asset_current)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lease.lease_liability_current)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const part = liabilityParts.find(p => p.lease_id === lease.id);
                          if (!part) {
                            if (lease.lease_type === 'short_term' || lease.lease_type === 'low_value') {
                              return <span className="text-xs text-muted-foreground">Expensed — n/a</span>;
                            }
                            return <span className="text-xs text-muted-foreground">—</span>;
                          }
                          return (
                            <div className="text-xs leading-tight">
                              <div><span className="text-muted-foreground">Current:</span> <span className="font-mono">{formatCurrency(part.current_portion)}</span></div>
                              <div><span className="text-muted-foreground">Long-term:</span> <span className="font-mono">{formatCurrency(part.long_term_portion)}</span></div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{getStatusBadge(lease.status)}</TableCell>
                      <TableCell>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              className="gap-2"
                              onClick={() => {
                                setSelectedLease(lease);
                                setScheduleDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              {leaseTerminology.viewSchedule}
                            </DropdownMenuItem>
                            {!isReadOnly && (
                              <DropdownMenuItem 
                                className="gap-2"
                                onClick={() => {
                                  setEditingLease(lease);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                                {leaseTerminology.editLease}
                              </DropdownMenuItem>
                            )}
                            {!isReadOnly && !lease.commencement_journal_id && (
                              <DropdownMenuItem
                                className="gap-2"
                                disabled={postCommencement.isPending}
                                onClick={() => postCommencement.mutate(lease)}
                              >
                                <BookOpen className="w-4 h-4" />
                                Post Commencement to GL
                              </DropdownMenuItem>
                            )}
                            {!isReadOnly && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => setRunAmortizationOpen(true)}
                              >
                                <Play className="w-4 h-4" />
                                Post Payments to GL
                              </DropdownMenuItem>
                            )}
                            {!isReadOnly && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => setRepairLease(lease)}
                              >
                                <RefreshCw className="w-4 h-4" />
                                Repair GL…
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />

                            <DropdownMenuItem className="gap-2 text-destructive">
                              <Trash2 className="w-4 h-4" />
                              {leaseTerminology.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Lease Dialog */}
      <AddLeaseDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Edit Lease Dialog */}
      <AddLeaseDialog 
        open={!!editingLease} 
        onOpenChange={(open) => { if (!open) setEditingLease(null); }}
        editLease={editingLease}
      />

      {/* Run Amortization Dialog */}
      <RunLeaseAmortizationDialog 
        open={runAmortizationOpen} 
        onOpenChange={setRunAmortizationOpen} 
      />

      {/* Repair GL Dialog */}
      <RepairLeaseGLDialog
        lease={repairLease}
        open={!!repairLease}
        onOpenChange={(open) => { if (!open) setRepairLease(null); }}
      />



      {/* Payment Schedule Dialog */}
      {selectedLease && (
        <LeaseScheduleDialog 
          lease={selectedLease}
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          onExport={handleExportSchedule}
        />
      )}
    </div>
  );
}

// Payment Schedule Dialog Component
function LeaseScheduleDialog({ 
  lease, 
  open, 
  onOpenChange,
  onExport 
}: { 
  lease: Lease; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onExport: (lease: Lease, schedule: LeasePaymentSchedule[]) => void;
}) {
  const { data: schedule = [], isLoading } = useLeasePaymentSchedule(lease.id);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

  // Calculate totals
  const totals = useMemo(() => ({
    payments: schedule.reduce((s, p) => s + p.payment_amount, 0),
    interest: schedule.reduce((s, p) => s + p.interest_amount, 0),
    principal: schedule.reduce((s, p) => s + p.principal_amount, 0),
    depreciation: schedule.reduce((s, p) => s + p.depreciation_amount, 0),
  }), [schedule]);

  // Generate PDF
  const handlePrintPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text(`Amortization Schedule - ${lease.name}`, 14, 20);
    
    // Subtitle
    doc.setFontSize(10);
    doc.text(`Lease #${lease.lease_number} • ${lease.term_months} months • ${lease.discount_rate}% discount rate`, 14, 28);
    
    // Table headers
    const headers = ['#', 'Date', 'Payment', 'Interest', 'Principal', 'Liability', 'Depreciation', 'ROU Asset', 'Status'];
    const colWidths = [10, 24, 24, 22, 22, 26, 26, 24, 18];
    let y = 40;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let x = 14;
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    
    // Table data
    doc.setFont('helvetica', 'normal');
    y += 6;
    
    schedule.forEach((payment) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      
      x = 14;
      const row = [
        payment.payment_number.toString(),
        format(parseLocalDate(payment.payment_date), 'MMM d, yyyy'),
        formatCurrency(payment.payment_amount),
        formatCurrency(payment.interest_amount),
        formatCurrency(payment.principal_amount),
        formatCurrency(payment.closing_liability),
        formatCurrency(payment.depreciation_amount),
        formatCurrency(payment.rou_asset_closing),
        payment.status
      ];
      
      row.forEach((cell, i) => {
        doc.text(cell, x, y);
        x += colWidths[i];
      });
      y += 5;
    });
    
    // Summary
    y += 10;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Payments: ${formatCurrency(totals.payments)}`, 14, y);
    doc.text(`Total Interest: ${formatCurrency(totals.interest)}`, 70, y);
    y += 5;
    doc.text(`Total Principal: ${formatCurrency(totals.principal)}`, 14, y);
    doc.text(`Total Depreciation: ${formatCurrency(totals.depreciation)}`, 70, y);
    
    // Footer
    doc.setFontSize(8);
    doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 290);
    
    // Save or print
    doc.save(`Amortization_Schedule_${lease.lease_number}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  // Generate share text
  const getShareText = () => {
    return `Amortization Schedule - ${lease.name}\n` +
      `Lease #${lease.lease_number} • ${lease.term_months} months • ${lease.discount_rate}% discount rate\n\n` +
      `Summary:\n` +
      `• Total Payments: ${formatCurrency(totals.payments)}\n` +
      `• Total Interest: ${formatCurrency(totals.interest)}\n` +
      `• Total Principal: ${formatCurrency(totals.principal)}\n` +
      `• Total Depreciation: ${formatCurrency(totals.depreciation)}\n\n` +
      `Generated on ${format(new Date(), 'MMM d, yyyy')}`;
  };

  // Share via Email
  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Amortization Schedule - ${lease.name} (Lease #${lease.lease_number})`);
    const body = encodeURIComponent(getShareText());
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast.success('Opening email client...');
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`whatsapp://send?text=${text}`, '_blank');
    toast.success('Opening WhatsApp...');
  };

  // Share via SMS
  const handleShareSMS = () => {
    const text = encodeURIComponent(getShareText());
    // Use sms: protocol which works on both iOS and Android
    window.open(`sms:?body=${text}`, '_blank');
    toast.success('Opening messaging app...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Amortization Schedule - {lease.name}</DialogTitle>
          <DialogDescription>
            Lease #{lease.lease_number} • {lease.term_months} months • {lease.discount_rate}% discount rate
          </DialogDescription>
        </DialogHeader>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-end gap-2 mb-4">
          {/* Print/PDF */}
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handlePrintPDF}
            disabled={isLoading || schedule.length === 0}
          >
            <Printer className="w-4 h-4" />
            Print/PDF
          </Button>

          {/* Share dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || schedule.length === 0}>
                <Mail className="w-4 h-4" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleShareEmail}>
                <Mail className="w-4 h-4 mr-2" />
                Share via Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareWhatsApp}>
                <WhatsAppIcon />
                <span className="ml-2">Share via WhatsApp</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareSMS}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Share via SMS/MMS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export to Excel */}
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => onExport(lease, schedule)}
            disabled={isLoading || schedule.length === 0}
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="border rounded-lg overflow-hidden print:border-none" id="schedule-table">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Liability</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead className="text-right">ROU Asset</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.payment_number}</TableCell>
                    <TableCell>{format(parseLocalDate(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.payment_amount)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCurrency(payment.interest_amount)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(payment.principal_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.closing_liability)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(payment.depreciation_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.rou_asset_closing)}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Total Payments</p>
            <p className="font-semibold">{formatCurrency(totals.payments)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Interest</p>
            <p className="font-semibold text-orange-600">{formatCurrency(totals.interest)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Principal</p>
            <p className="font-semibold text-emerald-600">{formatCurrency(totals.principal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Depreciation</p>
            <p className="font-semibold">{formatCurrency(totals.depreciation)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
