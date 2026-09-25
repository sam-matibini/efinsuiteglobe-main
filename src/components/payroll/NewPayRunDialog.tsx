import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { useCurrentOrganization } from '@/hooks/useOrganization';

const payRunSchema = z.object({
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  payDate: z.string().min(1, 'Pay date is required'),
  payFrequency: z.enum(['weekly', 'bi_weekly', 'semi_monthly', 'monthly']),
});

type PayRunFormData = z.infer<typeof payRunSchema>;

interface NewPayRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewPayRunDialog({ open, onOpenChange, onSuccess }: NewPayRunDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { organization } = useCurrentOrganization();

  // Calculate default dates based on current date
  const getDefaultDates = (frequency: string) => {
    const today = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    let payDate: Date;

    switch (frequency) {
      case 'weekly':
        // Start of current week (Monday)
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        periodStart = addDays(today, mondayOffset);
        periodEnd = addDays(periodStart, 6);
        payDate = addDays(periodEnd, 5); // Friday after period ends
        break;
      case 'bi_weekly':
        // Two week period
        periodStart = addDays(today, -today.getDay() + 1 - 7);
        periodEnd = addDays(periodStart, 13);
        payDate = addDays(periodEnd, 5);
        break;
      case 'semi_monthly':
        // 1-15 or 16-end of month
        if (today.getDate() <= 15) {
          periodStart = startOfMonth(today);
          periodEnd = new Date(today.getFullYear(), today.getMonth(), 15);
        } else {
          periodStart = new Date(today.getFullYear(), today.getMonth(), 16);
          periodEnd = endOfMonth(today);
        }
        payDate = addDays(periodEnd, 5);
        break;
      case 'monthly':
      default:
        periodStart = startOfMonth(today);
        periodEnd = endOfMonth(today);
        payDate = addDays(periodEnd, 5);
        break;
    }

    return {
      periodStart: format(periodStart, 'yyyy-MM-dd'),
      periodEnd: format(periodEnd, 'yyyy-MM-dd'),
      payDate: format(payDate, 'yyyy-MM-dd'),
    };
  };

  const defaultDates = getDefaultDates('bi_weekly');

  const form = useForm<PayRunFormData>({
    resolver: zodResolver(payRunSchema),
    defaultValues: {
      periodStart: defaultDates.periodStart,
      periodEnd: defaultDates.periodEnd,
      payDate: defaultDates.payDate,
      payFrequency: 'bi_weekly',
    },
  });

  const handleFrequencyChange = (frequency: string) => {
    form.setValue('payFrequency', frequency as any);
    const dates = getDefaultDates(frequency);
    form.setValue('periodStart', dates.periodStart);
    form.setValue('periodEnd', dates.periodEnd);
    form.setValue('payDate', dates.payDate);
  };

  const onSubmit = async (data: PayRunFormData) => {
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Get active employee count for this organization
      const { count: employeeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'active');

      const { error } = await supabase.from('pay_runs').insert({
        organization_id: organization.id,
        pay_period_start: data.periodStart,
        pay_period_end: data.periodEnd,
        pay_date: data.payDate,
        status: 'draft',
        employee_count: employeeCount || 0,
        total_gross: 0,
        total_deductions: 0,
        total_net: 0,
        total_employer_contributions: 0,
      });

      if (error) throw error;

      toast.success('Pay run created successfully');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating pay run:', error);
      toast.error(error.message || 'Failed to create pay run');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Create New Pay Run
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Frequency</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={handleFrequencyChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period End</FormLabel>
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
              name="payDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Plus className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Pay Run'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
