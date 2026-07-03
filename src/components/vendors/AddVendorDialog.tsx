import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, User, FileText, Loader2 } from 'lucide-react';
import { useVendors } from '@/hooks/useVendors';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import { cn } from '@/lib/utils';

const vendorSchema = z.object({
  vendor_type: z.enum(['organization', 'individual']),
  organization_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  address_line1: z.string().max(100).optional(),
  address_line2: z.string().max(100).optional(),
  city: z.string().max(50).optional(),
  province: z.string().optional(),
  postal_code: z.string().max(10).optional(),
  country: z.string().optional(),
  tax_number: z.string().max(30).optional(),
  payment_terms: z.coerce.number().min(0).optional(),
  is_contractor: z.boolean().optional(),
  t4a_required: z.boolean().optional(),
  sin_last_four: z.string().max(4).optional(),
  default_currency: z.string().optional(),
  notes: z.string().max(500).optional(),
}).refine((data) => {
  if (data.vendor_type === 'organization') {
    return !!data.organization_name?.trim();
  }
  return !!data.first_name?.trim() && !!data.last_name?.trim();
}, {
  message: 'Name is required',
  path: ['organization_name'],
});

type VendorFormData = z.infer<typeof vendorSchema>;

interface AddVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AddVendorDialog({ open, onOpenChange }: AddVendorDialogProps) {
  const { createVendor } = useVendors();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendor_type: 'organization',
      organization_name: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      province: '',
      postal_code: '',
      country: 'CA',
      tax_number: '',
      payment_terms: 30,
      is_contractor: false,
      t4a_required: false,
      sin_last_four: '',
      default_currency: '',
      notes: '',
    },
  });

  const vendorType = form.watch('vendor_type');
  const isContractor = form.watch('is_contractor');

  const getDisplayName = (data: VendorFormData): string => {
    if (data.vendor_type === 'organization') {
      return data.organization_name?.trim() || '';
    }
    return [data.first_name?.trim(), data.last_name?.trim()].filter(Boolean).join(' ');
  };

  const onSubmit = async (data: VendorFormData) => {
    setIsSubmitting(true);
    try {
      await createVendor.mutateAsync({
        name: getDisplayName(data),
        vendor_type: data.vendor_type,
        first_name: data.vendor_type === 'individual' ? data.first_name : undefined,
        last_name: data.vendor_type === 'individual' ? data.last_name : undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address_line1: data.address_line1 || undefined,
        address_line2: data.address_line2 || undefined,
        city: data.city || undefined,
        province: data.province || undefined,
        postal_code: data.postal_code || undefined,
        country: data.country || undefined,
        tax_number: data.tax_number || undefined,
        payment_terms: data.payment_terms,
        is_contractor: data.is_contractor,
        t4a_required: data.t4a_required,
        sin_last_four: data.sin_last_four || undefined,
        default_currency: data.default_currency || undefined,
        notes: data.notes || undefined,
      });
      form.reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Vendor / Contractor</DialogTitle>
          <DialogDescription>
            Add a new vendor or contractor to your organization.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Vendor Type Selection */}
            <FormField
              control={form.control}
              name="vendor_type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Vendor Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-2 gap-4"
                    >
                      <Label
                        htmlFor="vendor-organization"
                        className={cn(
                          "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                          field.value === 'organization'
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <RadioGroupItem value="organization" id="vendor-organization" />
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Organization</span>
                      </Label>
                      <Label
                        htmlFor="vendor-individual"
                        className={cn(
                          "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                          field.value === 'individual'
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <RadioGroupItem value="individual" id="vendor-individual" />
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Individual</span>
                      </Label>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Name Fields */}
            {vendorType === 'organization' ? (
              <FormField
                control={form.control}
                name="organization_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Company name" maxLength={100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="First name" maxLength={50} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Last name" maxLength={50} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} placeholder="vendor@example.com" maxLength={255} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 555-5555" maxLength={20} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Section */}
            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123 Main St" maxLength={100} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Suite, unit, etc. (optional)" maxLength={100} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Toronto" maxLength={50} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="M5V 1A1" 
                        maxLength={10}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province / State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVINCES.map((prov) => (
                          <SelectItem key={prov.value} value={prov.value}>
                            {prov.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'CA'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tax & Payment */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tax_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Number (HST/GST)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123456789RT0001" maxLength={30} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms (days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="30" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Default Currency */}
            <FormField
              control={form.control}
              name="default_currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Currency</FormLabel>
                  <FormControl>
                    <CurrencySelect
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Use organization base currency"
                    />
                  </FormControl>
                  <FormDescription>
                    Used to prefill bills and payments for this vendor.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* T4A Tracking Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Contractor / T4A Tracking</span>
              </div>

              <FormField
                control={form.control}
                name="is_contractor"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>This is a contractor</FormLabel>
                      <FormDescription>
                        Track payments for T4A slip generation
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {isContractor && (
                <>
                  <FormField
                    control={form.control}
                    name="t4a_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>T4A Required</FormLabel>
                          <FormDescription>
                            Issue a T4A slip at year-end (payments over $500)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sin_last_four"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIN Last 4 Digits (for verification)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="1234" 
                            maxLength={4}
                            pattern="[0-9]*"
                            inputMode="numeric"
                          />
                        </FormControl>
                        <FormDescription>
                          Used to verify identity when preparing T4A slips
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." rows={2} maxLength={500} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Vendor
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
