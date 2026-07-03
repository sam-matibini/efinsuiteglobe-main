import { Link } from 'react-router-dom';
import { LandingChatWidget } from '@/components/landing/LandingChatWidget';
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
  LineChart
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
      {/* Stock Market Ticker */}
      <div className="sticky top-0 z-50">
        <StockMarketTicker />
        {/* Navigation */}
        <nav className="bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={landingLogo} alt="efinsuite Globe" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold text-foreground">efinsuite Globe</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden" style={{ backgroundColor: 'hsl(222 47% 11%)' }}>
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBackground})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        <div className="relative container mx-auto px-6 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 bg-accent/20 text-accent-foreground border-accent/30">
              🤖 AI-Powered • ☁️ Cloud-Based • 🏢 Multi-Organization • 🌍 15+ Countries
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              <span className="text-accent">AI-Powered</span> Cloud-Based<br />
              Multi-Organization <span className="text-accent">Business Suite</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-3xl mx-auto">
              Efinsuite Globe is an AI-powered, cloud-based, multi-organization, and multi-country accounting and business management solution 
              designed to simplify financial operations and reporting for modern businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                  Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-accent bg-accent/20 text-accent hover:bg-accent/30 font-semibold">
                Book a Demo
              </Button>
            </div>
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
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
      <section id="testimonials" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trusted by businesses worldwide
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border/50">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-accent/30 shadow-sm">
                      <img src={testimonial.image} alt={testimonial.author} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Efinsuite Globe Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">🌐 Why Efinsuite Globe?</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              AI-Powered Cloud Platform for Modern Business
            </h2>
            <p className="text-lg text-muted-foreground">
              Efinsuite Globe empowers businesses with AI-driven insights, cloud-based multi-organization management, and seamless compliance across jurisdictions—
              all through a secure, scalable platform enhanced by Alice, your intelligent business assistant.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto shadow-md border border-accent/20">
                <img src={featureStreamlinedAccounting} alt="Streamlined Accounting" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-semibold text-foreground">Streamlined Accounting</h3>
              <p className="text-sm text-muted-foreground">Automate journal entries, invoices, and financial statements across multiple organizations.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto shadow-md border border-accent/20">
                <img src={featureMultiCountryCompliance} alt="Multi-Country Compliance" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-semibold text-foreground">Multi-Country Compliance</h3>
              <p className="text-sm text-muted-foreground">Supports ASPE, IFRS, and other local accounting standards across jurisdictions.</p>
            </div>
            <div id="security" className="text-center space-y-3 scroll-mt-24">
              <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto shadow-md border border-accent/20">
                <img src={featureSecurityProtection} alt="Security & Data Protection" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-semibold text-foreground">Security & Data Protection</h3>
              <p className="text-sm text-muted-foreground">
                Your security is our priority. eFinsuite uses Multi-Factor Authentication (MFA) to protect user accounts and prevent unauthorized access. 
                In addition, all user data is securely encrypted at the server side, ensuring confidentiality, integrity, and protection against unauthorized disclosure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <Card className="bg-primary border-0">
            <CardContent className="py-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to streamline your finances?
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                Join thousands of businesses across North America, Europe, Africa, Middle East, and Asia-Pacific using Efinsuite Globe. Start your free trial today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="border-accent bg-accent/20 text-accent hover:bg-accent/30 font-semibold">
                  Contact Sales
                </Button>
              </div>
            </CardContent>
          </Card>
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