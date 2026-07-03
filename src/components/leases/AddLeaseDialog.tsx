import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, differenceInMonths, isValid, parseISO } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { 
  FileText, 
  Building2, 
  Car, 
  Laptop, 
  Calendar,
  DollarSign,
  Calculator,
  Info,
  Table as TableIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { useCreateLease, useEditLease, calculatePresentValue, generateAmortizationSchedule, LeaseInput, Lease } from '@/hooks/useLeases';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization, COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';

interface AddLeaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLease?: Lease | null;
}

export function AddLeaseDialog({ open, onOpenChange, editLease }: AddLeaseDialogProps) {
  const createLease = useCreateLease();
  const editLeaseMutation = useEditLease();
  const isEditMode = !!editLease;
  const { organization } = useCurrentOrganization();
  
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

  // Get localized labels
  const labels = useMemo(() => {
    switch (countryCode) {
      case 'BI':
        return {
          title: isEditMode ? 'Modifier le Bail' : 'Ajouter un Nouveau Bail',
          description: isEditMode 
            ? 'Modifier les conditions du bail et recalculer automatiquement l\'échéancier'
            : 'Créer un bail conforme OHADA / IFRS 16 avec calcul automatique des actifs DU et passifs',
          basicInfo: 'Informations de Base',
          leaseNumber: 'Numéro de Bail',
          leaseName: 'Nom du Bail',
          lessorName: 'Nom du Bailleur',
          lessorContact: 'Contact du Bailleur',
          leaseType: 'Type de Bail',
          assetType: 'Type d\'Actif',
          leaseTerms: 'Conditions du Bail',
          commencementDate: 'Date de Début',
          endDate: 'Date de Fin',
          termMonths: 'Durée (Mois)',
          paymentDetails: 'Détails de Paiement',
          paymentAmount: 'Montant du Paiement',
          frequency: 'Fréquence',
          paymentTiming: 'Moment du Paiement',
          firstPaymentDate: 'Date du Premier Paiement',
          discountRate: 'Taux d\'Actualisation (%)',
          additionalComponents: 'Composantes Additionnelles',
          initialDirectCosts: 'Coûts Directs Initiaux',
          leaseIncentives: 'Incitatifs de Bail Reçus',
          residualValue: 'Garantie de Valeur Résiduelle',
          glMapping: 'Correspondance GL',
          previewSchedule: 'Aperçu de l\'Échéancier',
          hidePreview: 'Masquer l\'Aperçu',
          cancel: 'Annuler',
           creating: isEditMode ? 'Enregistrement...' : 'Création...',
           createLease: isEditMode ? 'Enregistrer' : 'Créer le Bail',
          calculatedValues: 'Valeurs Calculées',
          presentValue: 'Valeur Actuelle',
          rouAsset: 'Actif DU',
          leaseLiability: 'Passif de Location',
          financeLeaseType: 'Bail Financier',
          operatingLeaseType: 'Bail Opérationnel (IFRS 16)',
          shortTermLeaseType: 'Court Terme (≤12 mois)',
          lowValueLeaseType: 'Actif de Faible Valeur',
          realEstate: 'Immobilier',
          vehicle: 'Véhicule',
          equipment: 'Équipement',
          other: 'Autre',
           monthly: 'Mensuel',
           biWeekly: 'Bihebdomadaire',
           quarterly: 'Trimestriel',
           annually: 'Annuel',
          endOfPeriod: 'Fin de Période',
          beginningOfPeriod: 'Début de Période',
        };
      default:
        return {
          title: isEditMode ? 'Edit Lease' : 'Add New Lease',
          description: isEditMode 
            ? 'Update lease terms and automatically recalculate amortization schedule'
            : `Create an ${countryCode === 'US' ? 'ASC 842' : 'IFRS 16 / ASPE 3065'} compliant lease with automatic ROU asset and liability calculation`,
          basicInfo: 'Basic Information',
          leaseNumber: 'Lease Number',
          leaseName: 'Lease Name',
          lessorName: 'Lessor Name',
          lessorContact: 'Lessor Contact',
          leaseType: 'Lease Type',
          assetType: 'Asset Type',
          leaseTerms: 'Lease Terms',
          commencementDate: 'Commencement Date',
          endDate: 'End Date',
          termMonths: 'Term (Months)',
          paymentDetails: 'Payment Details',
          paymentAmount: 'Payment Amount',
          frequency: 'Frequency',
          paymentTiming: 'Payment Timing',
          firstPaymentDate: 'First Payment Date',
          discountRate: 'Discount Rate (%)',
          additionalComponents: 'Additional Components',
          initialDirectCosts: 'Initial Direct Costs',
          leaseIncentives: 'Lease Incentives Received',
          residualValue: 'Residual Value Guarantee',
          glMapping: 'GL Account Mapping (Optional)',
          previewSchedule: 'Preview Amortization Schedule',
          hidePreview: 'Hide Preview',
          cancel: 'Cancel',
           creating: isEditMode ? 'Saving...' : 'Creating...',
           createLease: isEditMode ? 'Save Changes' : 'Create Lease',
          calculatedValues: 'Calculated Values',
          presentValue: 'Present Value',
          rouAsset: 'ROU Asset',
          leaseLiability: 'Lease Liability',
          financeLeaseType: 'Finance Lease',
          operatingLeaseType: 'Operating Lease (IFRS 16)',
          shortTermLeaseType: 'Short-Term (≤12 months)',
          lowValueLeaseType: 'Low-Value Asset',
          realEstate: 'Real Estate',
          vehicle: 'Vehicle',
          equipment: 'Equipment',
          other: 'Other',
           monthly: 'Monthly',
           biWeekly: 'Bi-Weekly',
           quarterly: 'Quarterly',
           annually: 'Annually',
          endOfPeriod: 'End of Period',
          beginningOfPeriod: 'Beginning of Period',
        };
    }
  }, [countryCode]);
  
  const defaultFormData: LeaseInput = {
    lease_number: '',
    name: '',
    lessor_name: '',
    lessor_contact: '',
    lease_type: 'finance',
    asset_type: 'equipment',
    commencement_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addMonths(new Date(), 36), 'yyyy-MM-dd'),
    term_months: 36,
    payment_amount: 0,
    payment_frequency: 'monthly',
    payment_timing: 'end',
    first_payment_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
    discount_rate: 5,
    initial_direct_costs: 0,
    lease_incentives_received: 0,
    residual_value_guarantee: 0,
    grace_period_months: 0,
    notes: ''
  };

  const [formData, setFormData] = useState<LeaseInput>(defaultFormData);

  // Populate form when editing
  useEffect(() => {
    if (editLease && open) {
      setFormData({
        lease_number: editLease.lease_number,
        name: editLease.name,
        lessor_name: editLease.lessor_name,
        lessor_contact: editLease.lessor_contact || '',
        lease_type: editLease.lease_type,
        asset_type: editLease.asset_type,
        commencement_date: editLease.commencement_date,
        end_date: editLease.end_date,
        term_months: editLease.term_months,
        payment_amount: editLease.payment_amount,
        payment_frequency: editLease.payment_frequency,
        payment_timing: editLease.payment_timing,
        first_payment_date: editLease.first_payment_date,
        discount_rate: editLease.discount_rate,
        initial_direct_costs: editLease.initial_direct_costs || 0,
        lease_incentives_received: editLease.lease_incentives_received || 0,
        residual_value_guarantee: editLease.residual_value_guarantee || 0,
        grace_period_months: (editLease as any).grace_period_months || 0,
        rou_asset_account_id: editLease.rou_asset_account_id || undefined,
        lease_liability_account_id: editLease.lease_liability_account_id || undefined,
        interest_expense_account_id: editLease.interest_expense_account_id || undefined,
        depreciation_expense_account_id: editLease.depreciation_expense_account_id || undefined,
        accumulated_depreciation_account_id: editLease.accumulated_depreciation_account_id || undefined,
        notes: editLease.notes || ''
      });
    } else if (!editLease && open) {
      setFormData(defaultFormData);
    }
  }, [editLease, open]);

  // Calculate derived values
  const [presentValue, setPresentValue] = useState(0);
  const [rouAsset, setRouAsset] = useState(0);
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);

  useEffect(() => {
    // Keep derived values in sync and prevent stale values from causing downstream crashes.
    // Allow 0% discount rate (calculatePresentValue already handles it).
    const canCalculate =
      formData.payment_amount > 0 &&
      formData.term_months > 0 &&
      formData.discount_rate >= 0;

    if (!canCalculate) {
      setPresentValue(0);
      setRouAsset(0);
      return;
    }

    const pv = calculatePresentValue(
      formData.payment_amount,
      formData.term_months,
      formData.discount_rate,
      formData.payment_frequency,
      formData.payment_timing
    );
    setPresentValue(pv);
    setRouAsset(pv + (formData.initial_direct_costs || 0) - (formData.lease_incentives_received || 0));
  }, [formData.payment_amount, formData.term_months, formData.discount_rate, formData.payment_frequency, formData.payment_timing, formData.initial_direct_costs, formData.lease_incentives_received]);

  // Generate amortization schedule preview
  const schedulePreview = useMemo(() => {
    try {
      if (!(presentValue > 0 && rouAsset > 0 && formData.payment_amount > 0)) return [];

      // Guard against cleared/invalid date inputs (date-fns will throw and can blank the page).
      const firstPayment = parseISO(formData.first_payment_date);
      if (!isValid(firstPayment)) return [];

      return generateAmortizationSchedule(
        presentValue,
        rouAsset,
        formData.payment_amount,
        formData.term_months,
        formData.discount_rate,
        formData.payment_frequency,
        formData.first_payment_date
      );
    } catch {
      return [];
    }
  }, [presentValue, rouAsset, formData.payment_amount, formData.term_months, formData.discount_rate, formData.payment_frequency, formData.first_payment_date]);

  // Auto-calculate term when dates change
  useEffect(() => {
    if (formData.commencement_date && formData.end_date) {
      const months = differenceInMonths(parseLocalDate(formData.end_date), parseLocalDate(formData.commencement_date));
      if (months > 0 && months !== formData.term_months) {
        setFormData(prev => ({ ...prev, term_months: months }));
      }
    }
  }, [formData.commencement_date, formData.end_date]);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat(countryCode === 'BI' ? 'fr-BI' : `en-${countryCode}`, { 
      style: 'currency', 
      currency: countryLocalization.currency 
    }).format(amount);

  const handleSubmit = async () => {
    if (isEditMode && editLease) {
      await editLeaseMutation.mutateAsync({ id: editLease.id, input: formData });
    } else {
      await createLease.mutateAsync(formData);
    }
    onOpenChange(false);
    setFormData(defaultFormData);
  };

  const isPending = isEditMode ? editLeaseMutation.isPending : createLease.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>
            {labels.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {labels.basicInfo}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{labels.leaseNumber} *</Label>
                <Input 
                  placeholder="LS-001"
                  value={formData.lease_number}
                  onChange={e => setFormData(prev => ({ ...prev, lease_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.leaseName} *</Label>
                <Input 
                  placeholder={countryCode === 'BI' ? 'Bail Bureau' : 'Office Space Lease'}
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{labels.lessorName} *</Label>
                <Input 
                  placeholder={countryCode === 'BI' ? 'ABC Immobilier SARL' : 'ABC Properties Ltd.'}
                  value={formData.lessor_name}
                  onChange={e => setFormData(prev => ({ ...prev, lessor_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.lessorContact}</Label>
                <Input 
                  placeholder="contact@lessor.com"
                  value={formData.lessor_contact || ''}
                  onChange={e => setFormData(prev => ({ ...prev, lessor_contact: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{labels.leaseType} *</Label>
                <Select 
                  value={formData.lease_type} 
                  onValueChange={v => setFormData(prev => ({ ...prev, lease_type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finance">{labels.financeLeaseType}</SelectItem>
                    <SelectItem value="operating">{labels.operatingLeaseType}</SelectItem>
                    <SelectItem value="short_term">{labels.shortTermLeaseType}</SelectItem>
                    <SelectItem value="low_value">{labels.lowValueLeaseType}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{labels.assetType} *</Label>
                <Select 
                  value={formData.asset_type} 
                  onValueChange={v => setFormData(prev => ({ ...prev, asset_type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real_estate">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {labels.realEstate}
                      </div>
                    </SelectItem>
                    <SelectItem value="vehicle">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        {labels.vehicle}
                      </div>
                    </SelectItem>
                    <SelectItem value="equipment">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4" />
                        {labels.equipment}
                      </div>
                    </SelectItem>
                    <SelectItem value="other">{labels.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Lease Terms */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {labels.leaseTerms}
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{labels.commencementDate} *</Label>
                <Input 
                  type="date"
                  value={formData.commencement_date}
                  onChange={e => setFormData(prev => ({ ...prev, commencement_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.endDate} *</Label>
                <Input 
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.termMonths}</Label>
                <Input 
                  type="number"
                  value={formData.term_months}
                  onChange={e => setFormData(prev => ({ ...prev, term_months: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {labels.paymentDetails}
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{labels.paymentAmount} *</Label>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.payment_amount || ''}
                  onChange={e => setFormData(prev => ({ ...prev, payment_amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.frequency} *</Label>
                <Select 
                  value={formData.payment_frequency} 
                  onValueChange={v => setFormData(prev => ({ ...prev, payment_frequency: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="monthly">{labels.monthly}</SelectItem>
                     <SelectItem value="bi_weekly">{labels.biWeekly}</SelectItem>
                     <SelectItem value="quarterly">{labels.quarterly}</SelectItem>
                     <SelectItem value="annually">{labels.annually}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{labels.paymentTiming}</Label>
                <Select 
                  value={formData.payment_timing} 
                  onValueChange={v => setFormData(prev => ({ ...prev, payment_timing: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end">{labels.endOfPeriod}</SelectItem>
                    <SelectItem value="beginning">{labels.beginningOfPeriod}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{labels.firstPaymentDate} *</Label>
                <Input 
                  type="date"
                  value={formData.first_payment_date}
                  onChange={e => setFormData(prev => ({ ...prev, first_payment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {labels.discountRate} *
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{countryCode === 'BI' 
                        ? 'Utilisez le taux implicite du bail ou votre taux d\'emprunt marginal'
                        : 'Use the interest rate implicit in the lease, or your incremental borrowing rate'}</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="5.00"
                  value={formData.discount_rate || ''}
                  onChange={e => setFormData(prev => ({ ...prev, discount_rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {countryCode === 'BI' ? 'Période de Grâce (Mois)' : 'Grace Period (Months)'}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{countryCode === 'BI' 
                        ? 'Nombre de mois sans paiement au début du bail'
                        : 'Number of months at the start where no payments are due'}</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.grace_period_months || ''}
                  onChange={e => setFormData(prev => ({ ...prev, grace_period_months: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Additional Costs */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              {labels.additionalComponents}
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{labels.initialDirectCosts}</Label>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.initial_direct_costs || ''}
                  onChange={e => setFormData(prev => ({ ...prev, initial_direct_costs: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.leaseIncentives}</Label>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.lease_incentives_received || ''}
                  onChange={e => setFormData(prev => ({ ...prev, lease_incentives_received: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.residualValue}</Label>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.residual_value_guarantee || ''}
                  onChange={e => setFormData(prev => ({ ...prev, residual_value_guarantee: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* GL Account Mapping */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              {labels.glMapping}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ROU Asset Account</Label>
                <SearchableGLAccountSelect
                  value={formData.rou_asset_account_id || ''}
                  onValueChange={(id) => setFormData(prev => ({ ...prev, rou_asset_account_id: id || undefined }))}
                  placeholder="Select account..."
                />
              </div>
              <div className="space-y-2">
                <Label>Lease Liability Account</Label>
                <SearchableGLAccountSelect
                  value={formData.lease_liability_account_id || ''}
                  onValueChange={(id) => setFormData(prev => ({ ...prev, lease_liability_account_id: id || undefined }))}
                  placeholder="Select account..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Interest Expense Account</Label>
                <SearchableGLAccountSelect
                  value={formData.interest_expense_account_id || ''}
                  onValueChange={(id) => setFormData(prev => ({ ...prev, interest_expense_account_id: id || undefined }))}
                  placeholder="Select account..."
                />
              </div>
              <div className="space-y-2">
                <Label>Depreciation Expense Account</Label>
                <SearchableGLAccountSelect
                  value={formData.depreciation_expense_account_id || ''}
                  onValueChange={(id) => setFormData(prev => ({ ...prev, depreciation_expense_account_id: id || undefined }))}
                  placeholder="Select account..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Accumulated Depreciation Account</Label>
              <SearchableGLAccountSelect
                value={formData.accumulated_depreciation_account_id || ''}
                onValueChange={(id) => setFormData(prev => ({ ...prev, accumulated_depreciation_account_id: id || undefined }))}
                placeholder="Select account..."
              />
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label>{countryCode === 'BI' ? 'Notes' : 'Notes'}</Label>
            <Textarea 
              placeholder={countryCode === 'BI' ? 'Notes supplémentaires sur ce bail...' : 'Additional notes about this lease...'}
              value={formData.notes || ''}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Calculated Values Preview */}
          {formData.payment_amount > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-sm mb-3">
                  {labels.calculatedValues} ({countryCode === 'BI' ? 'Aperçu' : 'Preview'})
                </h4>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.presentValue}</p>
                    <p className="text-lg font-bold">{formatCurrency(presentValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {countryCode === 'BI' ? 'Actif DU Initial' : 'Initial ROU Asset'}
                    </p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(rouAsset)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {countryCode === 'BI' ? 'Passif de Location Initial' : 'Initial Lease Liability'}
                    </p>
                    <p className="text-lg font-bold text-orange-600">{formatCurrency(presentValue)}</p>
                  </div>
                </div>

                {/* Amortization Schedule Preview */}
                {schedulePreview.length > 0 && (
                  <Collapsible open={showSchedulePreview} onOpenChange={setShowSchedulePreview}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full gap-2 justify-between">
                        <span className="flex items-center gap-2">
                          <TableIcon className="w-4 h-4" />
                          {countryCode === 'BI' 
                            ? `Aperçu Échéancier d'Amortissement (${schedulePreview.length} paiements)`
                            : `Amortization Schedule Preview (${schedulePreview.length} payments)`}
                        </span>
                        {showSchedulePreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-background/50">
                              <TableHead className="w-12 text-xs">#</TableHead>
                              <TableHead className="text-xs">Date</TableHead>
                              <TableHead className="text-right text-xs">
                                {countryCode === 'BI' ? 'Paiement' : 'Payment'}
                              </TableHead>
                              <TableHead className="text-right text-xs">
                                {countryCode === 'BI' ? 'Intérêts' : 'Interest'}
                              </TableHead>
                              <TableHead className="text-right text-xs">
                                {countryCode === 'BI' ? 'Principal' : 'Principal'}
                              </TableHead>
                              <TableHead className="text-right text-xs">
                                {countryCode === 'BI' ? 'Passif' : 'Liability'}
                              </TableHead>
                              <TableHead className="text-right text-xs">
                                {countryCode === 'BI' ? 'Actif DU' : 'ROU Asset'}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {schedulePreview.map((payment) => (
                              <TableRow key={payment.payment_number} className="text-xs">
                                <TableCell className="font-medium py-2">{payment.payment_number}</TableCell>
                                <TableCell className="py-2">{format(parseLocalDate(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                                <TableCell className="text-right py-2">{formatCurrency(payment.payment_amount)}</TableCell>
                                <TableCell className="text-right text-orange-600 py-2">{formatCurrency(payment.interest_amount)}</TableCell>
                                <TableCell className="text-right text-emerald-600 py-2">{formatCurrency(payment.principal_amount)}</TableCell>
                                <TableCell className="text-right py-2">{formatCurrency(payment.closing_liability)}</TableCell>
                                <TableCell className="text-right py-2">{formatCurrency(payment.rou_asset_closing)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-3 p-3 bg-background/50 rounded-lg text-xs">
                        <div>
                          <p className="text-muted-foreground">
                            {countryCode === 'BI' ? 'Total Paiements' : 'Total Payments'}
                          </p>
                          <p className="font-semibold">{formatCurrency(schedulePreview.reduce((s, p) => s + p.payment_amount, 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            {countryCode === 'BI' ? 'Total Intérêts' : 'Total Interest'}
                          </p>
                          <p className="font-semibold text-orange-600">{formatCurrency(schedulePreview.reduce((s, p) => s + p.interest_amount, 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            {countryCode === 'BI' ? 'Total Principal' : 'Total Principal'}
                          </p>
                          <p className="font-semibold text-emerald-600">{formatCurrency(schedulePreview.reduce((s, p) => s + p.principal_amount, 0))}</p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !formData.lease_number || !formData.name || !formData.lessor_name || formData.payment_amount <= 0}
          >
            {isPending ? labels.creating : labels.createLease}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
