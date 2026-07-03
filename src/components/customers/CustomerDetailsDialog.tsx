import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MapPin, FileText, Building2 } from 'lucide-react';
import { Customer } from '@/hooks/useCustomers';

interface CustomerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export function CustomerDetailsDialog({ open, onOpenChange, customer }: CustomerDetailsDialogProps) {
  if (!customer) return null;

  const addressParts = [
    customer.address_line1,
    customer.address_line2,
    [customer.city, customer.province].filter(Boolean).join(', '),
    customer.postal_code,
    customer.country,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-lg font-semibold text-accent">
                {customer.name.charAt(0)}
              </span>
            </div>
            <div>
              <span>{customer.name}</span>
              <div className="mt-1">
                <Badge variant={customer.is_active ? 'outline' : 'secondary'}>
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {!customer.email && !customer.phone && (
              <p className="text-sm text-muted-foreground italic">No contact info</p>
            )}
          </div>

          {/* Address */}
          {addressParts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{addressParts.join(', ')}</span>
              </div>
            </div>
          )}

          {/* Tax */}
          {customer.tax_number && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Tax Number</h4>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{customer.tax_number}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          {customer.notes && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
              <div className="flex items-start gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className="whitespace-pre-wrap">{customer.notes}</span>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
            <p>Created: {new Date(customer.created_at).toLocaleDateString()}</p>
            <p>Updated: {new Date(customer.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
