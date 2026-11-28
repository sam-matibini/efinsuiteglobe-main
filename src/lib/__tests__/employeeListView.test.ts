import { describe, expect, it } from 'vitest';
import { annualEquivalent, countActiveFilters, EMPTY_FILTERS, filterEmployees, headcountBreakdown, maskTail, nationalIdOf, nextSort, sortEmployees, type ListEmployee } from '../employeeListView';

const E = (over: Partial<ListEmployee>): ListEmployee => ({
  first_name: 'A', last_name: 'A', email: 'a@x.com', status: 'active', employment_type: 'contract',
  hire_date: '2024-01-01', department: 'Finance', job_title: 'Revenue Collector', ...over,
});

const staff: ListEmployee[] = [
  E({ first_name: 'Zainab', last_name: 'Abdulazeez', email: 'zainab@x.com', annual_salary: 480000, hire_date: '2024-08-12', employee_number: 'EMP0170' }),
  E({ first_name: 'Babatunde', last_name: 'Abolaji', email: 'kcabolaji@yahoo.com', annual_salary: 900000, hire_date: '2026-01-01', employee_number: 'EMP0002' }),
  E({ first_name: 'Opeyemi', last_name: 'Adebayo', department: 'Security', job_title: 'Guard', employment_type: 'full_time', hourly_rate: 500, hire_date: '2025-06-30', employee_number: 'EMP0010' }),
  E({ first_name: 'Musa', last_name: 'Bello', department: null, status: 'terminated', employment_type: 'part_time', hire_date: '2023-03-01', employee_number: 'EMP0100' }),
];
const names = (rows: ListEmployee[]) => rows.map((r) => r.first_name);

describe('employee list filters', () => {
  it('searches name, email, Employee ID, job title and department', () => {
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, search: 'abol' }))).toEqual(['Babatunde']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, search: 'emp0170' }))).toEqual(['Zainab']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, search: 'guard' }))).toEqual(['Opeyemi']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, search: 'security' }))).toEqual(['Opeyemi']);
  });

  it('filters by status, department (including none), employment type and pay type', () => {
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, status: 'terminated' }))).toEqual(['Musa']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, department: 'Finance' }))).toEqual(['Zainab', 'Babatunde']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, department: '__none__' }))).toEqual(['Musa']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, employmentType: 'full_time' }))).toEqual(['Opeyemi']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, payType: 'hourly' }))).toEqual(['Opeyemi']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, payType: 'none' }))).toEqual(['Musa']);
  });

  it('filters by hire date range and annual pay range (hourly × 2,080)', () => {
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, hireFrom: '2024-01-01', hireTo: '2025-12-31' }))).toEqual(['Zainab', 'Opeyemi']);
    // Opeyemi: 500 × 2080 = 1,040,000
    expect(annualEquivalent(staff[2])).toBe(1040000);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, payMin: '500,000' }))).toEqual(['Babatunde', 'Opeyemi']);
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, payMax: '900000' }))).toEqual(['Zainab', 'Babatunde']);
  });

  it('counts applied filters', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, status: 'active', hireFrom: '2024-01-01', hireTo: '2024-12-31' })).toBe(2);
  });
});

describe('employee list sorting', () => {
  it('sorts by pay with blanks last in both directions', () => {
    expect(names(sortEmployees(staff, { key: 'pay', dir: 'desc' }))).toEqual(['Opeyemi', 'Babatunde', 'Zainab', 'Musa']);
    expect(names(sortEmployees(staff, { key: 'pay', dir: 'asc' }))).toEqual(['Zainab', 'Babatunde', 'Opeyemi', 'Musa']);
  });

  it('sorts by name (last, first), hire date, status order and Employee ID (numeric aware)', () => {
    expect(names(sortEmployees(staff, { key: 'name', dir: 'asc' }))).toEqual(['Zainab', 'Babatunde', 'Opeyemi', 'Musa']);
    expect(names(sortEmployees(staff, { key: 'hire_date', dir: 'desc' }))).toEqual(['Babatunde', 'Opeyemi', 'Zainab', 'Musa']);
    expect(names(sortEmployees(staff, { key: 'status', dir: 'desc' }))[0]).toBe('Musa');
    expect(names(sortEmployees(staff, { key: 'employee_number', dir: 'asc' }))).toEqual(['Babatunde', 'Opeyemi', 'Musa', 'Zainab']);
  });

  it('header clicks flip direction; pay and hire date start descending', () => {
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort({ key: 'name', dir: 'asc' }, 'pay')).toEqual({ key: 'pay', dir: 'desc' });
    expect(nextSort({ key: 'pay', dir: 'desc' }, 'department')).toEqual({ key: 'department', dir: 'asc' });
  });

  it('does not mutate the input', () => {
    const copy = [...staff];
    sortEmployees(staff, { key: 'pay', dir: 'desc' });
    expect(staff).toEqual(copy);
  });
});

describe('position filter and headcount breakdown', () => {
  it('filters by position, including employees with no position', () => {
    expect(names(filterEmployees(staff, { ...EMPTY_FILTERS, position: 'Guard' }))).toEqual(['Opeyemi']);
    const extra = [...staff, E({ first_name: 'Ngozi', job_title: null })];
    expect(names(filterEmployees(extra, { ...EMPTY_FILTERS, position: '__none__' }))).toEqual(['Ngozi']);
    expect(countActiveFilters({ ...EMPTY_FILTERS, position: 'Guard' })).toBe(1);
  });

  it('counts employees per department, largest first, blanks last as Not set', () => {
    expect(headcountBreakdown(staff, 'department')).toEqual([
      { value: 'Finance', label: 'Finance', count: 2 },
      { value: 'Security', label: 'Security', count: 1 },
      { value: '__none__', label: 'Not set', count: 1 },
    ]);
  });

  it('labels employment types and counts positions', () => {
    expect(headcountBreakdown(staff, 'employment_type').map((b) => `${b.label}:${b.count}`)).toEqual(['Contract:2', 'Full-time:1', 'Part-time:1']);
    expect(headcountBreakdown(staff, 'position')[0]).toEqual({ value: 'Revenue Collector', label: 'Revenue Collector', count: 3 });
  });

  it('each breakdown bucket filters to exactly its count', () => {
    for (const key of ['department', 'position', 'employment_type'] as const) {
      const field = key === 'employment_type' ? 'employmentType' : key;
      for (const b of headcountBreakdown(staff, key)) {
        expect(filterEmployees(staff, { ...EMPTY_FILTERS, [field]: b.value })).toHaveLength(b.count);
      }
    }
  });
});

describe('national ID and masking', () => {
  it('prefers the NIN, then the SIN / national ID', () => {
    expect(nationalIdOf({ nin: '12345678901', sin_encrypted: '999' })).toBe('12345678901');
    expect(nationalIdOf({ nin: '  ', sin_encrypted: '123-456-789' })).toBe('123-456-789');
    expect(nationalIdOf({ nin: null, sin_encrypted: null })).toBeNull();
  });
  it('shows only the last 4 characters', () => {
    expect(maskTail('12345678901')).toBe('•••••••8901');
    expect(maskTail('0123456789')).toBe('••••••6789');
    expect(maskTail('123')).toBe('•••');
    expect(maskTail(null)).toBe('');
  });
  it('finds employees by National ID in search', () => {
    expect(filterEmployees([E({ first_name: 'Ada', nin: '55566677788' }), E({ first_name: 'Obi' })], { ...EMPTY_FILTERS, search: '555666' }).map((e) => e.first_name)).toEqual(['Ada']);
  });
});
