import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { LandingChatWidget } from '@/components/landing/LandingChatWidget';
import { LandingNav } from '@/components/landing/LandingNav';
import { TwoWayFlow } from '@/components/landing/TwoWayFlow';
import { useInViewOnce } from '@/hooks/useInViewOnce';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  Calculator, 
  BarChart3, 
  Users, 
  Shield, 
  Zap,
  ArrowRight,
  Globe,
  FileSignature,
  MessageSquare,
  Heart,
  Briefcase,
  Bot,
  CreditCard,
  Package,
  Receipt,
  PiggyBank,
  Linkedin,
  Landmark,
  TrendingUp,
  Building2,
  Sparkles,
  Brain,
  LineChart,
  Star,
  Quote,
  Lock,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import landingLogo from '@/assets/landing-logo.png';
import aliceAvatar from '@/assets/alice-avatar.png';

// Feature images
import featureGeneralLedger from '@/assets/features/general-ledger.jpg';
import featureAccountsReceivable from '@/assets/features/accounts-receivable.jpg';
import featureAccountsPayable from '@/assets/features/accounts-payable.jpg';
import featurePayroll from '@/assets/features/payroll.jpg';
import featureBanking from '@/assets/features/banking.jpg';
import featureFixedAssets from '@/assets/features/fixed-assets.jpg';
import featureBudgeting from '@/assets/features/budgeting.png';
import featureInventory from '@/assets/features/inventory.jpg';
import featureDonations from '@/assets/features/donations.jpg';
import featurePractice from '@/assets/features/practice.jpg';
import featureDocsign from '@/assets/features/docsign.jpg';
import featureCommunication from '@/assets/features/communication.jpg';
import featureMultiOrg from '@/assets/features/multi-org.jpg';
import featureRealTimeInsights from '@/assets/features/real-time-insights.jpg';
import featureAutomatedTasks from '@/assets/features/automated-tasks.jpg';
import featurePredictiveAnalytics from '@/assets/features/predictive-analytics.jpg';
import featureFreeTrial from '@/assets/features/free-trial.jpg';
import featureNoCreditCard from '@/assets/features/no-credit-card.jpg';
import featureCancelAnytime from '@/assets/features/cancel-anytime.jpg';
import featureStreamlinedAccounting from '@/assets/features/streamlined-accounting.jpg';
import featureMultiCountryCompliance from '@/assets/features/multi-country-compliance.jpg';
import featureSecurityProtection from '@/assets/features/security-protection.jpg';
import featurePlanStarter from '@/assets/features/plan-starter.jpg';
import featurePlanProfessional from '@/assets/features/plan-professional.jpg';
import featurePlanEnterprise from '@/assets/features/plan-enterprise.jpg';
import aliceBackground from '@/assets/features/alice-background.jpg';
import heroBackground from '@/assets/features/hero-background.jpg';
import footerBackground from '@/assets/features/footer-background.jpg';
import { StockMarketTicker } from '@/components/landing/StockMarketTicker';
import { FloatingMarketWidget } from '@/components/landing/FloatingMarketWidget';
import testimonialSarah from '@/assets/features/testimonial-sarah.jpg';
import testimonialMichael from '@/assets/features/testimonial-michael.jpg';
import testimonialJennifer from '@/assets/features/testimonial-jennifer.jpg';
import testimonialDavid from '@/assets/features/testimonial-david.jpg';

// Preload hero background to prevent flicker
const heroPreload = new Image();
heroPreload.src = heroBackground;

