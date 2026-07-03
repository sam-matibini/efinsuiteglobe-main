import { useState, useEffect } from 'react';
import { Loader2, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Contact, CreateContactInput } from '@/hooks/useContacts';

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingContact: Contact | null;
  onSubmit: (data: CreateContactInput, isEdit: boolean) => Promise<void>;
}

const initialFormData: CreateContactInput = {
  name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  cell_phone: '',
  landline: '',
  company: '',
  address_line1: '',
  address_line2: '',
  city: '',
  province: '',
  postal_code: '',
  country: '',
  notes: '',
  is_favorite: false,
};

export function ContactFormDialog({
  open,
  onOpenChange,
  editingContact,
  onSubmit,
}: ContactFormDialogProps) {
  const [formData, setFormData] = useState<CreateContactInput>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingContact) {
      setFormData({
        name: editingContact.name,
        first_name: editingContact.first_name || '',
        last_name: editingContact.last_name || '',
        email: editingContact.email || '',
        phone: editingContact.phone || '',
        cell_phone: editingContact.cell_phone || '',
        landline: editingContact.landline || '',
        company: editingContact.company || '',
        address_line1: editingContact.address_line1 || '',
        address_line2: editingContact.address_line2 || '',
        city: editingContact.city || '',
        province: editingContact.province || '',
        postal_code: editingContact.postal_code || '',
        country: editingContact.country || '',
        notes: editingContact.notes || '',
        is_favorite: editingContact.is_favorite,
      });
    } else {
      setFormData(initialFormData);
    }
  }, [editingContact, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      await onSubmit(formData, !!editingContact);
      onOpenChange(false);
      setFormData(initialFormData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData(initialFormData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[85vh] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-accent" />
            {editingContact ? 'Edit Contact' : 'Add New Contact'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-6 py-2">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    placeholder="First name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    placeholder="Last name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input
                  placeholder="Full display name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  placeholder="Company name"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cell Phone</Label>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={formData.cell_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, cell_phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Landline</Label>
                  <Input
                    placeholder="+1 (555) 987-6543"
                    value={formData.landline}
                    onChange={(e) => setFormData(prev => ({ ...prev, landline: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Address
              </h3>
              
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input
                  placeholder="123 Main Street"
                  value={formData.address_line1}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line1: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Address Line 2</Label>
                <Input
                  placeholder="Apartment, suite, unit, etc."
                  value={formData.address_line2}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line2: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Province / State</Label>
                <Input
                  placeholder="Province or State"
                  value={formData.province}
                  onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>ZIP / Postal Code</Label>
                <Input
                  placeholder="Postal code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes & Preferences */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Additional Info
              </h3>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="favorite" className="cursor-pointer">Add to Favorites</Label>
                <Switch
                  id="favorite"
                  checked={formData.is_favorite}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_favorite: checked }))}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSaving || !formData.name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              editingContact ? 'Update Contact' : 'Add Contact'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
