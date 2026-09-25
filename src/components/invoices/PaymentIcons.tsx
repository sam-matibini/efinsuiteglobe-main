import { forwardRef } from 'react';

interface IconProps {
  className?: string;
}

export const VisaIcon = forwardRef<SVGSVGElement, IconProps>(({ className = "h-4" }, ref) => (
  <svg ref={ref} viewBox="0 0 780 500" className={className} aria-label="Visa">
    <rect width="780" height="500" rx="40" fill="#1A1F71" />
    <path d="M293.2 348.7l33.4-195.8h53.4l-33.4 195.8h-53.4zm246.8-191c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.2 64.7-.3 28.2 26.5 43.9 46.8 53.3 20.8 9.6 27.8 15.8 27.7 24.4-.1 13.2-16.6 19.2-32 19.2-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.1 0 92.5-26.3 92.9-67 .2-22.3-14-39.3-44.8-53.3-18.6-9.1-30.1-15.2-30-24.4 0-8.2 9.7-16.9 30.6-16.9 17.4-.3 30.1 3.5 39.9 7.5l4.8 2.3 7.3-42.5zm131.2-4.8h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.4 179.8h56.1l11.2-29.4h68.5l6.5 29.4h49.5l-43.1-196.1zm-65.9 126.4c4.4-11.3 21.5-54.8 21.5-54.8-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47.3 12.5 57.2h-44.7v-.6zM285.5 152.9l-52.3 133.6-5.6-27.1c-9.7-31.2-39.9-65.1-73.7-82l47.8 171.2h56.5l84.1-195.7h-56.8z" fill="#fff" />
    <path d="M146.9 152.9H59.7l-.7 3.8c67 16.2 111.3 55.4 129.7 102.5l-18.7-90c-3.2-12.3-12.5-15.8-23.1-16.3z" fill="#F9A533" />
  </svg>
));
VisaIcon.displayName = 'VisaIcon';

export const MastercardIcon = forwardRef<SVGSVGElement, IconProps>(({ className = "h-4" }, ref) => (
  <svg ref={ref} viewBox="0 0 780 500" className={className} aria-label="Mastercard">
    <rect width="780" height="500" rx="40" fill="#16366F" />
    <circle cx="312" cy="250" r="150" fill="#EB001B" />
    <circle cx="468" cy="250" r="150" fill="#F79E1B" />
    <path d="M390 130.7c-38.1 30-62.5 76.7-62.5 129.3s24.4 99.3 62.5 129.3c38.1-30 62.5-76.7 62.5-129.3s-24.4-99.3-62.5-129.3z" fill="#FF5F00" />
  </svg>
));
MastercardIcon.displayName = 'MastercardIcon';

export const AmexIcon = forwardRef<SVGSVGElement, IconProps>(({ className = "h-4" }, ref) => (
  <svg ref={ref} viewBox="0 0 780 500" className={className} aria-label="American Express">
    <rect width="780" height="500" rx="40" fill="#2E77BC" />
    <text x="390" y="280" textAnchor="middle" fill="#fff" fontSize="120" fontFamily="Arial, sans-serif" fontWeight="bold">AMEX</text>
  </svg>
));
AmexIcon.displayName = 'AmexIcon';

export const InteracIcon = forwardRef<SVGSVGElement, IconProps>(({ className = "h-4" }, ref) => (
  <svg ref={ref} viewBox="0 0 780 500" className={className} aria-label="Interac e-Transfer">
    <rect width="780" height="500" rx="40" fill="#FEBE10" />
    <text x="390" y="260" textAnchor="middle" fill="#1A1A1A" fontSize="100" fontFamily="Arial, sans-serif" fontWeight="bold">Interac</text>
    <text x="390" y="340" textAnchor="middle" fill="#1A1A1A" fontSize="60" fontFamily="Arial, sans-serif">e-Transfer</text>
  </svg>
));
InteracIcon.displayName = 'InteracIcon';
