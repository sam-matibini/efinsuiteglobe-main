import { describe, expect, it } from 'vitest';
import { validateCraFirmInput } from './firmSettings';

describe('CRA firm settings input', () => {
  it('accepts a representative ID, EFILE number, and password', () => {
    expect(validateCraFirmInput({ representativeId: 'REP1234', efileNumber: 'EF12345', efilePassword: 'secret1' })).toBeNull();
  });

  it('allows a blank password so the saved one is kept', () => {
    expect(validateCraFirmInput({ representativeId: 'REP1234', efileNumber: '', efilePassword: '' })).toBeNull();
  });

  it('rejects an empty form and a short representative ID', () => {
    expect(validateCraFirmInput({ representativeId: '', efileNumber: '', efilePassword: '' })).toMatch(/Enter a representative ID/);
    expect(validateCraFirmInput({ representativeId: 'AB', efileNumber: 'EF12345', efilePassword: '' })).toMatch(/4 to 20/);
  });
});
