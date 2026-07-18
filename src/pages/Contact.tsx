import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Clock, MessageSquare, Send, Linkedin } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { LandingNav } from '@/components/landing/LandingNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  email: z.string().trim().email('Enter a valid email').max(255),
  subject: z.string().trim().min(1, 'Subject is required').max(150, 'Subject must be under 150 characters'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Message must be under 2000 characters'),
});

type ContactForm = z.infer<typeof contactSchema>;

const initial: ContactForm = { name: '', email: '', subject: '', message: '' };

export default function Contact() {
  const { toast } = useToast();
  const [form, setForm] = useState<ContactForm>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const update = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ContactForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactForm;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact-message', {
        body: { ...parsed.data, website: honeypot },
      });
      if (error) {
        let details = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            details = await error.context.text();
          } catch {
            /* ignore */
          }
        }
        console.error('send-contact-message failed:', details);
        toast({
          title: 'Could not send message',
          description: 'Please try again in a moment, or email support@efin.money directly.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Message sent',
        description: "Thanks! We'll reply within one business day.",
      });
      setForm(initial);
      setHoneypot('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Contact — efinsuite Globe</title>
        <meta
          name="description"
          content="Get in touch with efinsuite Globe. Book a demo, talk to sales, or reach support — we reply within one business day."
        />
        <link rel="canonical" href="/contact" />
        <meta property="og:title" content="Contact — efinsuite Globe" />
        <meta property="og:description" content="Book a demo, talk to sales, or reach support at efinsuite Globe." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <div className="sticky top-0 z-50">
        <LandingNav />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary via-primary to-background text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="container mx-auto px-6 py-20 md:py-28 relative">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block text-xs uppercase tracking-[0.2em] text-accent mb-4">
              Get in touch
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
              We'd love to hear from you.
            </h1>
            <p className="text-lg md:text-xl text-white/75">
              Book a demo, talk to sales, or ask us anything — our team replies within one business day.
            </p>
          </div>
        </div>
      </section>

      {/* Form + Info */}
      <section className="container mx-auto px-6 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 max-w-6xl mx-auto">
          {/* Info column */}
          <div className="space-y-6">
            <InfoBlock
              icon={<Mail className="w-5 h-5" />}
              title="Email us"
              body={
                <a href="mailto:support@efin.money" className="text-foreground hover:text-accent">
                  support@efin.money
                </a>
              }
            />
            <InfoBlock
              icon={<Clock className="w-5 h-5" />}
              title="Response time"
              body="We usually reply within one business day."
            />
            <InfoBlock
              icon={<MessageSquare className="w-5 h-5" />}
              title="In-app support"
              body="Signed in? Message us from the envelope in your dashboard header for a tracked conversation."
            />
            <InfoBlock
              icon={<Linkedin className="w-5 h-5" />}
              title="Follow along"
              body={
                <a
                  href="https://www.linkedin.com/company/110252262/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-accent"
                >
                  LinkedIn
                </a>
              }
            />
          </div>

          {/* Form column */}
          <Card className="border-border/60 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Honeypot: hidden from users, catches bots */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', opacity: 0 }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      maxLength={100}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      maxLength={255}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="How can we help?"
                    value={form.subject}
                    onChange={(e) => update('subject', e.target.value)}
                    maxLength={150}
                    aria-invalid={!!errors.subject}
                  />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us a bit more…"
                    rows={6}
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    maxLength={2000}
                    aria-invalid={!!errors.message}
                  />
                  {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitting ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Simple footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} efinsuite Globe. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/landing" className="hover:text-foreground">Home</Link>
            <Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms-of-service" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InfoBlock({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="text-sm text-muted-foreground mt-1">{body}</div>
      </div>
    </div>
  );
}
