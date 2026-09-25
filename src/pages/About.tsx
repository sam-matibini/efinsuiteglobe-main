import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, Globe, Heart } from 'lucide-react';

import { LandingNav } from '@/components/landing/LandingNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const values = [
  {
    icon: ShieldCheck,
    title: 'Accuracy & Compliance',
    desc: 'Double-entry integrity, audit trails, and country-specific compliance are non-negotiable defaults, not add-ons.',
  },
  {
    icon: Sparkles,
    title: 'AI That Assists',
    desc: 'Alice AI accelerates the work, but every posting stays reviewable, explainable, and reversible by a human.',
  },
  {
    icon: Globe,
    title: 'Global by Design',
    desc: 'Built from day one for multi-entity, multi-currency, and multi-jurisdiction operations across 15+ countries.',
  },
  {
    icon: Heart,
    title: 'Customer Trust',
    desc: 'Your books, your data. Transparent pricing, strong security, and support that answers when it matters.',
  },
];

export default function About() {
  return (
    <>
      <Helmet>
        <title>About — efinsuite Globe</title>
        <meta
          name="description"
          content="Learn about efinsuite Globe: our mission to bring AI-powered, multi-country accounting to modern businesses, firms, and non-profits."
        />
        <meta property="og:title" content="About — efinsuite Globe" />
        <meta
          property="og:description"
          content="Our mission, what we stand for, and who we serve at efinsuite Globe."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <LandingNav />

        <main>
          {/* Hero */}
          <section className="container mx-auto px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-4">
              About efinsuite Globe
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground max-w-3xl mx-auto">
              AI-powered accounting, built for how modern businesses actually operate.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              We help small businesses, accounting firms, and non-profits run their finances with the
              accuracy of an enterprise ERP and the speed of a modern SaaS product.
            </p>
          </section>

          {/* Mission */}
          <section className="container mx-auto px-6 py-12 md:py-16">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                To democratize AI-powered, multi-country accounting — so that every organization,
                regardless of size, can close their books faster, comply with confidence, and make
                better decisions with real-time financial insight.
              </p>
            </div>
          </section>

          {/* Values */}
          <section className="bg-muted/30 py-16 md:py-20">
            <div className="container mx-auto px-6">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">What We Stand For</h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                  The principles that guide every product decision we make.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
                {values.map((v) => (
                  <Card key={v.title} className="border-border/60">
                    <CardContent className="p-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent mb-4">
                        <v.icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-2">{v.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Who we serve */}
          <section className="container mx-auto px-6 py-16 md:py-20">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Who We Serve</h2>
              <p className="text-muted-foreground leading-relaxed">
                From growing small and mid-sized businesses managing multi-entity operations, to
                accounting and advisory firms running practice-wide engagements, to non-profits
                producing CRA-compliant donation receipts — efinsuite Globe is the single platform
                that scales with the way you work.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="container mx-auto px-6 pb-24">
            <div className="max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Ready to see it in action?
              </h2>
              <p className="text-muted-foreground mb-6">
                Talk to our team or start your free trial in minutes.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link to="/contact">
                  <Button size="lg">Talk to us</Button>
                </Link>
                <Link to="/signup">
                  <Button size="lg" variant="outline">Get started</Button>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
