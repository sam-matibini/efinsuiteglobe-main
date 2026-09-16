import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../..');

describe('add employee wiring', () => {
  it('registers /payroll/employees/new before the :id profile route', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    const newIdx = app.indexOf('path="/payroll/employees/new"');
    const idIdx = app.indexOf('path="/payroll/employees/:id"');
    expect(newIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(newIdx).toBeLessThan(idIdx);
  });

  it('opens the add dialog from the employees list new-employee path', () => {
    const list = readFileSync(join(root, 'src/pages/payroll/EmployeesList.tsx'), 'utf8');
    expect(list).toContain('/payroll/employees/new');
    const page = readFileSync(join(root, 'src/pages/Employees.tsx'), 'utf8');
    expect(page).toContain("location.pathname !== '/payroll/employees/new'");
    expect(page).toContain('setIsAddOpen(true)');
  });

  it('persists onboarding employees to the employees table', () => {
    const onboarding = readFileSync(join(root, 'src/pages/payroll/EmployeeOnboarding.tsx'), 'utf8');
    expect(onboarding).toContain(".from('employees')");
    expect(onboarding).toContain('.insert(');
    expect(onboarding).toContain("status: 'onboarding'");
  });

  it('always renders optional and mandatory guarantor buttons on the guarantors tab', () => {
    const form = readFileSync(join(root, 'src/components/employees/GuarantorForm.tsx'), 'utf8');
    expect(form).toContain('Guarantor requirement');
    expect(form).toContain("setRequirement('optional')");
    expect(form).toContain("setRequirement('mandatory')");
    expect(form).not.toContain('onRequirementChange &&');
    const dialog = readFileSync(join(root, 'src/components/employees/AddEmployeeDialog.tsx'), 'utf8');
    expect(dialog).toContain('onRequirementChange={setGuarantorRequirement}');
    expect(dialog).toContain('canSubmitWithGuarantors');
  });
});
