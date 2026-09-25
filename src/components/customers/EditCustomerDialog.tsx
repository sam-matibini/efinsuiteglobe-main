import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { CurrencySelect } from '@/components/currency/CurrencySelect';

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

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

export function EditCustomerDialog({ open, onOpenChange, customer }: EditCustomerDialogProps) {
  const { updateCustomer } = useCustomers();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'CA',
    tax_number: '',
    default_currency: '',
    notes: '',
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address_line1: customer.address_line1 || '',
        address_line2: customer.address_line2 || '',
        city: customer.city || '',
        province: customer.province || '',
        postal_code: customer.postal_code || '',
        country: customer.country || 'CA',
        tax_number: customer.tax_number || '',
        default_currency: customer.default_currency || '',
        notes: customer.notes || '',
      });
    }
  }, [customer]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!customer || !formData.name.trim()) return;

    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address_line1: formData.address_line1.trim() || null,
        address_line2: formData.address_line2.trim() || null,
        city: formData.city.trim() || null,
        province: formData.province || null,
        postal_code: formData.postal_code.trim() || null,
        country: formData.country || null,
        tax_number: formData.tax_number.trim() || null,
        default_currency: formData.default_currency || null,
        notes: formData.notes.trim() || null,
      });
      onOpenChange(false);
    } catch {
      // handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address1">Street Address</Label>
            <Input
              id="edit-address1"
              value={formData.address_line1}
              onChange={(e) => handleChange('address_line1', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address2">Address Line 2</Label>
            <Input
              id="edit-address2"
              value={formData.address_line2}
              onChange={(e) => handleChange('address_line2', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-postal">Postal Code</Label>
              <Input
                id="edit-postal"
                value={formData.postal_code}
                onChange={(e) => handleChange('postal_code', e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-province">Province / State</Label>
              <Select value={formData.province} onValueChange={(v) => handleChange('province', v)}>
                <SelectTrigger id="edit-province">
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">Country</Label>
              <Select value={formData.country} onValueChange={(v) => handleChange('country', v)}>
                <SelectTrigger id="edit-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tax">Tax Number</Label>
              <Input
                id="edit-tax"
                value={formData.tax_number}
                onChange={(e) => handleChange('tax_number', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currency">Default Currency</Label>
              <CurrencySelect
                id="edit-currency"
                value={formData.default_currency}
                onChange={(v) => handleChange('default_currency', v)}
                placeholder="Auto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name.trim() || updateCustomer.isPending}
            className="bg-accent hover:bg-accent/90"
          >
            {updateCustomer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
