import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreateOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Upload, X, Loader2, Sparkles, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

const orgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  industry: z.string().min(1, 'Please select an industry'),
  country_id: z.string().min(1, 'Please select a country'),
  bvn_or_nin: z.string().optional(),
});

type OrgFormValues = z.infer<typeof orgSchema>;

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const industries = [
  { value: 'accounting', label: 'Accounting & Bookkeeping' },
  { value: 'advertising', label: 'Advertising & Marketing' },
  { value: 'aerospace', label: 'Aerospace & Defense' },
  { value: 'agriculture', label: 'Agriculture & Farming' },
  { value: 'arts_entertainment', label: 'Arts & Entertainment' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'automotive_repairs', label: 'Automotive Repairs & Services' },
  { value: 'banking', label: 'Banking & Credit Unions' },
  { value: 'biotech', label: 'Biotechnology' },
  { value: 'car_dealers', label: 'Car Dealers' },
  { value: 'charity', label: 'Charity & Non-Profit' },
  { value: 'chemicals', label: 'Chemicals & Plastics' },
  { value: 'construction', label: 'Construction & Contracting' },
  { value: 'consulting', label: 'Consulting & Advisory' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'education', label: 'Education & Training' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'environmental', label: 'Environmental Services' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'hospitality', label: 'Hospitality & Tourism' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'it_services', label: 'IT Services & Consulting' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'media', label: 'Media & Publishing' },
  { value: 'mining', label: 'Mining & Extraction' },
  { value: 'npo', label: 'Non-Profit Organization' },
  { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'real_estate', label: 'Real Estate & Property' },
  { value: 'religious', label: 'Religious Organizations' },
  { value: 'retail', label: 'Retail' },
  { value: 'saas', label: 'Software as a Service (SaaS)' },
  { value: 'sports', label: 'Sports & Recreation' },
  { value: 'technology', label: 'Technology & Software' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'textiles', label: 'Textiles & Apparel' },
  { value: 'transportation_logistics', label: 'Transportation & Logistics' },
  { value: 'venture_capital', label: 'Venture Capital & Private Equity' },
  { value: 'wholesale', label: 'Wholesale & Distribution' },
  { value: 'other', label: 'Other' },
];

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const createOrg = useCreateOrganization();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [runningAiSetup, setRunningAiSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch available countries
  const { data: countries = [] } = useQuery({
    queryKey: ['countries-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('id, code, name, default_currency, accounting_standard')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
  
  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      industry: 'professional_services',
      country_id: '',
    },
  });

  const selectedCountry = countries.find(c => c.id === form.watch('country_id'));

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const runAiJurisdictionSetup = async (organizationId: string) => {
    setRunningAiSetup(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-jurisdiction-setup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ organization_id: organizationId }),
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('AI has configured your compliance settings', {
          description: `Detected: ${result.detection?.country || 'Unknown'} - Tax & payroll rules applied`,
        });
      } else if (result.error) {
        console.warn('AI setup warning:', result.error);
      }
    } catch (error) {
      console.error('AI setup error:', error);
      // Non-blocking - org is still created
    } finally {
      setRunningAiSetup(false);
    }
  };

  const onSubmit = async (values: OrgFormValues) => {
    if (!values.name || !values.country_id) return;
    
    setUploading(true);
    
    try {
      // Get country info for defaults
      const country = countries.find(c => c.id === values.country_id);
      
      // Create organization with country - pass country name/code for address-based compliance
      const org = await createOrg.mutateAsync({ 
        name: values.name,
        industry: values.industry,
        country_id: values.country_id,
        currency: country?.default_currency || 'USD',
        country_name: country?.name,
        country_code: country?.code,
      });
      
      // Upload logo if selected
      if (logoFile && org) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${org.id}/logo-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('organization-logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) {
          console.error('Logo upload error:', uploadError);
          toast.error('Organization created, but logo upload failed');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('organization-logos')
            .getPublicUrl(fileName);

          await supabase
            .from('organizations')
            .update({ logo_url: publicUrl })
            .eq('id', org.id);
        }
      }

      // Run AI jurisdiction setup in background
      if (org) {
        runAiJurisdictionSetup(org.id);
      }
      
      // Reset form
      form.reset();
      setLogoFile(null);
      setLogoPreview(null);
      onOpenChange(false);
    } catch (error) {
      // Error already handled by mutation
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setLogoFile(null);
      setLogoPreview(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Set up your organization with automatic compliance configuration.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Organization Logo</label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage src={logoPreview || undefined} alt="Logo preview" />
                  <AvatarFallback className="bg-muted">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {logoPreview ? 'Change' : 'Upload'}
                    </Button>
                    {logoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLogo}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Square image, max 2MB (PNG, JPG)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Country / Jurisdiction
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          <div className="flex items-center gap-2">
                            <span>{country.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {country.code}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Determines tax rules, payroll deductions, and compliance requirements
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCountry && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Auto-configured settings
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency:</span>
                    <span className="font-medium">{selectedCountry.default_currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard:</span>
                    <span className="font-medium">{selectedCountry.accounting_standard || 'GAAP'}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI will configure tax types, payroll deductions, and COA templates after creation.
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry.value} value={industry.value}>
                          {industry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createOrg.isPending || uploading || runningAiSetup}>
                {createOrg.isPending || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : runningAiSetup ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                    Configuring...
                  </>
                ) : (
                  'Create Organization'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
