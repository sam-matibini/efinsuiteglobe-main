import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, User, Loader2 } from 'lucide-react';
import { useCustomers, CreateCustomerInput } from '@/hooks/useCustomers';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import { cn } from '@/lib/utils';

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CustomerType = 'organization' | 'individual';

const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

const COUNTRIES = [
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'United States' },
];

const initialFormState = {
  customerType: 'organization' as CustomerType,
  organizationName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'CA',
  taxNumber: '',
  defaultCurrency: '',
  notes: '',
};

export function AddCustomerDialog({ open, onOpenChange }: AddCustomerDialogProps) {
  const [formData, setFormData] = useState(initialFormState);
  const { createCustomer } = useCustomers();

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getDisplayName = (): string => {
    if (formData.customerType === 'organization') {
      return formData.organizationName.trim();
    }
    const first = formData.firstName.trim();
    const last = formData.lastName.trim();
    return [first, last].filter(Boolean).join(' ');
  };

  const isValid = (): boolean => {
    if (formData.customerType === 'organization') {
      return formData.organizationName.trim().length > 0;
    }
    return formData.firstName.trim().length > 0 && formData.lastName.trim().length > 0;
  };

  const handleSubmit = async () => {
    if (!isValid()) return;

    const input: CreateCustomerInput = {
      name: getDisplayName(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      address_line1: formData.addressLine1.trim() || undefined,
      address_line2: formData.addressLine2.trim() || undefined,
      city: formData.city.trim() || undefined,
      province: formData.province || undefined,
      postal_code: formData.postalCode.trim() || undefined,
      country: formData.country || undefined,
      tax_number: formData.taxNumber.trim() || undefined,
      default_currency: formData.defaultCurrency || undefined,
      notes: formData.notes.trim() || undefined,
    };

    try {
      await createCustomer.mutateAsync(input);
      handleClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setFormData(initialFormState);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Customer Type Selection */}
          <div className="space-y-3">
            <Label>Customer Type</Label>
            <RadioGroup
              value={formData.customerType}
              onValueChange={(value) => handleChange('customerType', value)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="type-organization"
                className={cn(
                  "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                  formData.customerType === 'organization'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value="organization" id="type-organization" />
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Organization</span>
              </Label>
              <Label
                htmlFor="type-individual"
                className={cn(
                  "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                  formData.customerType === 'individual'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value="individual" id="type-individual" />
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Individual</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Name Fields */}
          {formData.customerType === 'organization' ? (
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name *</Label>
              <Input
                id="organizationName"
                placeholder="Enter organization name"
                value={formData.organizationName}
                onChange={(e) => handleChange('organizationName', e.target.value)}
                maxLength={100}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  maxLength={50}
                />
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 555-5555"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Street Address</Label>
              <Input
                id="addressLine1"
                placeholder="Street address"
                value={formData.addressLine1}
                onChange={(e) => handleChange('addressLine1', e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                placeholder="Apartment, suite, unit, etc. (optional)"
                value={formData.addressLine2}
                onChange={(e) => handleChange('addressLine2', e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  placeholder="A1A 1A1"
                  value={formData.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="province">Province / State</Label>
                <Select
                  value={formData.province}
                  onValueChange={(value) => handleChange('province', value)}
                >
                  <SelectTrigger id="province">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((province) => (
                      <SelectItem key={province.value} value={province.value}>
                        {province.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => handleChange('country', value)}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tax Number & Default Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxNumber">Tax Number (Optional)</Label>
              <Input
                id="taxNumber"
                placeholder="Business / GST number"
                value={formData.taxNumber}
                onChange={(e) => handleChange('taxNumber', e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <CurrencySelect
                id="defaultCurrency"
                value={formData.defaultCurrency}
                onChange={(v) => handleChange('defaultCurrency', v)}
                placeholder="Auto"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this customer..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid() || createCustomer.isPending}
            className="bg-accent hover:bg-accent/90"
          >
            {createCustomer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
