import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type {
  PMClient,
  PMClientInput,
  PMService,
  PMEngagement,
  PMEngagementInput,
  PMTask,
  PMTaskInput,
  PMTimeEntry,
  PMTimeEntryInput,
  PMInvoice,
  PMComplianceDeadline,
  PMAIInsight,
  PMDashboardKPIs,
  TimeEntryStatus,
} from '@/types/practiceManagement';

// ============ CLIENTS ============

export function usePMClients() {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-clients', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('pm_clients')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('legal_name');
      
      if (error) throw error;
      return data as PMClient[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function usePMClient(clientId: string | null) {
  return useQuery({
    queryKey: ['pm-client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('pm_clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return data as PMClient;
    },
    enabled: !!clientId,
  });
}

export function useCreatePMClient() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: PMClientInput) => {
      if (!currentOrganization?.id || !user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('pm_clients')
        .insert({
          ...input,
          organization_id: currentOrganization.id,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-clients'] });
      toast.success('Client created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create client: ${error.message}`);
    },
  });
}

export function useUpdatePMClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: PMClientInput & { id: string }) => {
      const { data, error } = await supabase
        .from('pm_clients')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-clients'] });
      toast.success('Client updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update client: ${error.message}`);
    },
  });
}

export function useDeletePMClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pm_clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-clients'] });
      toast.success('Client deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete client: ${error.message}`);
    },
  });
}

// ============ SERVICES ============

export function usePMServices() {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-services', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('pm_services')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as PMService[];
    },
    enabled: !!currentOrganization?.id,
  });
}

// ============ ENGAGEMENTS ============

export function usePMEngagements(clientId?: string) {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-engagements', currentOrganization?.id, clientId],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('pm_engagements')
        .select(`
          *,
          client:pm_clients(*),
          service:pm_services(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PMEngagement[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useCreatePMEngagement() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: PMEngagementInput) => {
      if (!currentOrganization?.id || !user?.id) throw new Error('Not authenticated');
      
      // Generate engagement number
      const { data: existing } = await supabase
        .from('pm_engagements')
        .select('engagement_number')
        .eq('organization_id', currentOrganization.id)
        .like('engagement_number', 'ENG-%')
        .order('engagement_number', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (existing && existing.length > 0) {
        const match = existing[0].engagement_number.match(/ENG-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      
      const { data, error } = await supabase
        .from('pm_engagements')
        .insert({
          ...input,
          organization_id: currentOrganization.id,
          engagement_number: `ENG-${String(nextNum).padStart(5, '0')}`,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-engagements'] });
      toast.success('Engagement created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create engagement: ${error.message}`);
    },
  });
}

export function useUpdatePMEngagement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PMEngagementInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('pm_engagements')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-engagements'] });
      toast.success('Engagement updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update engagement: ${error.message}`);
    },
  });
}

// ============ TASKS ============

export function usePMTasks(engagementId?: string, assignedTo?: string) {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-tasks', currentOrganization?.id, engagementId, assignedTo],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('pm_tasks')
        .select(`
          *,
          engagement:pm_engagements(*, client:pm_clients(*))
        `)
        .eq('organization_id', currentOrganization.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (engagementId) {
        query = query.eq('engagement_id', engagementId);
      }
      
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PMTask[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useCreatePMTask() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: PMTaskInput) => {
      if (!currentOrganization?.id || !user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('pm_tasks')
        .insert({
          ...input,
          organization_id: currentOrganization.id,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-tasks'] });
      toast.success('Task created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });
}

export function useUpdatePMTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PMTaskInput> & { id: string; status?: string }) => {
      const updateData: Record<string, unknown> = { ...input };
      
      // Auto-set completed fields
      if (input.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      }
      
      const { data, error } = await supabase
        .from('pm_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-tasks'] });
      toast.success('Task updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });
}

// ============ TIME ENTRIES ============

export function usePMTimeEntries(engagementId?: string, userId?: string, startDate?: string, endDate?: string) {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-time-entries', currentOrganization?.id, engagementId, userId, startDate, endDate],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('pm_time_entries')
        .select(`
          *,
          engagement:pm_engagements(*, client:pm_clients(*)),
          task:pm_tasks(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('entry_date', { ascending: false });
      
      if (engagementId) query = query.eq('engagement_id', engagementId);
      if (userId) query = query.eq('user_id', userId);
      if (startDate) query = query.gte('entry_date', startDate);
      if (endDate) query = query.lte('entry_date', endDate);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PMTimeEntry[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useCreatePMTimeEntry() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: PMTimeEntryInput) => {
      if (!currentOrganization?.id || !user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('pm_time_entries')
        .insert({
          ...input,
          organization_id: currentOrganization.id,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pm-dashboard-kpis'] });
      toast.success('Time entry recorded');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record time: ${error.message}`);
    },
  });
}

export function useUpdatePMTimeEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PMTimeEntryInput> & { id: string; status?: TimeEntryStatus }) => {
      const updateData: Record<string, unknown> = { ...input };
      
      const { data, error } = await supabase
        .from('pm_time_entries')
        .update(updateData as { status?: 'draft' | 'submitted' | 'approved' | 'billed' })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pm-dashboard-kpis'] });
      toast.success('Time entry updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update time entry: ${error.message}`);
    },
  });
}

