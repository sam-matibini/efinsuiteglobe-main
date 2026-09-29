import * as z from 'zod';

export const ADD_EMPLOYEE_PERSONAL_FIELDS = new Set([
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
  'annualSalary',
  'hourlyRate',
  'payType',
  'cppExempt',
  'eiExempt',
]);

export type AddEmployeeTab = 'personal' | 'tax' | 'guarantors';

const taxCredit = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? 0 : value),
  z.coerce.number().finite(),
);

export function createEmployeeSchema(countryCode: string) {
  return z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email required'),
    phone: z.string().optional(),
    nationalId: z.string().optional(),
    nin: countryCode === 'NG'
      ? z.string().regex(/^\d{11}$/, 'NIN must be exactly 11 digits')
      : z.string().optional(),
    dateOfBirth: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    mailingProvince: z.string().optional(),
    postalCode: z.string().optional(),
    mailingCountry: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    jobSiteId: z.string().optional(),
    employmentType: z.enum(['full_time', 'part_time', 'contract', 'temporary']),
    payFrequency: z.enum(['weekly', 'bi_weekly', 'semi_monthly', 'monthly']),
    jurisdiction: z.string().min(1, 'Location is required'),
    hireDate: z.string().min(1, 'Hire date is required'),
    annualSalary: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? 0 : value),
      z.coerce.number().finite().optional(),
    ),
    hourlyRate: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? 0 : value),
      z.coerce.number().finite().optional(),
    ),
    cppExempt: z.boolean().optional(),
    eiExempt: z.boolean().optional(),
    payType: z.enum(['salary', 'hourly']),
    taxCredit1: taxCredit,
    taxCredit2: taxCredit,
    taxCredit3: taxCredit,
    taxCredit4: taxCredit,
    taxCredit5: taxCredit,
    taxCredit6: taxCredit,
    taxCredit7: taxCredit,
    taxCredit8: taxCredit,
    taxCreditJ1: taxCredit,
    taxCreditJ2: taxCredit,
    taxCreditJ3: taxCredit,
    taxCreditJ4: taxCredit,
    taxCreditJ5: taxCredit,
    taxCreditJ6: taxCredit,
    taxCreditJ7: taxCredit,
  });
}

export type EmployeeFormData = z.infer<ReturnType<typeof createEmployeeSchema>>;

export function generateEmployeeNumber(now = Date.now()) {
  return `EMP${now.toString().slice(-6)}`;
}

export function todayISODate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function tabForEmployeeField(field: string): AddEmployeeTab {
  if (field.startsWith('taxCredit')) return 'tax';
  if (ADD_EMPLOYEE_PERSONAL_FIELDS.has(field)) return 'personal';
  return 'personal';
}

export function firstEmployeeFormError(
  errors: Record<string, { message?: string } | Record<string, unknown> | undefined>,
): { field: string; message: string } | undefined {
  for (const [field, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue;
    if (typeof (value as { message?: string }).message === 'string' && (value as { message: string }).message) {
      return { field, message: (value as { message: string }).message };
    }
  }
  return undefined;
}

export function employeeInsertErrorMessage(error: { message?: string } | string | null | undefined): string {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  if (
    errorMessage.includes('employees_organization_email_unique') ||
    (errorMessage.includes('duplicate key') && errorMessage.includes('email'))
  ) {
    return 'An employee with this email already exists. Please use a different email address.';
  }
  if (
    errorMessage.includes('employees_organization_employee_number_unique') ||
    (errorMessage.includes('duplicate key') && errorMessage.includes('employee_number'))
  ) {
    return 'An employee with this employee number already exists.';
  }
  return errorMessage || 'Failed to add employee';
}

export function emptyToNull<T extends string | number>(value: T | null | undefined) {
  if (value === '' || value === undefined || value === null) return null;
  return value;
}

export type GuarantorRequirement = 'optional' | 'mandatory';

export const GUARANTORS_MANDATORY_ERROR =
  'Both guarantors are required and each must be confirmed before adding this employee.';

export function canSubmitWithGuarantors(
  requirement: GuarantorRequirement,
  firstComplete: boolean,
  secondComplete: boolean,
): boolean {
  if (requirement === 'optional') return true;
  return firstComplete && secondComplete;
}

export function guarantorConfirmationCopy(required: boolean) {
  return {
    label: required ? 'Guarantor confirmation (required) *' : 'Guarantor confirmation (optional)',
    help: required
      ? 'This confirmation is required before the employee can be added.'
      : 'Skip this if your company or region does not require guarantors.',
  };
}
