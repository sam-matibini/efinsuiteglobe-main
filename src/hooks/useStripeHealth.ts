import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useStripeHealth() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stripe-integration', {
          body: { action: 'health-check' },
        });
        if (!error && data?.configured) {
          setIsConfigured(true);
        } else {
          setIsConfigured(false);
        }
      } catch {
        setIsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    };
    check();
  }, []);

  return { isConfigured, isLoading };
}
