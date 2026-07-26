// Comprehensive Industry Configuration for CoA Generation
// This file centralizes all industry definitions for use across the app

export interface IndustryConfig {
  value: string;
  label: string;
  description: string;
  icon: string;
  accountingFramework: 'ASPE' | 'ASNPO' | 'IFRS' | 'IFRS_SME';
  specializedAccounts: string[];
  cogsRequired: boolean;
  inventoryRequired: boolean;
}

// Master list of industries - sorted alphabetically by label
export const INDUSTRIES: IndustryConfig[] = [
  { value: 'accounting', label: 'Accounting & Bookkeeping', description: 'CPA firms, bookkeeping services', icon: 'Calculator', accountingFramework: 'ASPE', specializedAccounts: ['WIP', 'Client Trust'], cogsRequired: false, inventoryRequired: false },
  { value: 'advertising', label: 'Advertising & Marketing', description: 'Marketing agencies, PR firms', icon: 'Megaphone', accountingFramework: 'ASPE', specializedAccounts: ['Media Buys', 'Campaign Costs'], cogsRequired: false, inventoryRequired: false },
  { value: 'aerospace', label: 'Aerospace & Defense', description: 'Aviation, defense contractors', icon: 'Plane', accountingFramework: 'IFRS', specializedAccounts: ['R&D Capitalized', 'Government Contracts'], cogsRequired: true, inventoryRequired: true },
  { value: 'agriculture', label: 'Agriculture & Farming', description: 'Farms, ranches, agribusiness', icon: 'Wheat', accountingFramework: 'ASPE', specializedAccounts: ['Livestock', 'Crops Inventory', 'Farm Equipment'], cogsRequired: true, inventoryRequired: true },
  { value: 'arts_entertainment', label: 'Arts & Entertainment', description: 'Studios, venues, performers', icon: 'Music', accountingFramework: 'ASPE', specializedAccounts: ['Royalties', 'Production Costs'], cogsRequired: false, inventoryRequired: false },
  { value: 'automotive', label: 'Automotive', description: 'Auto parts, accessories', icon: 'Car', accountingFramework: 'ASPE', specializedAccounts: ['Parts Inventory', 'Warranty Reserve'], cogsRequired: true, inventoryRequired: true },
  { value: 'automotive_repairs', label: 'Automotive Repairs & Services', description: 'Auto shops, mechanics', icon: 'Wrench', accountingFramework: 'ASPE', specializedAccounts: ['Parts Inventory', 'Labor WIP', 'Sublet Repairs'], cogsRequired: true, inventoryRequired: true },
  { value: 'banking', label: 'Banking & Credit Unions', description: 'Financial institutions', icon: 'Landmark', accountingFramework: 'IFRS', specializedAccounts: ['Loan Portfolio', 'Deposits', 'Interest Income'], cogsRequired: false, inventoryRequired: false },
  { value: 'biotech', label: 'Biotechnology', description: 'Biotech research, pharmaceuticals', icon: 'Microscope', accountingFramework: 'IFRS', specializedAccounts: ['R&D Expenses', 'Clinical Trials', 'Patents'], cogsRequired: true, inventoryRequired: true },
  { value: 'car_dealers', label: 'Car Dealers', description: 'Vehicle sales, trade-ins, financing', icon: 'CarFront', accountingFramework: 'ASPE', specializedAccounts: ['Vehicle Inventory', 'Floor Plan Financing', 'Trade-In Allowance', 'F&I Income'], cogsRequired: true, inventoryRequired: true },
  { value: 'charity', label: 'Charity (Registered)', description: 'CRA/IRS registered charities', icon: 'Heart', accountingFramework: 'ASNPO', specializedAccounts: ['Donation Revenue', 'Restricted Funds', 'Endowment'], cogsRequired: false, inventoryRequired: false },
  { value: 'chemicals', label: 'Chemicals & Plastics', description: 'Chemical manufacturing', icon: 'FlaskConical', accountingFramework: 'ASPE', specializedAccounts: ['Raw Materials', 'Hazmat Compliance'], cogsRequired: true, inventoryRequired: true },
  { value: 'construction', label: 'Construction & Contracting', description: 'General contractors, builders', icon: 'HardHat', accountingFramework: 'ASPE', specializedAccounts: ['WIP Construction', 'Retainage', 'Job Costing'], cogsRequired: true, inventoryRequired: true },
  { value: 'consulting', label: 'Consulting & Advisory', description: 'Management consulting, advisory', icon: 'Users', accountingFramework: 'ASPE', specializedAccounts: ['WIP Consulting', 'Retainer Fees'], cogsRequired: false, inventoryRequired: false },
  { value: 'ecommerce', label: 'E-Commerce', description: 'Online retail, dropshipping', icon: 'ShoppingCart', accountingFramework: 'ASPE', specializedAccounts: ['Inventory', 'Shipping Costs', 'Platform Fees'], cogsRequired: true, inventoryRequired: true },
  { value: 'education', label: 'Education & Training', description: 'Schools, tutoring, e-learning', icon: 'GraduationCap', accountingFramework: 'ASPE', specializedAccounts: ['Tuition Revenue', 'Course Materials'], cogsRequired: false, inventoryRequired: false },
  { value: 'energy', label: 'Energy & Utilities', description: 'Power generation, utilities', icon: 'Zap', accountingFramework: 'IFRS', specializedAccounts: ['Utility Revenue', 'Asset Retirement Obligations'], cogsRequired: true, inventoryRequired: false },
  { value: 'engineering', label: 'Engineering', description: 'Engineering firms, design', icon: 'Ruler', accountingFramework: 'ASPE', specializedAccounts: ['Project WIP', 'Design Costs'], cogsRequired: false, inventoryRequired: false },
  { value: 'environmental', label: 'Environmental Services', description: 'Waste management, recycling', icon: 'Leaf', accountingFramework: 'ASPE', specializedAccounts: ['Environmental Liabilities', 'Remediation Costs'], cogsRequired: true, inventoryRequired: false },
  { value: 'fintech', label: 'Fintech', description: 'Financial technology, payments', icon: 'CreditCard', accountingFramework: 'IFRS', specializedAccounts: ['Transaction Fees', 'Float', 'Reserves'], cogsRequired: false, inventoryRequired: false },
  { value: 'food_beverage', label: 'Food & Beverage', description: 'Restaurants, food production', icon: 'UtensilsCrossed', accountingFramework: 'ASPE', specializedAccounts: ['Food Inventory', 'Beverage Inventory', 'Spoilage'], cogsRequired: true, inventoryRequired: true },
  { value: 'government', label: 'Government & Public Sector', description: 'Government agencies', icon: 'Building', accountingFramework: 'ASPE', specializedAccounts: ['Grant Revenue', 'Program Expenses'], cogsRequired: false, inventoryRequired: false },
  { value: 'healthcare', label: 'Healthcare & Medical', description: 'Medical practices, clinics', icon: 'Stethoscope', accountingFramework: 'ASPE', specializedAccounts: ['Patient Revenue', 'Insurance Receivables', 'Medical Supplies'], cogsRequired: true, inventoryRequired: true },
  { value: 'hospitality', label: 'Hospitality & Tourism', description: 'Hotels, travel agencies', icon: 'Hotel', accountingFramework: 'ASPE', specializedAccounts: ['Room Revenue', 'F&B Revenue', 'Deferred Deposits'], cogsRequired: true, inventoryRequired: true },
  { value: 'insurance', label: 'Insurance', description: 'Insurance companies, brokers', icon: 'Shield', accountingFramework: 'IFRS', specializedAccounts: ['Premiums', 'Claims Reserve', 'Unearned Premiums'], cogsRequired: false, inventoryRequired: false },
  { value: 'it_services', label: 'IT Services & Consulting', description: 'Software development, IT support', icon: 'Monitor', accountingFramework: 'ASPE', specializedAccounts: ['Project WIP', 'Maintenance Contracts'], cogsRequired: false, inventoryRequired: false },
  { value: 'legal', label: 'Legal Services', description: 'Law firms, legal consultants', icon: 'Scale', accountingFramework: 'ASPE', specializedAccounts: ['WIP Legal', 'Client Trust', 'Retainers'], cogsRequired: false, inventoryRequired: false },
  { value: 'logistics', label: 'Logistics & Supply Chain', description: 'Warehousing, distribution', icon: 'Warehouse', accountingFramework: 'ASPE', specializedAccounts: ['Freight Revenue', 'Warehouse Costs'], cogsRequired: true, inventoryRequired: true },
  { value: 'manufacturing', label: 'Manufacturing', description: 'Product manufacturing', icon: 'Factory', accountingFramework: 'ASPE', specializedAccounts: ['Raw Materials', 'WIP', 'Finished Goods', 'Manufacturing Overhead'], cogsRequired: true, inventoryRequired: true },
  { value: 'media', label: 'Media & Publishing', description: 'Publishers, broadcasters', icon: 'Newspaper', accountingFramework: 'ASPE', specializedAccounts: ['Subscription Revenue', 'Advertising Revenue', 'Content Development'], cogsRequired: false, inventoryRequired: false },
  { value: 'mining', label: 'Mining & Extraction', description: 'Mining, oil & gas', icon: 'Mountain', accountingFramework: 'IFRS', specializedAccounts: ['Mineral Properties', 'Depletion', 'Reclamation'], cogsRequired: true, inventoryRequired: true },
  { value: 'npo', label: 'Non-Profit Organization', description: 'NPOs, foundations, associations', icon: 'HeartHandshake', accountingFramework: 'ASNPO', specializedAccounts: ['Unrestricted Net Assets', 'Restricted Funds', 'Grants'], cogsRequired: false, inventoryRequired: false },
  { value: 'pharmaceuticals', label: 'Pharmaceuticals', description: 'Drug manufacturing, distribution', icon: 'Pill', accountingFramework: 'IFRS', specializedAccounts: ['Drug Inventory', 'R&D', 'FDA Compliance'], cogsRequired: true, inventoryRequired: true },
  { value: 'professional_services', label: 'Professional Services', description: 'Consulting, legal, accounting', icon: 'Briefcase', accountingFramework: 'ASPE', specializedAccounts: ['WIP Services', 'Retainers'], cogsRequired: false, inventoryRequired: false },
  { value: 'real_estate', label: 'Real Estate & Property', description: 'Real estate, property management', icon: 'Home', accountingFramework: 'ASPE', specializedAccounts: ['Rental Income', 'Property Assets', 'Security Deposits'], cogsRequired: false, inventoryRequired: false },
  { value: 'religious', label: 'Religious Organizations', description: 'Churches, temples, mosques', icon: 'Church', accountingFramework: 'ASNPO', specializedAccounts: ['Tithes & Offerings', 'Mission Expenses'], cogsRequired: false, inventoryRequired: false },
  { value: 'retail', label: 'Retail', description: 'Brick & mortar, chain stores', icon: 'Store', accountingFramework: 'ASPE', specializedAccounts: ['Merchandise Inventory', 'Shrinkage', 'Markdowns'], cogsRequired: true, inventoryRequired: true },
  { value: 'saas', label: 'Software as a Service (SaaS)', description: 'Subscription software', icon: 'Cloud', accountingFramework: 'ASPE', specializedAccounts: ['Subscription Revenue', 'Deferred Revenue', 'Customer Acquisition'], cogsRequired: false, inventoryRequired: false },
  { value: 'sports', label: 'Sports & Recreation', description: 'Gyms, sports teams, recreation', icon: 'Dumbbell', accountingFramework: 'ASPE', specializedAccounts: ['Membership Fees', 'Event Revenue'], cogsRequired: false, inventoryRequired: false },
  { value: 'technology', label: 'Technology & Software', description: 'Tech companies, software dev', icon: 'Cpu', accountingFramework: 'ASPE', specializedAccounts: ['Capitalized Development', 'License Revenue'], cogsRequired: false, inventoryRequired: false },
  { value: 'telecommunications', label: 'Telecommunications', description: 'Telecom providers, ISPs', icon: 'Radio', accountingFramework: 'IFRS', specializedAccounts: ['Subscriber Revenue', 'Network Assets', 'Spectrum Licenses'], cogsRequired: true, inventoryRequired: false },
  { value: 'textiles', label: 'Textiles & Apparel', description: 'Fashion, clothing manufacturing', icon: 'Shirt', accountingFramework: 'ASPE', specializedAccounts: ['Fabric Inventory', 'WIP Garments', 'Finished Goods'], cogsRequired: true, inventoryRequired: true },
  { value: 'transportation_logistics', label: 'Transportation & Logistics', description: 'Freight, shipping, fleet', icon: 'Truck', accountingFramework: 'ASPE', specializedAccounts: ['Fleet Assets', 'Fuel Costs', 'Freight Revenue'], cogsRequired: true, inventoryRequired: false },
  { value: 'venture_capital', label: 'Venture Capital & Private Equity', description: 'Investment funds, PE firms', icon: 'TrendingUp', accountingFramework: 'IFRS', specializedAccounts: ['Portfolio Investments', 'Carried Interest', 'Management Fees'], cogsRequired: false, inventoryRequired: false },
  { value: 'wholesale', label: 'Wholesale & Distribution', description: 'Wholesale trade, distributors', icon: 'Package', accountingFramework: 'ASPE', specializedAccounts: ['Inventory', 'Freight-In', 'Volume Discounts'], cogsRequired: true, inventoryRequired: true },
  { value: 'other', label: 'Other', description: 'Other industries not listed', icon: 'MoreHorizontal', accountingFramework: 'ASPE', specializedAccounts: [], cogsRequired: false, inventoryRequired: false },
];

// Simple list for dropdowns
export const INDUSTRY_OPTIONS = INDUSTRIES.map(ind => ({
  value: ind.value,
  label: ind.label,
}));

// Get industry config by value
export function getIndustryConfig(industryValue: string): IndustryConfig | undefined {
  return INDUSTRIES.find(ind => ind.value === industryValue);
}

// Check if industry requires ASNPO framework
export function isNpoIndustry(industryValue: string): boolean {
  const config = getIndustryConfig(industryValue);
  return config?.accountingFramework === 'ASNPO';
}

// Get industries by accounting framework
export function getIndustriesByFramework(framework: 'ASPE' | 'ASNPO' | 'IFRS'): IndustryConfig[] {
  return INDUSTRIES.filter(ind => ind.accountingFramework === framework);
}

// Industry type for TypeScript
export type IndustryType = typeof INDUSTRIES[number]['value'];
