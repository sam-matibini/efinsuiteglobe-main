import { describe, it, expect } from 'vitest';
import {
  createEmployeeSchema,
  employeeInsertErrorMessage,
  firstEmployeeFormError,
  generateEmployeeNumber,
  tabForEmployeeField,
} from '../addEmployee';

const validBase = {
  firstName: 'Ada',
  lastName: 'Okeke',
  email: 'ada@example.com',
  employmentType: 'full_time' as const,
  payFrequency: 'monthly' as const,
  jurisdiction: 'LA',
  hireDate: '2026-09-01',
  payType: 'salary' as const,
  taxCredit1: 0,
  taxCredit2: 0,
  taxCredit3: 0,
  taxCredit4: 0,
  taxCredit5: 0,
  taxCredit6: 0,
  taxCredit7: 0,
  taxCredit8: 0,
  taxCreditJ1: 0,
  taxCreditJ2: 0,
  taxCreditJ3: 0,
  taxCreditJ4: 0,
  taxCreditJ5: 0,
  taxCreditJ6: 0,
  taxCreditJ7: 0,
};

describe('createEmployeeSchema', () => {
  it('allows creating an employee without a job site', () => {
    const parsed = createEmployeeSchema('CA').safeParse({
      ...validBase,
      jurisdiction: 'ON',
      jobSiteId: '',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires an 11-digit NIN for Nigerian employees', () => {
    const missing = createEmployeeSchema('NG').safeParse(validBase);
    expect(missing.success).toBe(false);

    const short = createEmployeeSchema('NG').safeParse({ ...validBase, nin: '12345' });
    expect(short.success).toBe(false);

    const ok = createEmployeeSchema('NG').safeParse({ ...validBase, nin: '12345678901' });
    expect(ok.success).toBe(true);
  });

  it('coerces blank tax credits to zero so the tax tab cannot block submit', () => {
    const parsed = createEmployeeSchema('CA').safeParse({
      ...validBase,
      jurisdiction: 'ON',
      taxCredit1: '',
      taxCreditJ1: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.taxCredit1).toBe(0);
      expect(parsed.data.taxCreditJ1).toBe(0);
    }
  });
});

describe('add employee helpers', () => {
  it('generates EMP + last 6 timestamp digits', () => {
    expect(generateEmployeeNumber(1712345678901)).toBe('EMP678901');
  });

  it('maps invalid fields to the tab that contains them', () => {
    expect(tabForEmployeeField('firstName')).toBe('personal');
    expect(tabForEmployeeField('jobSiteId')).toBe('personal');
    expect(tabForEmployeeField('taxCredit1')).toBe('tax');
  });

  it('returns the first visible form error', () => {
    expect(
      firstEmployeeFormError({
        hireDate: { message: 'Hire date is required' },
        email: { message: 'Valid email required' },
      }),
    ).toEqual({ field: 'hireDate', message: 'Hire date is required' });
  });

  it('maps duplicate email/number insert errors to user-facing copy', () => {
    expect(
      employeeInsertErrorMessage('duplicate key value violates unique constraint "employees_organization_email_unique"'),
    ).toMatch(/email already exists/i);
    expect(
      employeeInsertErrorMessage('duplicate key value violates unique constraint "employees_organization_employee_number_unique"'),
    ).toMatch(/employee number already exists/i);
    expect(employeeInsertErrorMessage(null)).toBe('Failed to add employee');
  });
});
