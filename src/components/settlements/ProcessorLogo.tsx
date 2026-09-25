import stripe from '@/assets/processor-logos/stripe.svg';
import adyen from '@/assets/processor-logos/adyen.svg';
import paysafe from '@/assets/processor-logos/paysafe.svg';
import square from '@/assets/processor-logos/square.svg';
import paypal from '@/assets/processor-logos/paypal.svg';
import generic from '@/assets/processor-logos/generic.svg';
import { cn } from '@/lib/utils';

const MAP: Record<string, string> = { stripe, adyen, paysafe, square, paypal };

export function ProcessorLogo({ processor, className }: { processor?: string | null; className?: string }) {
  const key = (processor ?? '').toLowerCase();
  const src = MAP[key] ?? generic;
  return (
    <img
      src={src}
      alt={processor ?? 'processor'}
      loading="lazy"
      width={20}
      height={20}
      className={cn('h-5 w-auto object-contain', className)}
    />
  );
}
