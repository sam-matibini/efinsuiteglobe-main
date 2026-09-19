export type ModuleKey = "kyc" | "kyb" | "aml" | "fraud";

export type FrameworkRow = {
  region: string;
  law: string;
  authority: string;
  citation: string;
  covers: string[];
};

export const MODULE_TITLES: Record<ModuleKey, string> = {
  kyc: "Person verification (KYC)",
  kyb: "Business verification (KYB)",
  aml: "AML screening and monitoring",
  fraud: "Fraud and risk intelligence",
};

export const MODULE_CAPABILITIES: Record<ModuleKey, string[]> = {
  kyc: [
    "Identity document checks (machine-readable zone, check digits, provincial formats, expiry)",
    "Biometric verification (liveness challenge, face-to-document review)",
    "Address verification (format, postal/region consistency, document cross-check)",
    "Age and date-of-birth validation",
  ],
  kyb: [
    "Registry lookup and entity status",
    "Shareholding and control structure",
    "Beneficial owner extraction at the 25% threshold",
    "Aggregated and indirect control, including the 50% ownership rule",
  ],
  aml: [
    "Sanctions screening against consolidated official lists",
    "Politically exposed person and head-of-international-organisation screening",
    "Adverse media scanning",
    "Ongoing rescreening when lists change",
    "Transaction monitoring with reportable-threshold detection",
  ],
  fraud: [
    "Device fingerprinting",
    "Network and connection risk (datacentre, VPN, Tor, country mismatch)",
    "Email and phone intelligence",
    "Behavioural analytics (velocity, deviation from normal activity)",
  ],
};

