import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePMEngagement } from '@/hooks/usePracticeManagement';
import { PMClient, PM_SERVICE_CATEGORIES } from '@/types/practiceManagement';

const formSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  name: z.string().min(1, 'Engagement name is required'),
  description: z.string().optional(),
  service_type: z.string().min(1, 'Service type is required'),
  fiscal_year: z.coerce.number().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  billing_type: z.enum(['fixed', 'hourly', 'retainer', 'hybrid']),
  fixed_fee: z.coerce.number().optional(),
  hourly_rate: z.coerce.number().optional(),
  budget_hours: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddPMEngagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: PMClient[];
}

export function AddPMEngagementDialog({ open, onOpenChange, clients }: AddPMEngagementDialogProps) {
  const createEngagement = useCreatePMEngagement();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: '',
      name: '',
      description: '',
      service_type: 'tax',
      fiscal_year: new Date().getFullYear(),
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      billing_type: 'hourly',
      fixed_fee: undefined,
      hourly_rate: 150,
      budget_hours: undefined,
      notes: '',
    },
  });

  const billingType = form.watch('billing_type');

  const onSubmit = async (data: FormData) => {
    await createEngagement.mutateAsync({
      client_id: data.client_id,
      name: data.name,
      service_type: data.service_type,
      start_date: data.start_date,
      billing_type: data.billing_type,
      description: data.description,
      fiscal_year: data.fiscal_year,
      end_date: data.end_date,
      fixed_fee: data.fixed_fee,
      hourly_rate: data.hourly_rate,
      budget_hours: data.budget_hours,
      notes: data.notes,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Engagement</DialogTitle>
          <DialogDescription>
            Set up a new service engagement with a client.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.legal_name}
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
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PM_SERVICE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
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
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Engagement Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="2024 Corporate Tax Filing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscal Year</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billing_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select billing" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="fixed">Fixed Fee</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {billingType === 'hourly' && (
                <>
                  <FormField
                    control={form.control}
                    name="hourly_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="budget_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Hours</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {billingType === 'fixed' && (
                <FormField
                  control={form.control}
                  name="fixed_fee"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Fixed Fee ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Scope of engagement..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Internal notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createEngagement.isPending}>
                {createEngagement.isPending ? 'Creating...' : 'Create Engagement'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
