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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useVendors } from '@/hooks/useVendors';

interface QuickAddVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorCreated: (vendorId: string, vendorName: string) => void;
}

export function QuickAddVendorDialog({ 
  open, 
  onOpenChange, 
  onVendorCreated 
}: QuickAddVendorDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const { createVendor } = useVendors();

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      const result = await createVendor.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address_line1: addressLine1.trim() || undefined,
        address_line2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country: country.trim() || undefined,
      });
      
      if (result) {
        onVendorCreated(result.id, result.name);
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
    setCountry('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Quick Add Vendor</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name *</Label>
              <Input
                id="vendor-name"
                placeholder="Enter vendor name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="vendor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-address1">Address Line 1</Label>
              <Input
                id="vendor-address1"
                placeholder="Street address"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-address2">Address Line 2</Label>
              <Input
                id="vendor-address2"
                placeholder="Apartment, suite, unit, etc."
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                maxLength={255}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-city">City</Label>
                <Input
                  id="vendor-city"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-province">Province/State</Label>
                <Input
                  id="vendor-province"
                  placeholder="Province or State"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-postal">Postal/ZIP Code</Label>
                <Input
                  id="vendor-postal"
                  placeholder="Postal code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-country">Country</Label>
                <Input
                  id="vendor-country"
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createVendor.isPending}
          >
            {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
