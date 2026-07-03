import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, Users, Lock, CreditCard, Scale, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            eFinsuite – Terms of Service
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span><strong>Effective Date:</strong> February 6, 2026</span>
            <span><strong>By:</strong> eFintax Advisors Ltd</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Website:</strong>{' '}
            <a href="https://www.efinsuite.com" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              https://www.efinsuite.com
            </a>
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-muted/30 rounded-lg border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Table of Contents
          </h2>
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            {[
              '1. Acceptance of Terms',
              '2. Eligibility',
              '3. Account Registration',
              '4. Use of the App',
              '5. Intellectual Property',
              '6. Data Privacy',
              '7. Third-Party Integrations',
              '8. Payments and Fees',
              '9. Disclaimers',
              '10. Limitation of Liability',
              '11. Indemnification',
              '12. Termination',
              '13. Governing Law',
              '14. Changes to Terms',
              '15. Contact Information'
            ].map((item, index) => (
              <li key={index}>
                <a 
                  href={`#section-${index + 1}`} 
                  className="text-accent hover:underline"
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sections */}
        <div className="space-y-10">
          {/* Section 1 */}
          <section id="section-1">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              1. Acceptance of Terms
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                By accessing or using the eFinsuite accounting software ("software"), provided by eFintax Advisors Ltd 
                ("eFintax," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree, you must not use the App.
              </p>
              <p>
                These Terms apply to all users, including individuals, businesses, and organizations accessing the App.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="section-2">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              2. Eligibility
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                You must be at least 18 years old and legally capable of entering into binding agreements to use the App. 
                By using the App, you represent and warrant that you meet these eligibility requirements.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="section-3">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-accent" />
              3. Account Registration
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>To access certain features, you may need to create an account.</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>You agree to provide accurate, complete, and up-to-date information.</li>
                <li>You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.</li>
                <li>Notify us immediately of any unauthorized use of your account.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="section-4">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              4. Use of the App
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>You agree to use the App in compliance with applicable laws and regulations.</p>
              <p className="mt-4"><strong>You shall not:</strong></p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Reverse engineer, decompile, or attempt to extract source code from the App</li>
                <li>Use the App for illegal purposes</li>
                <li>Interfere with the App's security, operation, or integrity</li>
              </ul>
              <p className="mt-4">eFintax may suspend or terminate your access for violations of these Terms.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="section-5">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              5. Intellectual Property
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>The App, including all content, designs, software, and documentation, is owned by eFintax or its licensors.</li>
                <li>You are granted a limited, non-exclusive, non-transferable license to use the App for your personal or business purposes.</li>
                <li>No ownership rights or intellectual property rights are transferred to you.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="section-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-accent" />
              6. Data Privacy
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  eFintax collects and processes personal and financial data in accordance with our{' '}
                  <Link to="/privacy-policy" className="text-accent hover:underline">Privacy Policy</Link>.
                </li>
                <li>By using the App, you consent to such collection, processing, and storage of your information.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section id="section-7">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              7. Third-Party Integrations
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>The App may integrate with third-party services (e.g., Plaid).</li>
                <li>Your use of third-party services is subject to their terms and policies.</li>
                <li>eFintax is not responsible for third-party service functionality or privacy practices.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="section-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent" />
              8. Payments and Fees
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>Some features may require payment of fees.</li>
                <li>You agree to pay all applicable fees and taxes.</li>
                <li>Fees are non-refundable unless otherwise stated.</li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section id="section-9">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              9. Disclaimers
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>The App is provided "as is" and "as available."</li>
                <li>eFintax does not guarantee uninterrupted, error-free, or secure access.</li>
                <li>We disclaim all warranties, whether express or implied, including fitness for a particular purpose and merchantability.</li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section id="section-10">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-accent" />
              10. Limitation of Liability
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>To the maximum extent permitted by law, eFintax shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                <li>This includes, but is not limited to, loss of data, revenue, or profits arising from your use or inability to use the App.</li>
              </ul>
            </div>
          </section>

          {/* Section 11 */}
          <section id="section-11">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              11. Indemnification
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                You agree to indemnify, defend, and hold harmless eFintax, its officers, directors, employees, and affiliates 
                from any claims, damages, liabilities, costs, or expenses arising from your use of the App or violation of these Terms.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section id="section-12">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              12. Termination
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>eFintax may suspend or terminate your account at any time, with or without notice, for violation of these Terms or for operational or security reasons.</li>
                <li>Upon termination, your rights to use the App immediately cease.</li>
              </ul>
            </div>
          </section>

          {/* Section 13 */}
          <section id="section-13">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-accent" />
              13. Governing Law
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of Canada, without regard to conflict of law principles. 
                Any disputes shall be subject to the jurisdiction of the courts in Canada.
              </p>
            </div>
          </section>

          {/* Section 14 */}
          <section id="section-14">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              14. Changes to Terms
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ul className="list-disc pl-6 space-y-2">
                <li>eFintax may update these Terms from time to time.</li>
                <li>Changes will be communicated via the App or email.</li>
                <li>Continued use of the App constitutes acceptance of the updated Terms.</li>
              </ul>
            </div>
          </section>

          {/* Section 15 */}
          <section id="section-15">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" />
              15. Contact Information
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>For questions about these Terms or the software:</p>
              <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                <p><strong>eFintax Advisors Ltd</strong></p>
                <p className="mt-2">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:info@efintax.biz" className="text-accent hover:underline">info@efintax.biz</a>
                </p>
                <p className="mt-1">
                  <strong>Website:</strong>{' '}
                  <a href="https://www.efintax.biz" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
                    https://www.efintax.biz
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Back to top */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
