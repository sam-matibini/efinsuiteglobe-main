// T3010 Schedule 6 category options for CRA Registered Charity Information Return

export interface T3010Category {
  value: string;
  label: string;
  line: string;
}

export const T3010_EXPENDITURE_CATEGORIES: T3010Category[] = [
  { value: 'charitable_programs', label: 'Charitable programs', line: '4800' },
  { value: 'management_admin', label: 'Management & administration', line: '4810' },
  { value: 'fundraising', label: 'Fundraising', line: '4820' },
  { value: 'political_activities', label: 'Political activities', line: '4830' },
  { value: 'other_expenditures', label: 'Other expenditures', line: '4840' },
];

export const T3010_REVENUE_CATEGORIES: T3010Category[] = [
  { value: 'receipted_gifts', label: 'Tax-receipted gifts', line: '4500' },
  { value: 'non_receipted_gifts', label: 'Gifts for which a tax receipt was not issued', line: '4510' },
  { value: 'government_grants', label: 'Government grants', line: '4530' },
  { value: 'fundraising_revenue', label: 'Fundraising revenue', line: '4540' },
  { value: 'investment_income', label: 'Investment income', line: '4560' },
  { value: 'other_revenue', label: 'Other revenue', line: '4570' },
];

export const ALL_T3010_CATEGORIES = [...T3010_REVENUE_CATEGORIES, ...T3010_EXPENDITURE_CATEGORIES];

export function getT3010CategoryLabel(value: string | null): string | null {
  if (!value) return null;
  const cat = ALL_T3010_CATEGORIES.find(c => c.value === value);
  return cat ? `Sch.6: ${cat.line}` : null;
}

export function getT3010CategoriesForAccountType(accountType: string): T3010Category[] {
  if (accountType === 'expense') return T3010_EXPENDITURE_CATEGORIES;
  if (accountType === 'income') return T3010_REVENUE_CATEGORIES;
  return [];
}
