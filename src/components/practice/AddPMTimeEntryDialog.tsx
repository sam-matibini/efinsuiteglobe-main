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
import { Checkbox } from '@/components/ui/checkbox';
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
import { useCreatePMTimeEntry } from '@/hooks/usePracticeManagement';
import { PMEngagement, PMTask } from '@/types/practiceManagement';

const formSchema = z.object({
  engagement_id: z.string().min(1, 'Engagement is required'),
  task_id: z.string().optional(),
  entry_date: z.string().min(1, 'Date is required'),
  hours: z.coerce.number().min(0.1, 'Hours must be at least 0.1'),
  description: z.string().optional(),
  is_billable: z.boolean(),
  billing_rate: z.coerce.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddPMTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagements: PMEngagement[];
  tasks: PMTask[];
}

export function AddPMTimeEntryDialog({ 
  open, 
  onOpenChange, 
  engagements, 
  tasks 
}: AddPMTimeEntryDialogProps) {
  const createTimeEntry = useCreatePMTimeEntry();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      engagement_id: '',
      task_id: '',
      entry_date: new Date().toISOString().split('T')[0],
      hours: 1,
      description: '',
      is_billable: true,
      billing_rate: 150,
    },
  });

  const selectedEngagementId = form.watch('engagement_id');
  const filteredTasks = tasks.filter(t => t.engagement_id === selectedEngagementId);

  const onSubmit = async (data: FormData) => {
    const payload = {
      engagement_id: data.engagement_id,
      entry_date: data.entry_date,
      hours: data.hours,
      description: data.description,
      is_billable: data.is_billable,
      billing_rate: data.billing_rate,
      task_id: data.task_id || undefined,
    };
    await createTimeEntry.mutateAsync(payload as Required<Pick<typeof payload, 'engagement_id' | 'entry_date' | 'hours' | 'is_billable'>> & typeof payload);
    form.reset();
    onOpenChange(false);
  };

  const activeEngagements = engagements.filter(e => e.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
          <DialogDescription>
            Record time worked on an engagement.
          </DialogDescription>
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
                      {activeEngagements.map((eng) => (
                        <SelectItem key={eng.id} value={eng.id}>
                          {eng.client?.legal_name} - {eng.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {filteredTasks.length > 0 && (
              <FormField
                control={form.control}
                name="task_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task (optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === 'none' ? '' : v)} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select task" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific task</SelectItem>
                        {filteredTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="entry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.25" min="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Work performed..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 items-end">
              <FormField
                control={form.control}
                name="is_billable"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Billable</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billing_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Rate ($/hr)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTimeEntry.isPending}>
                {createTimeEntry.isPending ? 'Saving...' : 'Save Time Entry'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
