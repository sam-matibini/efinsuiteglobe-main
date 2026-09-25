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
import { useCreatePMTask } from '@/hooks/usePracticeManagement';
import { PMEngagement } from '@/types/practiceManagement';

const formSchema = z.object({
  engagement_id: z.string().min(1, 'Engagement is required'),
  name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimated_hours: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddPMTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagements: PMEngagement[];
}

export function AddPMTaskDialog({ open, onOpenChange, engagements }: AddPMTaskDialogProps) {
  const createTask = useCreatePMTask();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      engagement_id: '',
      name: '',
      description: '',
      due_date: '',
      priority: 'medium',
      estimated_hours: undefined,
      notes: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    await createTask.mutateAsync(data as Required<Pick<typeof data, 'engagement_id' | 'name' | 'priority'>> & typeof data);
    form.reset();
    onOpenChange(false);
  };

  const activeEngagements = engagements.filter(e => e.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to an engagement.
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

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Prepare T2 return" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="estimated_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Hours</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.5" placeholder="2.0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Task details..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
