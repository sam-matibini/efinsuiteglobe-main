import { describe, it, expect } from 'vitest';
import { calculatePayStub, getDefaultTD1Claims, calculatePayRunTotals, type EmployeePayInfo } from '../payrollCalculator';

function makeEmployee(overrides: Partial<EmployeePayInfo> = {}): EmployeePayInfo {
  return {
    employeeId: 'emp-1',
    province: 'ON',
    payFrequency: 'bi_weekly',
    regularHours: 80,
    overtimeHours: 0,
    vacationHours: 0,
    sickHours: 0,
    bonus: 0,
    commission: 0,
    otherEarnings: 0,
    td1FederalClaim: 16129 + 1368,
    td1ProvincialClaim: 11865,
    additionalTaxDeduction: 0,
    ytdGross: 0,
    ytdCpp: 0,
    ytdEi: 0,
    ytdFederalTax: 0,
    ytdProvincialTax: 0,
    ...overrides,
  };
}

describe('Payroll Calculator', () => {
  describe('Earnings', () => {
    it('calculates salaried employee gross pay', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 52000 }));
      expect(stub.grossPay).toBe(2000); // 52000 / 26
    });

    it('calculates hourly employee with overtime at 1.5x', () => {
      const stub = calculatePayStub(makeEmployee({ hourlyRate: 20, regularHours: 80, overtimeHours: 10 }));
      expect(stub.regularEarnings).toBe(1600);
      expect(stub.overtimeEarnings).toBe(300); // 10 * 20 * 1.5
      expect(stub.grossPay).toBe(1900);
    });
  });

  describe('CPP', () => {
    it('calculates CPP contribution', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 52000 }));
      expect(stub.cppContribution).toBeGreaterThan(0);
    });

    it('skips CPP for exempt employees', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 52000, cppExempt: true }));
      expect(stub.cppContribution).toBe(0);
    });
  });

  describe('EI', () => {
    it('calculates EI premium', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 52000 }));
      expect(stub.eiPremium).toBeGreaterThan(0);
    });

    it('skips EI for exempt employees', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 52000, eiExempt: true }));
      expect(stub.eiPremium).toBe(0);
    });
  });

  describe('Federal Tax', () => {
    it('calculates federal tax with TD1 credits reducing tax', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 52000 }));
      expect(stub.federalTax).toBeGreaterThan(0);
      // With $52k salary and full credits, tax should be modest
      expect(stub.federalTax).toBeLessThan(500);
    });
  });

  describe('Net pay', () => {
    it('net pay = gross - total deductions', () => {
      const stub = calculatePayStub(makeEmployee({ annualSalary: 60000 }));
      expect(stub.netPay).toBeCloseTo(stub.grossPay - stub.totalDeductions, 2);
    });
  });

  describe('getDefaultTD1Claims', () => {
    it('returns correct federal/provincial amounts for ON', () => {
      const claims = getDefaultTD1Claims('ON');
      expect(claims.federalClaim).toBe(16129 + 1368);
      expect(claims.provincialClaim).toBe(11865);
    });

    it('returns correct amounts for AB', () => {
      const claims = getDefaultTD1Claims('AB');
      expect(claims.federalClaim).toBe(16129 + 1368);
      expect(claims.provincialClaim).toBe(22323);
    });
  });

  describe('calculatePayRunTotals', () => {
    it('sums across multiple stubs', () => {
      const stub1 = calculatePayStub(makeEmployee({ annualSalary: 52000 }));
      const stub2 = calculatePayStub(makeEmployee({ annualSalary: 78000 }));
      const totals = calculatePayRunTotals([stub1, stub2]);
      expect(totals.totalGross).toBe(stub1.grossPay + stub2.grossPay);
      expect(totals.totalNet).toBe(stub1.netPay + stub2.netPay);
      expect(totals.employeeCount).toBe(2);
    });
  });
});