const features = [
  {
    icon: Calculator,
    title: 'General Ledger',
    description: 'Full double-entry accounting with chart of accounts, journal entries, trial balance, and fiscal year closing.',
    image: featureGeneralLedger
  },
  {
    icon: Receipt,
    title: 'Accounts Receivable',
    description: 'Create invoices, record customer payments, manage credit notes, and track aging receivables.',
    image: featureAccountsReceivable
  },
  {
    icon: CreditCard,
    title: 'Accounts Payable',
    description: 'Process vendor bills, manage purchase orders, track credits, and streamline payment workflows.',
    image: featureAccountsPayable
  },
  {
    icon: Users,
    title: 'Payroll Management',
    description: 'Multi-country payroll with TD1/T4 (Canada), tax compliance, timesheets, and direct deposit support.',
    image: featurePayroll
  },
  {
    icon: Landmark,
    title: 'Banking & Reconciliation',
    description: 'Connect bank accounts, import transactions, and reconcile with AI-powered categorization.',
    image: featureBanking
  },
  {
    icon: PiggyBank,
    title: 'Fixed Assets',
    description: 'Track assets, calculate depreciation (CCA classes for Canada), manage disposals and revaluations.',
    image: featureFixedAssets
  },
  {
    icon: TrendingUp,
    title: 'Budgeting & Forecasting',
    description: 'Create budgets by department, track actuals vs. budget variance, with AI-powered forecasting.',
    image: featureBudgeting
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Track stock levels, manage warehouses, handle transfers, and monitor inventory valuation.',
    image: featureInventory
  },
  {
    icon: Heart,
    title: 'Donation Management',
    description: 'CRA-compliant charitable receipts, split-receipting, fund tracking, and pledge management.',
    image: featureDonations
  },
  {
    icon: Building2,
    title: 'Practice Management',
    description: 'Client engagements, time tracking, billing, and staff management for accounting firms.',
    image: featurePractice
  },
  {
    icon: FileSignature,
    title: 'DocSign',
    description: 'Upload, send, and collect legally-binding e-signatures on documents up to 600+ pages.',
    image: featureDocsign
  },
  {
    icon: MessageSquare,
    title: 'Communication Hub',
    description: 'Centralized SMS, Email (SendGrid), and WhatsApp messaging with branded templates.',
    image: featureCommunication
  },
  {
    icon: Sparkles,
    title: 'Alice AI Assistant',
    description: 'AI-powered accounting expert for guidance on Accounting, Tax, HR, and Strategy across multiple jurisdictions.',
    useAliceImage: true
  },
  {
    icon: Globe,
    title: 'Multi-Organization & Localization',
    description: 'Manage multiple businesses with role-based access, supporting 15+ countries including CA, US, UK, AU, DE, FR, ZA, NG, GH, IN, AE, SA, ZM, KE, and BI.',
    image: featureMultiOrg
  }
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 49,
    description: 'Perfect for small businesses and freelancers',
    image: featurePlanStarter,
    features: [
      'Up to 5 users',
      'Up to 25 employees',
      'Core accounting (GL, AR, AP)',
      'Basic payroll',
      'Bank reconciliation',
      'Alice AI Assistant',
      'Email support',
      '10GB storage'
    ],
    popular: false
  },
  {
    name: 'Professional',
    price: 129,
    description: 'For growing businesses with advanced needs',
    image: featurePlanProfessional,
    features: [
      'Up to 25 users',
      'Up to 100 employees',
      'All Starter features',
      'Fixed Assets & Depreciation',
      'Budgeting & Forecasting',
      'Inventory Management',
      'DocSign (e-signatures)',
      'Communication Hub',
      'Priority support',
      '100GB storage'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: 299,
    description: 'For accounting firms and large organizations',
    image: featurePlanEnterprise,
    features: [
      'Unlimited users',
      'Unlimited employees',
      'All Professional features',
      'Practice Management',
      'Donation Management (NPO)',
      'Accountant Dashboard',
      'Multi-country tax compliance',
      'Dedicated account manager',
      'Custom integrations',
      'Unlimited storage'
    ],
    popular: false
  }
];

