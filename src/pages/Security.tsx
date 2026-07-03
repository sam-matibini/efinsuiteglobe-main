import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, KeyRound, ServerCog, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const Security = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-4 px-4 md:px-6">
          <Link to="/landing">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Security & Data Protection</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-10 px-4 md:px-6 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">Security & Data Protection</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your security is our priority. eFinsuite uses Multi-Factor Authentication (MFA) to protect user accounts
            and prevent unauthorized access. In addition, all user data is securely encrypted at the server side,
            ensuring confidentiality, integrity, and protection against unauthorized disclosure.
          </p>
        </div>

        <Separator />

        {/* Key Pillars */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground">Multi-Factor Authentication</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Every user account is protected with MFA, adding an extra layer of verification beyond passwords
                to prevent unauthorized access even if credentials are compromised.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <ServerCog className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground">Server-Side Encryption</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                All user data is encrypted at rest on the server side, ensuring that sensitive financial
                information remains confidential and protected against unauthorized disclosure.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground">Data Integrity</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Rigorous integrity checks ensure your financial records are accurate, tamper-proof, and
                compliant with regulatory standards at all times.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground">Access Controls</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Role-based access controls ensure that users only see and modify the data they are
                authorized to, with full audit trails for accountability.
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Commitment List */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Our Security Commitments</h3>
          <ul className="space-y-3">
            {[
              "End-to-end encryption for data in transit using TLS 1.2+",
              "Server-side encryption at rest for all stored data",
              "Multi-Factor Authentication (MFA) for all user accounts",
              "Regular security audits and vulnerability assessments",
              "Compliance with PIPEDA and applicable data protection regulations",
              "Automated threat detection and intrusion prevention",
              "Secure backup and disaster recovery procedures",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Contact */}
        <div className="text-center space-y-3 pb-8">
          <h3 className="text-lg font-semibold text-foreground">Questions about our security practices?</h3>
          <p className="text-sm text-muted-foreground">
            Contact us at{" "}
            <a href="mailto:info@efintax.biz" className="text-accent hover:underline">
              info@efintax.biz
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Security;
