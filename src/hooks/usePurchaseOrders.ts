import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface PurchaseOrder {
  id: string;
  organization_id: string | null;
  vendor_id: string;
  po_number: string;
  po_date: string;
  expected_date: string | null;
  status: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  tax_amount: number;
  total: number;
  currency: string;
  shipping_address: string | null;
  terms: string | null;
  notes: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string };
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  product_service_id: string | null;
  inventory_item_id: string | null;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  discount_percent: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  amount: number;
  line_order: number;
}

export interface CreatePurchaseOrderInput {
  vendor_id: string;
  po_date: string;
  expected_date?: string;
  shipping_address?: string;
  terms?: string;
  notes?: string;
  lines: Omit<PurchaseOrderLine, 'id' | 'purchase_order_id' | 'quantity_received'>[];
}

export function usePurchaseOrders() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const purchaseOrdersQuery = useQuery({
    queryKey: ['purchase_orders', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendor:vendors(name)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createPurchaseOrder = useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      // Generate PO number
      const { count } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const poNumber = `PO-${String((count || 0) + 1).padStart(5, '0')}`;
      
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100);
        return sum + lineAmount;
      }, 0);
      
      const taxAmount = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100);
        return sum + (lineAmount * (line.tax_rate || 0) / 100);
      }, 0);

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          organization_id: currentOrganization!.id,
          vendor_id: input.vendor_id,
          po_number: poNumber,
          po_date: input.po_date,
          expected_date: input.expected_date,
          shipping_address: input.shipping_address,
          terms: input.terms,
          notes: input.notes,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Insert PO lines
      const lines = input.lines.map((line, index) => ({
        purchase_order_id: po.id,
        product_service_id: line.product_service_id,
        inventory_item_id: line.inventory_item_id,
        description: line.description,
        quantity_ordered: line.quantity_ordered,
        quantity_received: 0,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent || 0,
        tax_rate: line.tax_rate || 0,
        tax_amount: (line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100)) * (line.tax_rate || 0) / 100,
        amount: line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100),
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Purchase order created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create purchase order: ${error.message}`);
    },
  });

  const updatePurchaseOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'acknowledged') {
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'received') {
        updates.received_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Purchase order status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update purchase order: ${error.message}`);
    },
  });

  const convertToBill = useMutation({
    mutationFn: async (poId: string) => {
      // Get the PO and its lines
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_lines(*)')
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      // Generate bill number
      const { count } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const billNumber = `BILL-${String((count || 0) + 1).padStart(5, '0')}`;

      // Create bill
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          organization_id: currentOrganization!.id,
          vendor_id: po.vendor_id,
          purchase_order_id: poId,
          bill_number: billNumber,
          bill_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: po.subtotal,
          tax_amount: po.tax_amount,
          total: po.total,
          balance_due: po.total,
          terms: po.terms,
          notes: po.notes,
        })
        .select()
        .single();

      if (billError) throw billError;

      // Create bill lines
      const billLines = po.purchase_order_lines.map((line: PurchaseOrderLine, index: number) => ({
        bill_id: bill.id,
        description: line.description,
        quantity: line.quantity_ordered,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate || 0,
        tax_amount: line.tax_amount || 0,
        amount: line.amount,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('bill_lines')
        .insert(billLines);

      if (linesError) throw linesError;

      // Update PO status
      await supabase
        .from('purchase_orders')
        .update({ status: 'closed' })
        .eq('id', poId);

      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Purchase order converted to bill successfully');
    },
    onError: (error) => {
      toast.error(`Failed to convert purchase order: ${error.message}`);
    },
  });

  // Summary statistics
  const purchaseOrders = purchaseOrdersQuery.data || [];
  const totalPOs = purchaseOrders.length;
  const openPOs = purchaseOrders.filter(po => ['draft', 'sent', 'acknowledged'].includes(po.status)).length;
  const openValue = purchaseOrders
    .filter(po => ['draft', 'sent', 'acknowledged'].includes(po.status))
    .reduce((sum, po) => sum + Number(po.total), 0);

  return {
    purchaseOrders,
    isLoading: purchaseOrdersQuery.isLoading,
    error: purchaseOrdersQuery.error,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    convertToBill,
    totalPOs,
    openPOs,
    openValue,
  };
}