const testimonials = [
  {
    quote: "efinsuite Globe transformed how we manage our finances. Alice AI alone saved our team 15 hours per week on bookkeeping questions.",
    author: "Sarah Chen",
    role: "CFO, TechStart Inc.",
    avatar: "SC",
    image: testimonialSarah
  },
  {
    quote: "Finally, accounting software that understands multi-country tax requirements. From Canadian T4s to Zambian VAT—all in one platform.",
    author: "Michael Roberts",
    role: "Partner, Roberts Global Consulting",
    avatar: "MR",
    image: testimonialMichael
  },
  {
    quote: "DocSign and the Communication Hub streamlined our client onboarding. We send engagement letters and collect signatures in minutes.",
    author: "Jennifer Walsh",
    role: "Managing Partner, Walsh CPA",
    avatar: "JW",
    image: testimonialJennifer
  },
  {
    quote: "The Donation Management module is CRA-compliant out of the box. Split-receipting and fund tracking made our charity audit-ready.",
    author: "David Mwanza",
    role: "Executive Director, Hope Foundation",
    avatar: "DM",
    image: testimonialDavid
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>efinsuite Globe – Global AI-Powered Accounting, Payroll & Financial Management</title>
        <meta
          name="description"
          content="efinsuite Globe is an AI-powered accounting, payroll, tax and treasury platform built for multi-country organizations. Secure, compliant, enterprise-ready."
        />
        <link rel="canonical" href="https://www.efinsuite.com/landing" />
        <meta property="og:title" content="efinsuite Globe – Global AI-Powered Financial Management" />
        <meta property="og:url" content="https://www.efinsuite.com/landing" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "efinsuite Globe – Global AI-Powered Financial Management",
          "url": "https://www.efinsuite.com/landing",
          "description": "AI-powered Accounting, Payroll, Tax and Treasury platform for multi-country organizations.",
          "isPartOf": { "@type": "WebSite", "name": "efinsuite Globe", "url": "https://www.efinsuite.com/" }
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.efinsuite.com/" }
          ]
        })}</script>
      </Helmet>

      {/* Stock Market Ticker */}
      <div className="sticky top-0 z-50">
        <StockMarketTicker />
        <LandingNav />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden" style={{ backgroundColor: 'hsl(222 47% 11%)' }}>
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBackground})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
        {/* Radial teal glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 45% at 50% 35%, hsl(172 66% 40% / 0.35), transparent 70%)',
          }}
        />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          }}
        />
        <div className="relative container mx-auto px-6 py-24 md:py-32">
          <div className="hero-stagger max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 bg-accent/15 text-white border-accent/30 backdrop-blur-sm">
              Collect payments · Pay vendors · Run payroll · One ledger
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
              <span className="gradient-text">AI-Powered</span> Cloud-Based<br />
              Multi-Organization <span className="gradient-text">Business Suite</span>
            </h1>
            <p className="text-lg md:text-xl text-white/75 mb-10 max-w-3xl mx-auto leading-relaxed">
              An AI-powered, cloud-based, multi-organization, multi-country accounting and business
              management platform — built to simplify financial operations for modern teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="group w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground shadow-glow transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  Start Free Trial <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link to="/contact" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="group w-full sm:w-auto border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 font-medium backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  Book a Demo
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.2em] text-white/50">
              Trusted by finance teams in 15+ countries
            </p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-white text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-accent/40 shadow-lg">
                  <img src={featureFreeTrial} alt="14-day free trial" className="w-full h-full object-cover" />
                </div>
                <span className="flex items-center gap-1"><Check className="w-4 h-4 text-accent" /> 14-day free trial</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-accent/40 shadow-lg">
                  <img src={featureNoCreditCard} alt="No credit card required" className="w-full h-full object-cover" />
                </div>
                <span className="flex items-center gap-1"><Check className="w-4 h-4 text-accent" /> No credit card required</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-accent/40 shadow-lg">
                  <img src={featureCancelAnytime} alt="Cancel anytime" className="w-full h-full object-cover" />
                </div>
                <span className="flex items-center gap-1"><Check className="w-4 h-4 text-accent" /> Cancel anytime</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Differentiators Section — what makes efinsuite different */}
      <DifferentiatorsSection />

      {/* Two-way money flow — bidirectional payments story */}
      <TwoWayFlow />





      {/* Key Features & Benefits Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">📌 Key Features & Benefits</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to manage your business
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Comprehensive accounting automation, AI-powered budgeting, practice management, and compliance support—
              all enhanced by Alice, your AI business assistant.
            </p>
          </div>
          
          {/* Alice AI Highlight Card */}
          <div className="mb-12">
            <Card className="border-accent/50 overflow-hidden">
              {/* Alice Background Banner */}
              <div className="relative h-48 overflow-hidden">
                <img src={aliceBackground} alt="AI Business Assistant" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-accent shadow-xl ring-4 ring-accent/20">
                    <img src={aliceAvatar} alt="Alice AI Assistant" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
              <CardHeader className="text-center pt-2">
                <CardTitle className="text-2xl">Alice – AI Business Assistant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div className="space-y-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto shadow-md border border-accent/20">
                      <img src={featureRealTimeInsights} alt="Real-Time Insights" className="w-full h-full object-cover" />
                    </div>
                    <h4 className="font-semibold text-foreground">Real-Time Insights</h4>
                    <p className="text-sm text-muted-foreground">
                      Provides real-time insights and recommendations based on your financial and operational data.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto shadow-md border border-accent/20">
                      <img src={featureAutomatedTasks} alt="Automated Tasks" className="w-full h-full object-cover" />
                    </div>
                    <h4 className="font-semibold text-foreground">Automated Tasks</h4>
                    <p className="text-sm text-muted-foreground">
                      Automates routine tasks, such as generating reports, checking data accuracy, and tracking KPIs.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto shadow-md border border-accent/20">
                      <img src={featurePredictiveAnalytics} alt="Predictive Analytics" className="w-full h-full object-cover" />
                    </div>
                    <h4 className="font-semibold text-foreground">Predictive Analytics</h4>
                    <p className="text-sm text-muted-foreground">
                      Helps businesses make smarter decisions faster with predictive analytics and alerts.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:border-accent/50 transition-colors overflow-hidden group">
                {feature.useAliceImage ? (
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-accent/10 to-accent/20 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/30 shadow-lg">
                      <img src={aliceAvatar} alt="Alice AI" className="w-full h-full object-cover" />
                    </div>
                  </div>
                ) : feature.image ? (
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={feature.image} 
                      alt={feature.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                ) : null}
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-accent mb-2">5,000+</div>
              <div className="text-primary-foreground/80">Businesses</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-accent mb-2">50,000+</div>
              <div className="text-primary-foreground/80">Employees Managed</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-accent mb-2">$2B+</div>
              <div className="text-primary-foreground/80">Payroll Processed</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-accent mb-2">99.9%</div>
              <div className="text-primary-foreground/80">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include core features with no hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.popular ? 'border-accent shadow-lg scale-105' : 'border-border/50'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-accent text-accent-foreground">Most Popular</Badge>
                  </div>
                )}
                <div className="relative h-36 overflow-hidden rounded-t-lg">
                  <img src={plan.image} alt={plan.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-accent flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link to="/signup" className="w-full">
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      Get Started
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gradient-to-b from-muted/30 via-background to-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 border-accent/30 text-accent bg-accent/5">Customer stories</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
              Trusted by finance leaders worldwide
            </h2>
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-0.5" aria-label="Average rating 4.9 out of 5">
                {[0,1,2,3,4].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>
              <span className="font-medium text-foreground">4.9 / 5</span>
              <span aria-hidden="true">·</span>
              <span>from 800+ verified reviews</span>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-accent/40 hover:shadow-lg transition-all duration-200"
              >
                <Quote
                  className="absolute -top-2 -right-2 w-20 h-20 text-accent/10 pointer-events-none"
                  aria-hidden="true"
                />
                <CardContent className="relative pt-6 pb-6 flex flex-col h-full">
                  <div className="flex items-center gap-0.5 mb-4" aria-label="5 star rating">
                    {[0,1,2,3,4].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-[15px] text-foreground/85 leading-relaxed mb-6 flex-1">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/60">
                    <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-accent/20 shrink-0">
                      <img src={testimonial.image} alt={testimonial.author} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{testimonial.author}</div>
                      <div className="text-xs text-muted-foreground truncate">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Trust strip */}
          <div className="mt-16 max-w-4xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
              Powering finance teams across
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground/80">
              {['Canada', 'United States', 'United Kingdom', 'Germany', 'France', 'UAE', 'South Africa', 'Nigeria', 'India', 'Australia'].map((country) => (
                <span key={country} className="whitespace-nowrap">{country}</span>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* Security & Compliance Section */}
      <section id="security" className="py-24 scroll-mt-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12 items-center">
            <div className="lg:col-span-2">
              <Badge variant="outline" className="mb-4 border-accent/30 text-accent bg-accent/5">
                Security & Compliance
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5 tracking-tight leading-[1.1]">
                Compliance built for regulated finance teams
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-6">
                Multi-factor authentication, server-side encryption, granular RBAC, and immutable audit trails — designed for finance teams that need to defend every entry.
              </p>
              <ul className="space-y-3">
                {[
                  { icon: Shield, label: 'MFA + SSO on every account' },
                  { icon: Lock, label: 'AES-256 encryption at rest & in transit' },
                  { icon: Check, label: 'Immutable audit trail on every ledger action' },
                  { icon: Globe, label: 'ASPE · IFRS · GAAP · local tax regimes' },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent shrink-0">
                      <item.icon className="w-4 h-4" />
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3 grid grid-cols-2 gap-4">
              {[
                { title: 'Streamlined Accounting', body: 'Automated journals, invoices, statements across every entity.', image: featureStreamlinedAccounting },
                { title: 'Multi-Country Compliance', body: 'ASPE, IFRS, and local standards, natively supported.', image: featureMultiCountryCompliance },
                { title: 'Security & Data Protection', body: 'MFA plus server-side encryption on every record.', image: featureSecurityProtection },
                { title: 'Alice AI Oversight', body: 'Real-time anomaly detection and audit-ready recommendations.', image: aliceBackground },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative h-28 overflow-hidden">
                    <img src={c.image} alt={c.title} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-semibold text-foreground mb-1">{c.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="relative max-w-6xl mx-auto overflow-hidden rounded-3xl border border-accent/20 shadow-2xl" style={{ background: 'var(--gradient-hero)' }}>
            {/* Ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(50% 60% at 80% 30%, hsl(172 66% 45% / 0.35), transparent 70%)' }}
            />
            <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{
              backgroundImage: 'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse at 20% 50%, black 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 20% 50%, black 20%, transparent 70%)',
            }} />
            <div className="relative grid md:grid-cols-5 gap-10 p-10 md:p-16 items-center">
              <div className="md:col-span-3 text-left">
                <Badge variant="secondary" className="mb-5 bg-accent/15 text-accent border-accent/30 backdrop-blur-sm">
                  Start in minutes · No credit card
                </Badge>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-[1.05] tracking-tight">
                  Bring your finance stack into <span className="gradient-text">one intelligent platform.</span>
                </h2>
                <p className="text-base md:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
                  Replace fragmented tools with a compliant, AI-assisted suite trusted by finance teams across 15+ countries.
                </p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-8 text-sm text-white/85">
                  {[
                    '14-day free trial',
                    'Migration assistance included',
                    'SOC 2-grade security',
                    'Cancel anytime',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/signup">
                    <Button
                      size="lg"
                      className="group w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground shadow-glow transition-transform duration-150 ease-out active:scale-[0.97]"
                    >
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                  <Button
                    size="lg"
                    variant="outline"
                    className="group w-full sm:w-auto border-white/25 bg-white/5 text-white hover:bg-white/10 hover:border-white/50 backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.97]"
                  >
                    Talk to Sales
                    <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </div>
              {/* Right-side metric stack */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                {[
                  { value: '5,000+', label: 'Businesses' },
                  { value: '15+', label: 'Countries' },
                  { value: '$2B+', label: 'Payroll processed' },
                  { value: '99.9%', label: 'Uptime SLA' },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                    <div className="text-2xl md:text-3xl font-bold text-accent tabular-nums leading-none">
                      {s.value}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-wider text-white/60">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="relative border-t border-border py-12 overflow-hidden" style={{ backgroundColor: 'hsl(222 47% 11%)' }}>
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${footerBackground})` }}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={landingLogo} alt="efinsuite Globe" className="w-8 h-8 object-contain" />
                <span className="font-bold text-white">efinsuite Globe</span>
              </div>
              <p className="text-sm text-white/70">
                AI-Powered Cloud-Based Multi-Organization Accounting & Business Management.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#features" className="hover:text-accent">Features</a></li>
                <li><a href="#pricing" className="hover:text-accent">Pricing</a></li>
                <li><a href="#" className="hover:text-accent">Integrations</a></li>
                <li><a href="#" className="hover:text-accent">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="https://www.efintax.biz" target="_blank" rel="noopener noreferrer" className="hover:text-accent">About</a></li>
                <li><a href="https://www.efintax.biz" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Blog</a></li>
                <li><a href="https://www.efintax.biz" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Careers</a></li>
                <li><a href="https://www.efintax.biz" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Contact</a></li>
                <li>
                  <a href="https://www.linkedin.com/company/110252262/admin/dashboard/" target="_blank" rel="noopener noreferrer" className="hover:text-accent flex items-center gap-1">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/privacy-policy" className="hover:text-accent">Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className="hover:text-accent">Terms of Service</Link></li>
                <li><Link to="/security" className="hover:text-accent">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 mt-12 pt-8 text-center text-sm text-white/60">
            © 2026 efinsuite Globe. All rights reserved.
          </div>
        </div>
      </footer>
      {/* Floating Market Widget */}
      <FloatingMarketWidget />
      {/* Alice Chat Widget */}
      <LandingChatWidget />
    </div>
  );
}

function DifferentiatorsSection() {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const differentiators = [
    {
      icon: ArrowLeftRight,
      title: 'Two-way money movement',
      body: 'Collect from customers and pay vendors, payroll, and taxes from the same ledger — most tools only do one side.',
      proof: 'AR + AP + payroll in one ledger',
    },
    {
      icon: Sparkles,
      title: 'Alice AI, on your ledger',
      body: 'A domain-trained assistant that reads your books — answers tax, close, and reporting questions in seconds, not weeks.',
      proof: 'Saves teams 12–15 hrs/week',
    },
    {
      icon: Globe,
      title: '15+ countries, one platform',
      body: 'ASPE, IFRS, GAAP, VAT, GST/HST, T4, P11D — localized filings and payroll built in, not bolted on.',
      proof: 'CA · US · UK · EU · MEA · APAC',
    },
    {
      icon: Lock,
      title: 'Enterprise-grade security',
      body: 'MFA, encrypted-at-rest data, audit trails, and RBAC by default. Compliance you can present to your board.',
      proof: 'SOC 2-grade controls',
    },
  ];

  return (
    <section ref={ref} className="relative py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className={`reveal-child ${inView ? 'is-in' : ''}`} style={{ transitionDelay: '0ms' }}>
            <Badge variant="outline" className="mb-4 border-accent/30 text-accent bg-accent/5">
              Why efinsuite Globe
            </Badge>
          </div>
          <h2
            className={`reveal-child ${inView ? 'is-in' : ''} text-3xl md:text-5xl font-bold text-foreground mb-5 tracking-tight leading-[1.1]`}
            style={{ transitionDelay: '80ms' }}
          >
            Built for finance teams that outgrew their spreadsheets
          </h2>
          <p
            className={`reveal-child ${inView ? 'is-in' : ''} text-lg text-muted-foreground leading-relaxed`}
            style={{ transitionDelay: '160ms' }}
          >
            Four pillars that separate us from generic accounting tools — each one requested by real finance leaders operating across borders.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {differentiators.map((d, i) => (
            <div
              key={d.title}
              className={`diff-card reveal-child ${inView ? 'is-in' : ''} group relative rounded-2xl border border-border/60 bg-card p-6 hover:border-accent/40 hover:shadow-lg`}
              style={{ transitionDelay: `${220 + i * 70}ms` }}
            >
              <div className="diff-icon flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 text-accent mb-5">
                <d.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2 tracking-tight">
                {d.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {d.body}
              </p>
              <div className="pt-4 border-t border-border/60 text-xs font-medium text-accent uppercase tracking-wider">
                {d.proof}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
