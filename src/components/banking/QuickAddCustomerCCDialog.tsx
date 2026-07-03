import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuickAddCustomerCCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customerId: string, customerName: string) => void;
  initialName?: string;
}

export function QuickAddCustomerCCDialog({ 
  open, 
  onOpenChange, 
  onCustomerCreated,
  initialName = '',
}: QuickAddCustomerCCDialogProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('CA');
  
  const { createCustomer } = useCustomers();

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      const result = await createCustomer.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address_line1: addressLine1.trim() || undefined,
        address_line2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country: country.trim() || 'CA',
      });
      
      if (result) {
        onCustomerCreated(result.id, result.name);
        handleClose();
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setProvince('');
    setPostalCode('');
    setCountry('CA');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Quick Add Customer</DialogTitle>
          <DialogDescription>
            Add a new customer with contact and address information.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>

            {/* Contact Information */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="customer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Phone</Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
              <div className="space-y-2">
                <Label htmlFor="customer-addr1">Address Line 1</Label>
                <Input
                  id="customer-addr1"
                  placeholder="123 Main Street"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-addr2">Address Line 2</Label>
                <Input
                  id="customer-addr2"
                  placeholder="Suite 100"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-city">City</Label>
                  <Input
                    id="customer-city"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-province">Province/State</Label>
                  <Input
                    id="customer-province"
                    placeholder="ON"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-postal">Postal Code</Label>
                  <Input
                    id="customer-postal"
                    placeholder="A1B 2C3"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-country">Country</Label>
                  <Input
                    id="customer-country"
                    placeholder="CA"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createCustomer.isPending}
          >
            {createCustomer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