export const COMPLIANCE_MAP: Record<ModuleKey, FrameworkRow[]> = {
  kyc: [
    {
      region: "Global",
      law: "FATF Recommendation 10 — Customer Due Diligence",
      authority: "FATF",
      citation: "FATF R.10",
      covers: ["Identify and verify the customer", "Risk-based verification depth", "Record keeping"],
    },
    {
      region: "Canada",
      law: "PCMLTFA and the PCMLTFR identity verification methods",
      authority: "FINTRAC",
      citation: "PCMLTFA s.6; PCMLTFR Part 6",
      covers: ["Government photo ID method", "Credit file method", "Dual-process method", "5-year record retention"],
    },
    {
      region: "European Union",
      law: "AMLR (EU) 2024/1624 — unified customer due diligence standards",
      authority: "AMLA / national supervisors",
      citation: "AMLR Arts. 20-25",
      covers: ["Harmonised identification data", "Electronic identification means", "Enhanced due diligence triggers"],
    },
    {
      region: "United States",
      law: "Bank Secrecy Act and the FinCEN Customer Due Diligence Rule",
      authority: "FinCEN",
      citation: "31 CFR 1010.230; 31 CFR 1020.220",
      covers: ["Customer identification programme", "Identity verification", "Risk profile"],
    },
    {
      region: "Africa",
      law: "National AML acts — FICA (South Africa), POCAMLA (Kenya), AMLA 2022 (Nigeria)",
      authority: "FIC / FRC / SCUML and national FIUs",
      citation: "FICA s.21; POCAMLA; AMLA 2022",
      covers: ["Customer identification and verification", "Risk-based CDD", "Record keeping"],
    },
  ],
  kyb: [
    {
      region: "Global",
      law: "FATF Recommendations 24 and 25 — beneficial ownership of legal persons and arrangements",
      authority: "FATF",
      citation: "FATF R.24, R.25",
      covers: ["Adequate, accurate, up-to-date ownership data", "Control through other means", "Layered structures"],
    },
    {
      region: "Canada",
      law: "PCMLTFA beneficial ownership requirements and the federal CBCA register",
      authority: "FINTRAC / Corporations Canada",
      citation: "PCMLTFR s.138; CBCA s.21.1",
      covers: ["25% ownership or control", "Confirm the accuracy of the information", "Directors and officers"],
    },
    {
      region: "European Union",
      law: "AMLR / AMLD6 beneficial ownership registers",
      authority: "National UBO registers",
      citation: "AMLR Arts. 51-57",
      covers: ["25% plus one share threshold", "Indirect and multi-layer holdings", "Register discrepancy reporting"],
    },
    {
      region: "United States",
      law: "Corporate Transparency Act beneficial ownership reporting",
      authority: "FinCEN BOI registry",
      citation: "31 USC 5336; 31 CFR 1010.380",
      covers: ["25% ownership interest", "Substantial control", "Company applicant"],
    },
    {
      region: "Africa",
      law: "National beneficial ownership registries",
      authority: "Kenya BRS, South Africa CIPC, Nigeria CAC (PSC register)",
      citation: "Companies Acts and BO regulations",
      covers: ["Register of persons with significant control", "Filing and update duties"],
    },
  ],
  aml: [
    {
      region: "Global",
      law: "FATF Recommendations 6, 7 and 20 — targeted financial sanctions and suspicious transaction reporting",
      authority: "FATF",
      citation: "FATF R.6, R.7, R.20",
      covers: ["Sanctions screening without delay", "Suspicious transaction reporting", "Ongoing monitoring"],
    },
    {
      region: "Canada",
      law: "Canadian sanctions regime and FINTRAC reporting",
      authority: "Global Affairs Canada, OSFI, FINTRAC",
      citation: "SEMA, JVCFOA, FACFOA, Criminal Code s.83.05; PCMLTFA Part 2",
      covers: [
        "Consolidated Canadian sanctions screening",
        "Suspicious transaction reports",
        "Large cash transaction reports at CAD 10,000",
        "Electronic funds transfer reports at CAD 10,000",
      ],
    },
    {
      region: "European Union",
      law: "EU consolidated financial sanctions list and AMLR monitoring duties",
      authority: "European Commission / national competent authorities",
      citation: "Council Reg. 2580/2001, 881/2002; AMLR Arts. 69-71",
      covers: ["Consolidated list screening", "Asset freeze obligations", "Suspicious transaction reporting"],
    },
    {
      region: "United States",
      law: "OFAC sanctions programmes, the 50 Percent Rule, and BSA/PATRIOT Act reporting",
      authority: "OFAC / FinCEN",
      citation: "31 CFR Part 501; OFAC Rev. 2014 50% Rule; 31 CFR 1020.320",
      covers: [
        "SDN and consolidated list screening",
        "Blocked ownership at 50% aggregated",
        "Suspicious activity reports",
        "Currency transaction reports at USD 10,000",
      ],
    },
    {
      region: "Africa",
      law: "National sanctions lists and FIU reporting duties",
      authority: "National FIUs (FIC, FRC, NFIU)",
      citation: "FICA s.28-29; POCAMLA; AMLA 2022",
      covers: ["UN and domestic list screening", "Cash threshold reporting", "Suspicious transaction reporting"],
    },
  ],
  fraud: [
    {
      region: "Global",
      law: "FATF Recommendation 1 — risk-based approach",
      authority: "FATF",
      citation: "FATF R.1",
      covers: ["Documented risk assessment", "Risk scoring and mitigation", "Higher-risk escalation"],
    },
    {
      region: "Canada",
      law: "OSFI and FINTRAC risk management expectations",
      authority: "OSFI / FINTRAC",
      citation: "OSFI B-13 and E-21; PCMLTFR compliance programme",
      covers: ["Technology and cyber risk", "Operational and fraud risk controls", "Two-year effectiveness review"],
    },
    {
      region: "European Union",
      law: "AMLR risk scoring and enhanced due diligence requirements",
      authority: "AMLA",
      citation: "AMLR Arts. 16-19",
      covers: ["Business-wide risk assessment", "Customer risk profiling", "Enhanced measures for higher risk"],
    },
    {
      region: "United States",
      law: "FFIEC authentication and fraud guidance (adjacent to BSA/AML)",
      authority: "FFIEC member agencies",
      citation: "FFIEC Authentication and Access Guidance",
      covers: ["Layered security", "Device and session risk", "Anomaly detection"],
    },
    {
      region: "Africa",
      law: "National AML risk frameworks and FIU guidance",
      authority: "National FIUs and central banks",
      citation: "Risk-based supervision frameworks",
      covers: ["Risk rating of customers", "Ongoing monitoring", "Escalation and reporting"],
    },
  ],
};
