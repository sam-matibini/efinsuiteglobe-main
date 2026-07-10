import { ArrowLeftRight, Users, FileText, CreditCard, Building2, Wallet, Landmark, Check } from 'lucide-react';
import { useInViewOnce } from '@/hooks/useInViewOnce';

const inbound = [
  { icon: Users, label: 'Customers' },
  { icon: FileText, label: 'Invoices' },
  { icon: CreditCard, label: 'Card payments' },
];

const outbound = [
  { icon: Building2, label: 'Vendors' },
  { icon: Wallet, label: 'Payroll' },
  { icon: Landmark, label: 'Tax authorities' },
];

const proofPoints = [
  'AR + AP in one entry',
  'Zero CSV exports between sides',
  'Real-time cash position',
];

export function TwoWayFlow() {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-24 md:py-28"
      style={{ backgroundColor: 'hsl(222 47% 11%)' }}
    >
      {/* Ambient teal glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(55% 45% at 50% 50%, hsl(172 66% 40% / 0.28), transparent 70%)',
        }}
      />
      {/* Grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />

      <div className="relative container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div
            className={`reveal reveal-child ${inView ? 'is-in' : ''} inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-5`}
            style={{ transitionDelay: '0ms' }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Money in. Money out. One ledger.
          </div>
          <h2
            className={`reveal reveal-child ${inView ? 'is-in' : ''} text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight leading-[1.1]`}
            style={{ transitionDelay: '80ms' }}
          >
            Most tools move money one way. <span className="gradient-text">efinsuite moves it both.</span>
          </h2>
          <p
            className={`reveal reveal-child ${inView ? 'is-in' : ''} text-base md:text-lg text-white/70 leading-relaxed`}
            style={{ transitionDelay: '160ms' }}
          >
            AR-only tools leave AP scattered across spreadsheets. AP-only tools leave collections in a
            separate app. efinsuite unifies collect, pay, and reconcile in a single audit trail — with
            payroll and tax remittances on the same ledger.
          </p>
        </div>

        {/* Diagram */}
        <div
          className={`reveal ${inView ? 'is-in' : ''} relative max-w-5xl mx-auto`}
          style={{ transitionDelay: '220ms' }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 md:gap-10 items-center">
            {/* Inbound column */}
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-accent/80 font-semibold mb-3 text-right">
                Money in
              </div>
              {inbound.map((item) => (
                <FlowPill key={item.label} icon={item.icon} label={item.label} side="right" />
              ))}
            </div>

            {/* Ledger core */}
            <div className="relative flex flex-col items-center">
              {/* Left connecting flow line */}
              <FlowLine side="left" active={inView} />
              {/* Right connecting flow line */}
              <FlowLine side="right" active={inView} />

              <div
                className={`relative z-10 flex flex-col items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/25 to-accent/5 backdrop-blur-md ${inView ? 'ledger-pulse' : ''}`}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-accent/80 mb-1">
                  efinsuite
                </div>
                <div className="text-lg md:text-xl font-bold text-white">Ledger</div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  Live
                </div>
              </div>
            </div>

            {/* Outbound column */}
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-accent/80 font-semibold mb-3 text-left">
                Money out
              </div>
              {outbound.map((item) => (
                <FlowPill key={item.label} icon={item.icon} label={item.label} side="left" />
              ))}
            </div>
          </div>

          {/* Proof strip */}
          <div className="mt-12 grid sm:grid-cols-3 gap-4">
            {proofPoints.map((p, i) => (
              <div
                key={p}
                className={`reveal reveal-child ${inView ? 'is-in' : ''} flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-4 py-3`}
                style={{ transitionDelay: `${320 + i * 60}ms` }}
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="text-sm text-white/85">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowPill({
  icon: Icon,
  label,
  side,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  side: 'left' | 'right';
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-4 py-3 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/15 text-accent shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-sm font-medium text-white/90">{label}</span>
    </div>
  );
}

function FlowLine({ side, active }: { side: 'left' | 'right'; active: boolean }) {
  // Left line: arrow pointing right (money in). Right line: arrow pointing left (money out).
  const isLeft = side === 'left';
  return (
    <svg
      className={`absolute top-1/2 -translate-y-1/2 pointer-events-none hidden md:block ${isLeft ? 'right-full mr-2' : 'left-full ml-2'}`}
      width="80"
      height="40"
      viewBox="0 0 80 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`grad-${side}`} x1={isLeft ? '0' : '80'} y1="20" x2={isLeft ? '80' : '0'} y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(172 66% 50%)" stopOpacity="0.1" />
          <stop offset="1" stopColor="hsl(172 66% 50%)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <line
        x1={isLeft ? 0 : 76}
        y1="20"
        x2={isLeft ? 72 : 4}
        y2="20"
        stroke={`url(#grad-${side})`}
        strokeWidth="2"
        strokeDasharray="6 6"
        className={active ? 'flow-arrow' : ''}
        style={{ animationDirection: isLeft ? 'normal' : 'reverse' }}
      />
      {/* Arrow head */}
      <path
        d={isLeft ? 'M 72 14 L 80 20 L 72 26 Z' : 'M 8 14 L 0 20 L 8 26 Z'}
        fill="hsl(172 66% 50%)"
      />
    </svg>
  );
}
