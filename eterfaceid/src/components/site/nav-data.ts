export type NavLink = {
  label: string;
  to: string;
  blurb?: string;
};

export type NavGroup = {
  heading: string;
  links: NavLink[];
};

export const solutionsGroup: NavGroup = {
  heading: "Solutions",
  links: [
    {
      label: "Person Verification",
      to: "/solutions/person-verification",
      blurb: "Document, biometric and data checks for individuals",
    },
    {
      label: "Business Verification",
      to: "/solutions/business-verification",
      blurb: "Registry, status and beneficial ownership for entities",
    },
    {
      label: "AML Screening & Monitoring",
      to: "/solutions/aml-screening",
      blurb: "Sanctions, PEP, watchlists and ongoing rescreening",
    },
    {
      label: "Fraud & Risk Intelligence",
      to: "/solutions/fraud-risk",
      blurb: "Device, network, email and phone risk signals",
    },
  ],
};

export const platformGroup: NavGroup = {
  heading: "Risk Intelligence",
  links: [
    { label: "Sanctions & watchlists", to: "/solutions/aml-screening" },
    { label: "PEPs & RCAs", to: "/solutions/aml-screening" },
    { label: "Adverse media", to: "/solutions/aml-screening" },
    { label: "Device & network risk", to: "/solutions/fraud-risk" },
    { label: "Email & phone risk", to: "/solutions/fraud-risk" },
  ],
};

export const resourcesGroup: NavGroup = {
  heading: "Resources",
  links: [
    { label: "Developers & API", to: "/developers" },
    { label: "Industries", to: "/industries" },
    { label: "Compliance", to: "/compliance" },
    { label: "Pricing", to: "/pricing" },
  ],
};

export const companyGroup: NavGroup = {
  heading: "Company",
  links: [
    { label: "About us", to: "/about" },
    { label: "Careers", to: "/careers" },
    { label: "Contact us", to: "/contact" },
  ],
};

export const megaMenu: NavGroup[] = [
  solutionsGroup,
  platformGroup,
  resourcesGroup,
  companyGroup,
];

export const industries = [
  {
    name: "Fintech",
    summary:
      "Onboard consumers and businesses in minutes while meeting FINTRAC identity and record-keeping obligations from day one.",
  },
  {
    name: "Money services businesses",
    summary:
      "Registration-ready identity, screening and retention controls for remittance, FX and dealing-in-virtual-currency operations.",
  },
  {
    name: "Payment service providers",
    summary:
      "Evidence of end-user identification and risk management aligned with Bank of Canada RPAA registration expectations.",
  },
  {
    name: "Lending & credit",
    summary:
      "Verify applicants and their businesses, catch synthetic identities, and keep a defensible decision trail per file.",
  },
  {
    name: "Digital assets",
    summary:
      "Sanctions and PEP screening with continuous rescreening for exchanges, custodians and wallet providers.",
  },
  {
    name: "Marketplaces & gig platforms",
    summary:
      "Prove sellers and contractors are who they claim to be without adding friction for good users.",
  },
  {
    name: "Real estate & legal",
    summary:
      "Entity verification and beneficial ownership tracing for transactions with reporting obligations.",
  },
  {
    name: "Insurance",
    summary:
      "Applicant verification and fraud signals at quote, bind and claim, with a shared audit history.",
  },
];
