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
import { Loader2, Building2, User } from 'lucide-react';
import { useVendors, CreateVendorInput } from '@/hooks/useVendors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuickAddVendorCCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorCreated: (vendorId: string, vendorName: string) => void;
  initialName?: string;
}

export function QuickAddVendorCCDialog({ 
  open, 
  onOpenChange, 
  onVendorCreated,
  initialName = '',
}: QuickAddVendorCCDialogProps) {
  const [vendorType, setVendorType] = useState<'organization' | 'individual'>('organization');
  const [name, setName] = useState(initialName);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('CA');
  
  const { createVendor } = useVendors();

  const handleSubmit = async () => {
    const vendorName = vendorType === 'individual' 
      ? `${firstName} ${lastName}`.trim() 
      : name.trim();
    
    if (!vendorName) return;

    try {
      const input: CreateVendorInput = {
        name: vendorName,
        vendor_type: vendorType,
        first_name: vendorType === 'individual' ? firstName : undefined,
        last_name: vendorType === 'individual' ? lastName : undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address_line1: addressLine1.trim() || undefined,
        address_line2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country: country.trim() || 'CA',
      };
      
      const result = await createVendor.mutateAsync(input);
      
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
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setProvince('');
    setPostalCode('');
    setCountry('CA');
    setVendorType('organization');
    onOpenChange(false);
  };

  const isValid = vendorType === 'individual' 
    ? firstName.trim() && lastName.trim()
    : name.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Quick Add Vendor</DialogTitle>
          <DialogDescription>
            Add a new vendor with contact and address information.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            <Tabs value={vendorType} onValueChange={(v) => setVendorType(v as 'organization' | 'individual')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="organization" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Organization
                </TabsTrigger>
                <TabsTrigger value="individual" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Individual
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="organization" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor-name">Business Name *</Label>
                  <Input
                    id="vendor-name"
                    placeholder="Enter business name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    autoFocus
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="individual" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-first">First Name *</Label>
                    <Input
                      id="vendor-first"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-last">Last Name *</Label>
                    <Input
                      id="vendor-last"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Contact Information */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
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
                <Label htmlFor="vendor-addr1">Address Line 1</Label>
                <Input
                  id="vendor-addr1"
                  placeholder="123 Main Street"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-addr2">Address Line 2</Label>
                <Input
                  id="vendor-addr2"
                  placeholder="Suite 100"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  maxLength={100}
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
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-province">Province/State</Label>
                  <Input
                    id="vendor-province"
                    placeholder="ON"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor-postal">Postal Code</Label>
                  <Input
                    id="vendor-postal"
                    placeholder="A1B 2C3"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-country">Country</Label>
                  <Input
                    id="vendor-country"
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
            disabled={!isValid || createVendor.isPending}
          >
            {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