// ============ INVOICES ============

export function usePMInvoices(clientId?: string, status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled') {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-invoices', currentOrganization?.id, clientId, status],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('pm_invoices')
        .select(`
          *,
          client:pm_clients(*),
          engagement:pm_engagements(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('invoice_date', { ascending: false });
      
      if (clientId) query = query.eq('client_id', clientId);
      if (status) query = query.eq('status', status);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PMInvoice[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function usePMInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: ['pm-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      
      const { data, error } = await supabase
        .from('pm_invoices')
        .select(`
          *,
          client:pm_clients(*),
          engagement:pm_engagements(*)
        `)
        .eq('id', invoiceId)
        .single();
      
      if (error) throw error;
      return data as PMInvoice;
    },
    enabled: !!invoiceId,
  });
}

export function usePMInvoiceLines(invoiceId: string | null) {
  return useQuery({
    queryKey: ['pm-invoice-lines', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from('pm_invoice_lines')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('line_order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId,
  });
}

export function useUnbilledTimeEntries(clientId?: string, engagementId?: string) {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-unbilled-time-entries', currentOrganization?.id, clientId, engagementId],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('pm_time_entries')
        .select(`
          *,
          engagement:pm_engagements(*, client:pm_clients(*)),
          task:pm_tasks(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_billable', true)
        .or('is_billed.is.null,is_billed.eq.false');
      
      if (engagementId) {
        query = query.eq('engagement_id', engagementId);
      } else if (clientId) {
        // Need to filter by client through engagement
        const { data: engagements } = await supabase
          .from('pm_engagements')
          .select('id')
          .eq('client_id', clientId);
        
        if (engagements && engagements.length > 0) {
          query = query.in('engagement_id', engagements.map(e => e.id));
        } else {
          return [];
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PMTimeEntry[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export interface PMInvoiceInput {
  client_id: string;
  engagement_id?: string;
  invoice_date: string;
  due_date: string;
  currency?: string;
  tax_rate?: number;
  notes?: string;
  terms?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  lines: {
    time_entry_id?: string;
    task_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_type: 'service' | 'time' | 'expense' | 'fixed_fee' | 'retainer' | 'adjustment';
  }[];
}

export function useCreatePMInvoice() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: PMInvoiceInput) => {
      if (!currentOrganization?.id || !user?.id) throw new Error('Not authenticated');
      
      // Generate invoice number
      const { data: existing } = await supabase
        .from('pm_invoices')
        .select('invoice_number')
        .eq('organization_id', currentOrganization.id)
        .like('invoice_number', 'PMI-%')
        .order('invoice_number', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (existing && existing.length > 0) {
        const match = existing[0].invoice_number.match(/PMI-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);
      const taxRate = input.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('pm_invoices')
        .insert({
          organization_id: currentOrganization.id,
          client_id: input.client_id,
          engagement_id: input.engagement_id || null,
          invoice_number: `PMI-${String(nextNum).padStart(5, '0')}`,
          invoice_date: input.invoice_date,
          due_date: input.due_date,
          status: 'draft',
          currency: input.currency || 'CAD',
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          amount_paid: 0,
          balance_due: total,
          notes: input.notes || null,
          terms: input.terms || null,
          billing_period_start: input.billing_period_start || null,
          billing_period_end: input.billing_period_end || null,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice lines
      const lines = input.lines.map((line, index) => ({
        invoice_id: invoice.id,
        time_entry_id: line.time_entry_id || null,
        line_order: index + 1,
        description: line.description,
        quantity: line.quantity,
        rate: line.unit_price,
        amount: line.quantity * line.unit_price,
      }));
      
      const { error: linesError } = await supabase
        .from('pm_invoice_lines')
        .insert(lines);
      
      if (linesError) throw linesError;
      
      // Mark time entries as billed
      const timeEntryIds = input.lines
        .filter(l => l.time_entry_id)
        .map(l => l.time_entry_id);
      
      if (timeEntryIds.length > 0) {
        await supabase
          .from('pm_time_entries')
          .update({ is_billed: true, billed_invoice_id: invoice.id })
          .in('id', timeEntryIds);
      }
      
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pm-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pm-unbilled-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pm-dashboard-kpis'] });
      toast.success('Invoice created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });
}

export function useUpdatePMInvoiceStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, amount_paid }: { id: string; status: string; amount_paid?: number }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      } else if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        if (amount_paid !== undefined) {
          updateData.amount_paid = amount_paid;
          // Get current invoice to calculate balance
          const { data: invoice } = await supabase
            .from('pm_invoices')
            .select('total')
            .eq('id', id)
            .single();
          if (invoice) {
            updateData.balance_due = invoice.total - amount_paid;
          }
        }
      }
      
      const { data, error } = await supabase
        .from('pm_invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pm-dashboard-kpis'] });
      toast.success('Invoice updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });
}

export function useDeletePMInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First, unbill any time entries
      await supabase
        .from('pm_time_entries')
        .update({ is_billed: false, billed_invoice_id: null })
        .eq('billed_invoice_id', id);
      
      const { error } = await supabase
        .from('pm_invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pm-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pm-unbilled-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pm-dashboard-kpis'] });
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete invoice: ${error.message}`);
    },
  });
}

// ============ COMPLIANCE DEADLINES ============

export function usePMComplianceDeadlines(clientId?: string) {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-compliance-deadlines', currentOrganization?.id, clientId],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('pm_compliance_deadlines')
        .select(`
          *,
          client:pm_clients(*),
          engagement:pm_engagements(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('due_date', { ascending: true });
      
      if (clientId) query = query.eq('client_id', clientId);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PMComplianceDeadline[];
    },
    enabled: !!currentOrganization?.id,
  });
}

