import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoicePayNowButtonProps {
  invoiceId: string;
  balanceDue: number;
  creditCardEnabled?: boolean;
  achEnabled?: boolean;
  interacEnabled?: boolean;
}

export function InvoicePayNowButton({ 
  invoiceId, 
  balanceDue, 
  creditCardEnabled = true, 
  achEnabled = false,
  interacEnabled = false,
}: InvoicePayNowButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayNow = async () => {
    setIsLoading(true);
    try {
      const paymentMethods: string[] = [];
      if (creditCardEnabled) paymentMethods.push('card');
      if (achEnabled) paymentMethods.push('us_bank_account');
      if (interacEnabled) paymentMethods.push('acss_debit');
      
      if (paymentMethods.length === 0) {
        toast.error('No payment methods enabled');
        return;
      }

      const { data, error } = await supabase.functions.invoke('collect-invoice-payment', {
        body: {
          invoiceId,
          paymentMethods,
          successUrl: `${window.location.origin}/invoices?payment=success`,
          cancelUrl: `${window.location.origin}/invoices?payment=cancelled`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Pay Now error:', err);
      toast.error('Failed to initiate payment: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (balanceDue <= 0) return null;

  return (
    <Button 
      onClick={handlePayNow} 
      disabled={isLoading}
      size="sm"
      className="gap-1.5"
    >
      <CreditCard className="w-4 h-4" />
      {isLoading ? 'Processing...' : 'Pay Now'}
    </Button>
  );
}
