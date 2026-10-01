export type EmployeeFormTab = 'personal' | 'tax' | 'guarantors';

const PERSONAL_FIELDS = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'nationalId',
  'nin',
  'dateOfBirth',
  'addressLine1',
  'addressLine2',
  'city',
  'mailingProvince',
  'postalCode',
  'mailingCountry',
  'department',
  'jobTitle',
  'jobSiteId',
  'employmentType',
  'payFrequency',
  'jurisdiction',
  'hireDate',
  'payType',
  'annualSalary',
  'hourlyRate',
  'cppExempt',
  'eiExempt',
]);

const FIELD_ORDER = [
  'firstName',
  'lastName',
  'email',
  'nin',
  'jobSiteId',
  'jurisdiction',
  'hireDate',
  'employmentType',
  'payFrequency',
  'payType',
  'annualSalary',
  'hourlyRate',
];

export function employeeFormTab(field: string): EmployeeFormTab {
  if (PERSONAL_FIELDS.has(field)) return 'personal';
  if (field.startsWith('taxCredit')) return 'tax';
  return 'personal';
}

type FieldErrorLike = { message?: string } | undefined;

/** First visible validation message, and the tab that contains that field. */
export function employeeFormErrorTarget(
  errors: Record<string, FieldErrorLike>,
): { tab: EmployeeFormTab; message: string } | null {
  const keys = [
    ...FIELD_ORDER.filter((key) => errors[key]?.message),
    ...Object.keys(errors).filter((key) => errors[key]?.message && !FIELD_ORDER.includes(key)),
  ];
  const field = keys[0];
  if (!field) return null;
  return {
    tab: employeeFormTab(field),
    message: errors[field]?.message || 'Fill in the required employee details.',
  };
}