// ============ AI INSIGHTS ============

export function usePMAIInsights() {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-ai-insights', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('pm_ai_insights')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as PMAIInsight[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useDismissPMAIInsight() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pm_ai_insights')
        .update({
          is_dismissed: true,
          dismissed_by: user?.id,
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-ai-insights'] });
    },
  });
}

// ============ DASHBOARD KPIs ============

export function usePMDashboardKPIs() {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-dashboard-kpis', currentOrganization?.id],
    queryFn: async (): Promise<PMDashboardKPIs> => {
      if (!currentOrganization?.id) {
        return {
          totalClients: 0,
          activeEngagements: 0,
          openTasks: 0,
          overdueTasks: 0,
          unbilledHours: 0,
          unbilledAmount: 0,
          revenueThisMonth: 0,
          upcomingDeadlines: 0,
          staffUtilization: 0,
          clientsAtRisk: 0,
        };
      }
      
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      
      // Fetch all data in parallel
      const [clientsRes, engagementsRes, tasksRes, timeEntriesRes, deadlinesRes, invoicesRes] = await Promise.all([
        supabase.from('pm_clients').select('id, status, risk_rating').eq('organization_id', currentOrganization.id),
        supabase.from('pm_engagements').select('id, status').eq('organization_id', currentOrganization.id),
        supabase.from('pm_tasks').select('id, status, due_date').eq('organization_id', currentOrganization.id).in('status', ['pending', 'in_progress', 'review']),
        supabase.from('pm_time_entries').select('id, hours, billing_rate, is_billable, status').eq('organization_id', currentOrganization.id).in('status', ['draft', 'submitted', 'approved']),
        supabase.from('pm_compliance_deadlines').select('id, due_date, status').eq('organization_id', currentOrganization.id).gte('due_date', today).eq('status', 'pending'),
        supabase.from('pm_invoices').select('total, status, invoice_date').eq('organization_id', currentOrganization.id).gte('invoice_date', startOfMonth),
      ]);
      
      const clients = clientsRes.data || [];
      const engagements = engagementsRes.data || [];
      const tasks = tasksRes.data || [];
      const timeEntries = timeEntriesRes.data || [];
      const deadlines = deadlinesRes.data || [];
      const invoices = invoicesRes.data || [];
      
      // Calculate metrics
      const totalClients = clients.filter(c => c.status === 'active').length;
      const activeEngagements = engagements.filter(e => e.status === 'active').length;
      const openTasks = tasks.length;
      const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today).length;
      
      const unbilledEntries = timeEntries.filter(e => e.is_billable && e.status !== 'billed');
      const unbilledHours = unbilledEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
      const unbilledAmount = unbilledEntries.reduce((sum, e) => sum + ((e.hours || 0) * (e.billing_rate || 0)), 0);
      
      const revenueThisMonth = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
      const upcomingDeadlines = deadlines.length;
      const clientsAtRisk = clients.filter(c => c.risk_rating === 'high').length;
      
      // Staff utilization (simplified - would need more data in production)
      const staffUtilization = unbilledHours > 0 ? Math.min(100, Math.round((unbilledHours / 160) * 100)) : 0;
      
      return {
        totalClients,
        activeEngagements,
        openTasks,
        overdueTasks,
        unbilledHours,
        unbilledAmount,
        revenueThisMonth,
        upcomingDeadlines,
        staffUtilization,
        clientsAtRisk,
      };
    },
    enabled: !!currentOrganization?.id,
  });
}
