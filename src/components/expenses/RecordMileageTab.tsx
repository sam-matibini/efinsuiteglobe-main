import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Car, MapPin, Tag, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { QuickAddVendorDialog } from '@/components/journal/QuickAddVendorDialog';
import { useExpenses, CreateMileageInput } from '@/hooks/useExpenses';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useVendors } from '@/hooks/useVendors';
import { useCustomers } from '@/hooks/useCustomers';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';

interface RecordMileageTabProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// CRA 2024 mileage rates (per km)
const MILEAGE_RATES = {
  first5000: 0.70, // First 5,000 km
  after5000: 0.64, // After 5,000 km
};

export function RecordMileageTab({ onSuccess, onCancel }: RecordMileageTabProps) {
  const { organization } = useCurrentOrganization();
  const { createMileage } = useExpenses();
  const { vendors } = useVendors();
  const { customers } = useCustomers();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  // Quick Add Vendor dialog state
  const [showAddVendorDialog, setShowAddVendorDialog] = useState(false);

  // Form state
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [distance, setDistance] = useState<number>(0);
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [ratePerUnit, setRatePerUnit] = useState<number>(MILEAGE_RATES.first5000);
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState<string>('');
  const [paidThroughAccountId, setPaidThroughAccountId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isBillable, setIsBillable] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate total amount
  const totalAmount = useMemo(() => {
    return distance * ratePerUnit;
  }, [distance, ratePerUnit]);

  const resetForm = () => {
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setFromLocation('');
    setToLocation('');
    setDistance(0);
    setDistanceUnit('km');
    setRatePerUnit(MILEAGE_RATES.first5000);
    setVehicleDescription('');
    setExpenseAccountId('');
    setPaidThroughAccountId('');
    setVendorId('');
    setCustomerId('');
    setReference('');
    setNotes('');
    setIsBillable(false);
  };

  const handleSave = async () => {
    const input: CreateMileageInput = {
      expense_date: expenseDate,
      from_location: fromLocation,
      to_location: toLocation,
      distance,
      distance_unit: distanceUnit,
      rate_per_unit: ratePerUnit,
      vehicle_description: vehicleDescription || undefined,
      expense_account_id: expenseAccountId || undefined,
      paid_through_account_id: paidThroughAccountId || undefined,
      vendor_id: vendorId || undefined,
      customer_id: customerId || undefined,
      reference: reference || undefined,
      notes: notes || undefined,
      is_billable: isBillable,
    };

    await createMileage.mutateAsync(input);
    resetForm();
    onSuccess();
  };

  const handleSaveAndNew = async () => {
    await handleSave();
    resetForm();
  };

  const isValid = fromLocation && toLocation && distance > 0 && ratePerUnit > 0;

  return (
    <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
      <div className="space-y-5 pb-20">
        {/* Header info */}
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Car className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium">Mileage Tracking</p>
            <p className="text-sm text-muted-foreground">
              CRA 2024 rates: {formatCurrency(MILEAGE_RATES.first5000)}/km (first 5,000 km), 
              {formatCurrency(MILEAGE_RATES.after5000)}/km (after)
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-primary font-medium">Date*</Label>
          <Input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* From Location */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-primary font-medium">From*</Label>
          <div className="flex gap-2 max-w-md">
            <Input
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              placeholder="Starting location"
              className="flex-1"
            />
            <Button variant="outline" size="icon" className="shrink-0">
              <MapPin className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* To Location */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-primary font-medium">To*</Label>
          <div className="flex gap-2 max-w-md">
            <Input
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              placeholder="Destination"
              className="flex-1"
            />
            <Button variant="outline" size="icon" className="shrink-0">
              <MapPin className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Distance */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-primary font-medium">Distance*</Label>
          <div className="flex items-center gap-2 max-w-xs">
            <FormattedNumberInput
              value={distance}
              onChange={setDistance}
              placeholder="0"
              className="flex-1"
            />
            <Select value={distanceUnit} onValueChange={setDistanceUnit}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="km">km</SelectItem>
                <SelectItem value="mi">miles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rate per unit */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-primary font-medium">Rate*</Label>
          <div className="flex items-center gap-2 max-w-xs">
            <span className="text-muted-foreground">$</span>
            <FormattedNumberInput
              value={ratePerUnit}
              onChange={setRatePerUnit}
              placeholder="0.00"
              className="flex-1"
            />
            <span className="text-muted-foreground">per {distanceUnit}</span>
          </div>
        </div>

        {/* Total Amount (calculated) */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Total Amount</Label>
          <div className="text-lg font-bold text-primary">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        {/* Vehicle Description */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Vehicle</Label>
          <Input
            value={vehicleDescription}
            onChange={(e) => setVehicleDescription(e.target.value)}
            placeholder="e.g., 2023 Honda Civic"
            className="max-w-md"
          />
        </div>

        <Separator />

        {/* Expense Account */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Expense Account</Label>
          <SearchableGLAccountSelect
            value={expenseAccountId}
            onValueChange={setExpenseAccountId}
            placeholder="Select an account"
            filterPostable={true}
            className="max-w-md"
          />
        </div>

        {/* Paid Through - Linked to Chart of Accounts */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Paid Through</Label>
          <SearchableGLAccountSelect
            value={paidThroughAccountId}
            onValueChange={setPaidThroughAccountId}
            placeholder="Select cash/bank/credit card account"
            filterPostable={true}
            className="max-w-md"
          />
        </div>

        {/* Vendor */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Vendor</Label>
          <div className="flex gap-2 max-w-md">
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              className="shrink-0"
              onClick={() => setShowAddVendorDialog(true)}
              title="Add New Vendor"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Reference */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Reference#</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder=""
            className="max-w-md"
          />
        </div>

        {/* Notes */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-4">
          <Label className="text-muted-foreground pt-2">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Purpose of trip, client visited, etc."
            maxLength={500}
            rows={3}
            className="max-w-md"
          />
        </div>

        <Separator />

        {/* Customer */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Customer Name</Label>
          <div className="flex gap-2 max-w-md">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select or add a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="shrink-0">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Billable toggle */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Billable</Label>
          <div className="flex items-center gap-2">
            <Switch checked={isBillable} onCheckedChange={setIsBillable} />
            <span className="text-sm text-muted-foreground">{isBillable ? 'Yes' : 'No'}</span>
          </div>
        </div>

        {/* Reporting Tags */}
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <Label className="text-muted-foreground">Reporting Tags</Label>
          <button type="button" className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Tag className="w-4 h-4" />
            Associate Tags
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4 flex gap-3">
        <Button 
          onClick={handleSave}
          disabled={!isValid || createMileage.isPending}
          className="bg-primary"
        >
          Save (Alt+S)
        </Button>
        <Button 
          variant="outline"
          onClick={handleSaveAndNew}
          disabled={!isValid || createMileage.isPending}
        >
          Save and New (Alt+N)
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Quick Add Vendor Dialog */}
      <QuickAddVendorDialog
        open={showAddVendorDialog}
        onOpenChange={setShowAddVendorDialog}
        onVendorCreated={(vendorId) => setVendorId(vendorId)}
      />
    </ScrollArea>
  );
}
