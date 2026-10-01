import { describe, expect, it } from 'vitest';
import { employeeFormErrorTarget } from './employeeFormNavigation';

describe('employee form submit errors', () => {
  it('points Add Employee at the personal tab when required details are missing', () => {
    expect(employeeFormErrorTarget({
      firstName: { message: 'First name is required' },
      jobSiteId: { message: 'Job site is required' },
    })).toEqual({ tab: 'personal', message: 'First name is required' });
  });

  it('points a job site error at the personal tab even from the guarantors step', () => {
    expect(employeeFormErrorTarget({
      jobSiteId: { message: 'Job site is required' },
    })).toEqual({ tab: 'personal', message: 'Job site is required' });
  });
});
