import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Database, Globe, Cookie, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PrivacyPolicy = () => {
  const sections = [
    { id: "introduction", title: "1. Introduction and Scope", icon: FileText },
    { id: "information", title: "2. Information We Collect", icon: Database },
    { id: "use", title: "3. How We Use Your Information", icon: Eye },
    { id: "legal-basis", title: "4. Legal Basis for Processing", icon: Shield },
    { id: "sharing", title: "5. Data Sharing and Disclosure", icon: Globe },
    { id: "retention", title: "6. Data Retention", icon: Lock },
    { id: "rights", title: "7. Your Rights", icon: Shield },
    { id: "security", title: "8. Security Measures", icon: Lock },
    { id: "cookies", title: "9. Cookies and Tracking", icon: Cookie },
    { id: "third-party", title: "10. Third-Party Services", icon: Globe },
    { id: "international", title: "11. International Data Transfers", icon: Globe },
    { id: "children", title: "12. Children's Privacy", icon: Shield },
    { id: "changes", title: "13. Changes to Privacy Policy", icon: FileText },
    { id: "contact", title: "14. Contact Information", icon: Mail },
  ];

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
            <h1 className="text-lg font-semibold">Privacy Policy</h1>
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 md:px-6 max-w-4xl mx-auto">
        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">eFinsuite Globe / eFinTax Advisors Ltd (Canada)</p>
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm text-muted-foreground">
            <span>Effective Date: February 6, 2026</span>
            <span>•</span>
            <span>Last Updated: February 6, 2026</span>
          </div>
        </div>

        {/* Table of Contents */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
            <nav className="grid gap-2 sm:grid-cols-2">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors p-2 rounded-md hover:bg-muted"
                >
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </a>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content Sections */}
        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          {/* Section 1 */}
          <section id="introduction">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              1. Introduction and Scope
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              eFinTax Advisors Ltd ("we," "us," or "our") is committed to protecting the privacy and security of your personal information. This Privacy Policy describes how we collect, use, and disclose personal data when you use our website, engage our financial and tax advisory services, or interact with us.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We provide specialized financial advisory services across diverse industries including FinTech, Information Technology (I.T), healthcare, automotive, transportation, hospitality, equipment and property rental, and construction. We understand the unique nature of data within these sectors and adhere to strict confidentiality standards.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              This policy applies to all clients, prospective clients, website visitors, and other individuals whose personal data we process in the course of our business operations.
            </p>
          </section>

          <Separator />

          {/* Section 2 */}
          <section id="information">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-primary" />
              2. Information We Collect
            </h2>
            <p className="text-muted-foreground mb-4">
              Depending on your interaction with us and the services we provide, we may collect the following categories of information:
            </p>
            
            <h3 className="text-lg font-medium mt-6 mb-3">2.1 Personal Identification Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Full name, title, and gender</li>
              <li>Contact details including mailing address, email address, and telephone numbers</li>
              <li>Date of birth, nationality, and passport or national ID details (for KYC/AML compliance)</li>
            </ul>

            <h3 className="text-lg font-medium mt-6 mb-3">2.2 Financial and Business Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Tax identification numbers (SIN/BN), Social Insurance Numbers, or Social Security numbers</li>
              <li>Bank account details, payment card information, and transaction history</li>
              <li>Income details, asset documentation, and investment portfolios</li>
              <li>Business incorporation documents, shareholder registers, and director details</li>
              <li>Sector-specific data relevant to our advisory services (e.g., healthcare practice financials, construction project budgets, I.T. infrastructure costs)</li>
            </ul>

            <h3 className="text-lg font-medium mt-6 mb-3">2.3 Technical and Usage Data</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>IP address, browser type and version, time zone setting, and location</li>
              <li>Operating system, platform, and other technology on the devices you use to access our website</li>
              <li>Information about how you use our website and services</li>
            </ul>
          </section>

          <Separator />

          {/* Section 3 */}
          <section id="use">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Eye className="h-5 w-5 text-primary" />
              3. How We Use Your Information
            </h2>
            <p className="text-muted-foreground mb-4">We use your personal data for the following purposes:</p>
            <ul className="space-y-3 text-muted-foreground ml-4">
              <li><strong className="text-foreground">Service Delivery:</strong> To provide financial, tax, and business advisory services tailored to your specific industry needs.</li>
              <li><strong className="text-foreground">Client Onboarding:</strong> To verify your identity and conduct due diligence checks required by law (Anti-Money Laundering and Know Your Customer regulations).</li>
              <li><strong className="text-foreground">Communication:</strong> To respond to inquiries, send administrative information, and provide updates regarding your accounts or projects.</li>
              <li><strong className="text-foreground">Billing and Payments:</strong> To process invoices and manage financial transactions.</li>
              <li><strong className="text-foreground">Marketing:</strong> To send newsletters or information about services we believe may be of interest to you (you may opt-out at any time).</li>
              <li><strong className="text-foreground">Legal Compliance:</strong> To comply with applicable laws, regulations, and court orders.</li>
            </ul>
          </section>

          <Separator />

          {/* Section 4 */}
          <section id="legal-basis">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              4. Legal Basis for Processing
            </h2>
            <p className="text-muted-foreground mb-4">
              We process your personal data under the following legal bases pursuant to the Personal Information Protection and Electronic Documents Act (PIPEDA) and other applicable Canadian privacy laws:
            </p>
            <ul className="space-y-3 text-muted-foreground ml-4">
              <li><strong className="text-foreground">Consent:</strong> We collect, use, and disclose your personal information only with your knowledge and consent, except where permitted or required by law.</li>
              <li><strong className="text-foreground">Performance of a Contract:</strong> Where processing is necessary for the performance of a contract to which you are a party or to take steps at your request prior to entering into a contract.</li>
              <li><strong className="text-foreground">Legal Obligation:</strong> Where processing is necessary for compliance with a legal obligation to which we are subject (e.g., CRA tax reporting, FINTRAC anti-money laundering laws).</li>
              <li><strong className="text-foreground">Legitimate Interests:</strong> Where processing is necessary for our legitimate interests (or those of a third party), provided your fundamental rights do not override those interests.</li>
            </ul>
          </section>

          <Separator />

          {/* Section 5 */}
          <section id="sharing">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              5. Data Sharing and Disclosure
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong className="text-foreground">We do not sell your personal data.</strong> We may share your information with:
            </p>
            <ul className="space-y-3 text-muted-foreground ml-4">
              <li><strong className="text-foreground">Service Providers:</strong> Third-party vendors who provide IT support, cloud storage, payment processing, or auditing services. All providers are bound by confidentiality agreements.</li>
              <li><strong className="text-foreground">Professional Advisers:</strong> Lawyers, bankers, auditors, and insurers who provide consultancy, banking, legal, insurance, and accounting services.</li>
              <li><strong className="text-foreground">Regulatory Authorities:</strong> Tax authorities (such as CRA - Canada Revenue Agency), FINTRAC, provincial regulators, and other government bodies when required by law.</li>
              <li><strong className="text-foreground">Business Transfers:</strong> Third parties to whom we may choose to sell, transfer, or merge parts of our business or our assets.</li>
            </ul>
          </section>

          <Separator />

          {/* Section 6 */}
          <section id="retention">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-primary" />
              6. Data Retention
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Generally, we retain client data for a minimum of 6 to 7 years after the end of the client relationship to comply with tax and limitation periods for legal claims. Once the retention period expires, your data will be securely deleted or anonymized.
            </p>
          </section>

          <Separator />

          {/* Section 7 */}
          <section id="rights">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              7. Your Rights
            </h2>
            <p className="text-muted-foreground mb-4">Under data protection laws, you have specific rights regarding your personal data:</p>
            <ul className="space-y-3 text-muted-foreground ml-4">
              <li><strong className="text-foreground">Right to Access:</strong> You have the right to request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Right to Rectification:</strong> You have the right to request correction of any incomplete or inaccurate data we hold about you.</li>
              <li><strong className="text-foreground">Right to Erasure (Right to be Forgotten):</strong> You have the right to ask us to delete or remove personal data where there is no good reason for us continuing to process it.</li>
              <li><strong className="text-foreground">Right to Restriction:</strong> You have the right to ask us to suspend the processing of your personal data.</li>
              <li><strong className="text-foreground">Right to Data Portability:</strong> You have the right to request the transfer of your personal data to you or to a third party.</li>
              <li><strong className="text-foreground">Right to Object:</strong> You have the right to object to the processing of your personal data where we are relying on a legitimate interest.</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise any of these rights, please contact us using the details provided in Section 14.
            </p>
          </section>

          <Separator />

          {/* Section 8 */}
          <section id="security">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-primary" />
              8. Security Measures
            </h2>
            <p className="text-muted-foreground mb-4">
              We have implemented appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed. These measures include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Encryption of digital data</li>
              <li>Secure physical storage for hard-copy documents</li>
              <li>Access controls restricting data access to employees who have a business need to know</li>
              <li>Regular cybersecurity assessments and staff training</li>
            </ul>
          </section>

          <Separator />

          {/* Section 9 */}
          <section id="cookies">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Cookie className="h-5 w-5 text-primary" />
              9. Cookies and Tracking
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our website uses cookies to distinguish you from other users of our website. This helps us to provide you with a good experience when you browse our website and allows us to improve our site.
            </p>
            <p className="text-muted-foreground mt-4 mb-3">We use the following types of cookies:</p>
            <ul className="space-y-3 text-muted-foreground ml-4">
              <li><strong className="text-foreground">Strictly Necessary Cookies:</strong> Required for the operation of our website (e.g., secure login areas).</li>
              <li><strong className="text-foreground">Analytical/Performance Cookies:</strong> Allow us to recognize and count the number of visitors and see how visitors move around our website.</li>
              <li><strong className="text-foreground">Functionality Cookies:</strong> Used to recognize you when you return to our website.</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You can set your browser to refuse all or some browser cookies, or to alert you when websites set or access cookies.
            </p>
          </section>

          <Separator />

          {/* Section 10 */}
          <section id="third-party">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              10. Third-Party Services
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our website may include links to third-party websites, plug-ins, and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements. When you leave our website, we encourage you to read the privacy policy of every website you visit.
            </p>
          </section>

          <Separator />

          {/* Section 11 */}
          <section id="international">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              11. International Data Transfers
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may transfer your personal data outside of Canada. Whenever we transfer your personal data internationally, we ensure a similar degree of protection is afforded to it in accordance with PIPEDA requirements by ensuring at least one of the following safeguards is implemented:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4 ml-4">
              <li>We will only transfer your personal data to jurisdictions that have been deemed to provide an adequate level of protection for personal data under Canadian privacy law.</li>
              <li>Where we use certain service providers, we require contractual commitments ensuring personal data receives substantially similar protection to that afforded under Canadian law.</li>
              <li>We remain accountable for personal information transferred to third parties for processing, as required under PIPEDA.</li>
            </ul>
          </section>

          <Separator />

          {/* Section 12 */}
          <section id="children">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              12. Children's Privacy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not intended for children under the age of 16, and we do not knowingly collect data relating to children unless required for specific family tax planning services with parental consent.
            </p>
          </section>

          <Separator />

          {/* Section 13 */}
          <section id="changes">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              13. Changes to Privacy Policy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We keep our privacy policy under regular review. This version was last updated on February 6, 2026. Any changes we make to our privacy policy in the future will be posted on this page and, where appropriate, notified to you by email.
            </p>
          </section>

          <Separator />

          {/* Section 14 */}
          <section id="contact">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              14. Contact Information
            </h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about this privacy policy or our privacy practices, please contact our Privacy Officer:
            </p>
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">eFinTax Advisors Ltd (Canada)</p>
                  <p className="text-muted-foreground">
                    Website: <a href="https://efintax.biz/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://efintax.biz/</a>
                  </p>
                  <p className="text-muted-foreground">
                    Email: <a href="mailto:privacy@efintax.biz" className="text-primary hover:underline">privacy@efintax.biz</a>
                  </p>
                  <p className="text-muted-foreground">Registration Details: Federally Incorporated in Canada</p>
                </div>
              </CardContent>
            </Card>
            <p className="text-muted-foreground mt-4 text-sm">
              You also have the right to file a complaint with the <strong className="text-foreground">Office of the Privacy Commissioner of Canada (OPC)</strong> at <a href="https://www.priv.gc.ca" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.priv.gc.ca</a> if you believe your privacy rights have been violated.
            </p>
          </section>

          {/* Footer */}
          <div className="text-center pt-8 pb-4 text-sm text-muted-foreground">
            <p>© 2026 eFinTax Advisors Ltd (Canada). All rights reserved.</p>
            <p className="mt-1">Confidential & Proprietary Information</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
