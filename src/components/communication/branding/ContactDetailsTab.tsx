import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { CommunicationIdentity } from '@/hooks/useCommunicationIdentity';

interface ContactDetailsTabProps {
  identity: CommunicationIdentity | null;
  isSaving: boolean;
  onSave: (data: Partial<CommunicationIdentity>) => Promise<boolean>;
}

export function ContactDetailsTab({ identity, isSaving, onSave }: ContactDetailsTabProps) {
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    if (identity) {
      setAddressLine1(identity.address_line1 || '');
      setAddressLine2(identity.address_line2 || '');
      setCity(identity.city || '');
      setProvince(identity.province || '');
      setPostalCode(identity.postal_code || '');
      setCountry(identity.country || '');
      setPhone(identity.phone || '');
      setEmail(identity.email || '');
      setWebsite(identity.website || '');
    }
  }, [identity]);

  const handleSave = async () => {
    await onSave({
      address_line1: addressLine1 || undefined,
      address_line2: addressLine2 || undefined,
      city: city || undefined,
      province: province || undefined,
      postal_code: postalCode || undefined,
      country: country || undefined,
      phone: phone || undefined,
      email: email || undefined,
      website: website || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Address Section */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Business Address</Label>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="address1">Street Address</Label>
            <Input
              id="address1"
              placeholder="123 Business Street"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address2">Address Line 2</Label>
            <Input
              id="address2"
              placeholder="Suite 100"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Toronto"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Province / State</Label>
              <Input
                id="province"
                placeholder="Ontario"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postal">Postal / ZIP Code</Label>
              <Input
                id="postal"
                placeholder="M5V 1A1"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="Canada"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-base font-medium">Contact Information</Label>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telephone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="info@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://www.company.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {(addressLine1 || phone || email) && (
        <div className="pt-4 border-t">
          <Label className="text-base font-medium mb-4 block">Preview</Label>
          <div className="border rounded-lg p-6 bg-background">
            <div className="text-sm space-y-1">
              {addressLine1 && <div>{addressLine1}</div>}
              {addressLine2 && <div>{addressLine2}</div>}
              {(city || province || postalCode) && (
                <div>
                  {[city, province, postalCode].filter(Boolean).join(', ')}
                </div>
              )}
              {country && <div>{country}</div>}
              {phone && <div className="mt-2">📞 {phone}</div>}
              {email && <div>📧 {email}</div>}
              {website && <div>🌐 {website}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
