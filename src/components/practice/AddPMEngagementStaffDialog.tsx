import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { 
  useCreatePMEngagementStaff, 
  PM_STAFF_ROLES,
  PMStaffRole,
} from '@/hooks/usePMEngagementStaff';
import { PMEngagement } from '@/types/practiceManagement';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

const formSchema = z.object({
  engagement_id: z.string().min(1, 'Please select an engagement'),
  staff_name: z.string().min(1, 'Name is required'),
  staff_email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.enum(['partner', 'manager', 'senior', 'staff', 'intern', 'contractor'] as const),
  billing_rate: z.number().min(0).optional(),
  budgeted_hours: z.number().min(0).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddPMEngagementStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagements: PMEngagement[];
  defaultEngagementId?: string;
}

export function AddPMEngagementStaffDialog({
  open,
  onOpenChange,
  engagements,
  defaultEngagementId,
}: AddPMEngagementStaffDialogProps) {
  const { currentOrganization } = useOrganizationContext();
  const createStaff = useCreatePMEngagementStaff();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      engagement_id: defaultEngagementId || '',
      staff_name: '',
      staff_email: '',
      role: 'staff' as PMStaffRole,
      billing_rate: undefined,
      budgeted_hours: undefined,
      start_date: '',
      end_date: '',
      notes: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    await createStaff.mutateAsync({
      engagement_id: data.engagement_id,
      staff_name: data.staff_name,
      staff_email: data.staff_email || null,
      role: data.role,
      billing_rate: data.billing_rate || null,
      budgeted_hours: data.budgeted_hours || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      notes: data.notes || null,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="engagement_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Engagement *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select engagement" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {engagements.map(eng => (
                        <SelectItem key={eng.id} value={eng.id}>
                          {eng.engagement_number} - {eng.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="staff_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PM_STAFF_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="staff_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="billing_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Rate ($/hr)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="150"
                        {...field}
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budgeted_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budgeted Hours</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="40"
                        {...field}
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this assignment..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createStaff.isPending}>
                {createStaff.isPending ? 'Adding...' : 'Add Team Member'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
