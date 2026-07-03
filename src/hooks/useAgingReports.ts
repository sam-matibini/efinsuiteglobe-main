import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';

export interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

export interface CustomerAging {
  id: string;
  name: string;
  email: string | null;
  buckets: AgingBucket;
}

export interface VendorAging {
  id: string;
  name: string;
  email: string | null;
  buckets: AgingBucket;
}

function calculateAgingBucket(dueDate: string, amount: number): keyof AgingBucket {
  const today = new Date();
  const due = new Date(dueDate);
  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'days1to30';
  if (daysOverdue <= 60) return 'days31to60';
  if (daysOverdue <= 90) return 'days61to90';
  return 'over90';
}

export function useARAgingReport() {
  const { organization: currentOrganization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['ar_aging', currentOrganization?.id],
    queryFn: async () => {
      // Get all unpaid invoices
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          customer_id,
          due_date,
          balance_due,
          customer:customers(id, name, email)
        `)
        .eq('organization_id', currentOrganization!.id)
        .is('deleted_at', null)
        .not('status', 'eq', 'void')
        .gt('balance_due', 0)
        .in('status', ['sent', 'partial', 'overdue', 'issued', 'final']);

      if (error) throw error;

      // Group by customer and calculate aging buckets
      const customerAgingMap = new Map<string, CustomerAging>();

      invoices.forEach(invoice => {
        if (!invoice.customer) return;
        
        const customerId = invoice.customer.id;
        const bucket = calculateAgingBucket(invoice.due_date, Number(invoice.balance_due));
        
        if (!customerAgingMap.has(customerId)) {
          customerAgingMap.set(customerId, {
            id: customerId,
            name: invoice.customer.name,
            email: invoice.customer.email,
            buckets: {
              current: 0,
              days1to30: 0,
              days31to60: 0,
              days61to90: 0,
              over90: 0,
              total: 0,
            },
          });
        }

        const customerAging = customerAgingMap.get(customerId)!;
        customerAging.buckets[bucket] += Number(invoice.balance_due);
        customerAging.buckets.total += Number(invoice.balance_due);
      });

      const customerAgingList = Array.from(customerAgingMap.values())
        .sort((a, b) => b.buckets.total - a.buckets.total);

      // Calculate summary totals
      const summary: AgingBucket = {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
        total: 0,
      };

      customerAgingList.forEach(customer => {
        summary.current += customer.buckets.current;
        summary.days1to30 += customer.buckets.days1to30;
        summary.days31to60 += customer.buckets.days31to60;
        summary.days61to90 += customer.buckets.days61to90;
        summary.over90 += customer.buckets.over90;
        summary.total += customer.buckets.total;
      });

      return {
        customers: customerAgingList,
        summary,
      };
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useAPAgingReport() {
  const { organization: currentOrganization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['ap_aging', currentOrganization?.id],
    queryFn: async () => {
      // Get all unpaid bills
      const { data: bills, error } = await supabase
        .from('bills')
        .select(`
          id,
          vendor_id,
          due_date,
          balance_due,
          vendor:vendors(id, name, email)
        `)
        .eq('organization_id', currentOrganization!.id)
        .gt('balance_due', 0)
        .in('status', ['approved', 'partial', 'overdue']);

      if (error) throw error;

      // Group by vendor and calculate aging buckets
      const vendorAgingMap = new Map<string, VendorAging>();

      bills.forEach(bill => {
        if (!bill.vendor) return;
        
        const vendorId = bill.vendor.id;
        const bucket = calculateAgingBucket(bill.due_date, Number(bill.balance_due));
        
        if (!vendorAgingMap.has(vendorId)) {
          vendorAgingMap.set(vendorId, {
            id: vendorId,
            name: bill.vendor.name,
            email: bill.vendor.email,
            buckets: {
              current: 0,
              days1to30: 0,
              days31to60: 0,
              days61to90: 0,
              over90: 0,
              total: 0,
            },
          });
        }

        const vendorAging = vendorAgingMap.get(vendorId)!;
        vendorAging.buckets[bucket] += Number(bill.balance_due);
        vendorAging.buckets.total += Number(bill.balance_due);
      });

      const vendorAgingList = Array.from(vendorAgingMap.values())
        .sort((a, b) => b.buckets.total - a.buckets.total);

      // Calculate summary totals
      const summary: AgingBucket = {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
        total: 0,
      };

      vendorAgingList.forEach(vendor => {
        summary.current += vendor.buckets.current;
        summary.days1to30 += vendor.buckets.days1to30;
        summary.days31to60 += vendor.buckets.days31to60;
        summary.days61to90 += vendor.buckets.days61to90;
        summary.over90 += vendor.buckets.over90;
        summary.total += vendor.buckets.total;
      });

      return {
        vendors: vendorAgingList,
        summary,
      };
    },
    enabled: !!currentOrganization?.id,
  });
}
