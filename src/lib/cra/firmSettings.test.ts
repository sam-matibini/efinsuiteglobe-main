import { describe, expect, it } from 'vitest';
import { validateCraFirmInput } from './firmSettings';

const named = {
  representativeName: 'eFinTax Advisors Ltd.',
  representativeId: 'REP1234',
  efileName: 'eFinTax EFILE',
  efileNumber: 'EF12345',
  efilePassword: 'secret1',
  contactEmail: 'efile@efinsuite.com',
  mailingAddress: '100 King St, Winnipeg, MB R3C 1A5',
  telephone: '(204) 555-0100',
};

describe('CRA firm settings input', () => {
  it('accepts a representative name, EFILE name, IDs, and password', () => {
    expect(validateCraFirmInput(named)).toBeNull();
  });

  it('allows a blank password so the saved one is kept', () => {
    expect(validateCraFirmInput({ ...named, efileNumber: '', efilePassword: '' })).toBeNull();
  });

  it('rejects an empty form, a short representative ID, and a one-character name', () => {
    expect(validateCraFirmInput({
      representativeName: '',
      representativeId: '',
      efileName: '',
      efileNumber: '',
      efilePassword: '',
      contactEmail: '',
      mailingAddress: '',
      telephone: '',
    })).toMatch(/Enter a representative name/);
    expect(validateCraFirmInput({ ...named, contactEmail: 'not-an-email' })).toMatch(/valid email/);
    expect(validateCraFirmInput({ ...named, telephone: '123' })).toMatch(/Telephone/);
    expect(validateCraFirmInput({ ...named, mailingAddress: 'AB' })).toMatch(/Mailing address/);
    expect(validateCraFirmInput({ ...named, representativeId: 'AB' })).toMatch(/4 to 20/);
    expect(validateCraFirmInput({ ...named, representativeName: 'A' })).toMatch(/Representative name/);
    expect(validateCraFirmInput({ ...named, efileName: '..' })).toMatch(/EFILE name/);
  });
});
