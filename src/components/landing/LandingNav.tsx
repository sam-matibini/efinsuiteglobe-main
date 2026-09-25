import { Link } from 'react-router-dom';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Button } from '@/components/ui/button';
import {
  Calculator, Receipt, CreditCard, Landmark, PiggyBank,
  Users, Package, TrendingUp, Building2,
  Sparkles, FileSignature, MessageSquare, Heart, Globe,
} from 'lucide-react';
import landingLogo from '@/assets/landing-logo.png';
import testimonialSarah from '@/assets/features/testimonial-sarah.jpg';
import testimonialMichael from '@/assets/features/testimonial-michael.jpg';
import testimonialJennifer from '@/assets/features/testimonial-jennifer.jpg';

const featureGroups = [
  {
    label: 'Core Accounting',
    items: [
      { icon: Calculator, title: 'General Ledger', desc: 'Double-entry, journals, trial balance.' },
      { icon: Receipt, title: 'Accounts Receivable', desc: 'Invoices, payments, aging.' },
      { icon: CreditCard, title: 'Accounts Payable', desc: 'Bills, POs, vendor credits.' },
      { icon: Landmark, title: 'Banking', desc: 'AI-powered reconciliation.' },
      { icon: PiggyBank, title: 'Fixed Assets', desc: 'Depreciation & CCA classes.' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Users, title: 'Payroll', desc: 'Multi-country compliance.' },
      { icon: Package, title: 'Inventory', desc: 'Stock, warehouses, valuation.' },
      { icon: TrendingUp, title: 'Budgeting', desc: 'AI-powered forecasting.' },
      { icon: Building2, title: 'Practice Management', desc: 'Engagements, time & billing.' },
      { icon: Heart, title: 'Donations', desc: 'CRA-compliant receipts.' },
    ],
  },
  {
    label: 'Modern Suite',
    items: [
      { icon: Sparkles, title: 'Alice AI', desc: 'Your accounting expert.' },
      { icon: FileSignature, title: 'DocSign', desc: 'Legally-binding e-signatures.' },
      { icon: MessageSquare, title: 'Communication Hub', desc: 'SMS, email, WhatsApp.' },
      { icon: Globe, title: 'Multi-Organization', desc: '15+ countries, RBAC.' },
    ],
  },
];

const pricingPeek = [
  { name: 'Starter', price: '$49', tag: 'Small teams & freelancers' },
  { name: 'Professional', price: '$129', tag: 'Growing businesses', popular: true },
  { name: 'Enterprise', price: '$299', tag: 'Multi-entity & advanced' },
];

const testimonialPeek = [
  { name: 'Sarah Chen', role: 'CFO, TechStart Inc.', image: testimonialSarah },
  { name: 'Michael Roberts', role: 'Partner, Roberts Global Consulting', image: testimonialMichael },
  { name: 'Jennifer Walsh', role: 'Managing Partner, Walsh CPA', image: testimonialJennifer },
];

const panelClass =
  'nav-hover-panel rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-xl p-5';

export function LandingNav() {
  return (
    <nav className="bg-background/75 backdrop-blur-md border-b border-border/60 supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-3.5 flex items-center justify-between gap-6">
        <Link to="/landing" className="flex items-center gap-3 shrink-0">
          <img src={landingLogo} alt="efinsuite Globe" className="w-14 h-14 object-contain" />
          <span className="text-lg font-bold tracking-tight text-foreground">efinsuite Globe</span>
        </Link>

        <NavigationMenu delayDuration={120} className="hidden md:flex">
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="bg-transparent text-muted-foreground hover:text-foreground data-[state=open]:text-foreground data-[state=open]:bg-transparent">
                Features
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className={panelClass + ' w-[720px] grid grid-cols-3 gap-6'}>
                  {featureGroups.map((g) => (
                    <div key={g.label}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-accent mb-3">
                        {g.label}
                      </div>
                      <ul className="space-y-1">
                        {g.items.map((it) => (
                          <li key={it.title}>
                            <NavigationMenuLink asChild>
                              <a
                                href="#features"
                                className="group flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-accent/10 transition-colors"
                              >
                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
                                  <it.icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-foreground leading-tight">
                                    {it.title}
                                  </span>
                                  <span className="block text-xs text-muted-foreground truncate">
                                    {it.desc}
                                  </span>
                                </span>
                              </a>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="bg-transparent text-muted-foreground hover:text-foreground data-[state=open]:text-foreground data-[state=open]:bg-transparent">
                Pricing
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className={panelClass + ' w-[380px] space-y-1'}>
                  {pricingPeek.map((p) => (
                    <NavigationMenuLink asChild key={p.name}>
                      <a
                        href="#pricing"
                        className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-accent/10 transition-colors"
                      >
                        <span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{p.name}</span>
                            {p.popular && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                Popular
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{p.tag}</span>
                        </span>
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          {p.price}
                          {p.price.startsWith('$') && (
                            <span className="text-xs text-muted-foreground font-normal">/mo</span>
                          )}
                        </span>
                      </a>
                    </NavigationMenuLink>
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="bg-transparent text-muted-foreground hover:text-foreground data-[state=open]:text-foreground data-[state=open]:bg-transparent">
                Testimonials
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className={panelClass + ' w-[340px] space-y-1'}>
                  {testimonialPeek.map((t) => (
                    <NavigationMenuLink asChild key={t.name}>
                      <a
                        href="#testimonials"
                        className="flex items-start gap-3 rounded-lg p-3 hover:bg-accent/10 transition-colors"
                      >
                        <img src={t.image} alt={t.name} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" loading="lazy" />
                        <span>
                          <span className="block text-sm font-medium text-foreground leading-tight">
                            {t.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">{t.role}</span>
                        </span>
                      </a>
                    </NavigationMenuLink>
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="shadow-sm">Get Started</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
