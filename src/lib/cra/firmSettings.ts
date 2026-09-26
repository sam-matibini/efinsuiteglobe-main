const REPRESENTATIVE_ID = /^[A-Za-z0-9]{4,20}$/;
const EFILE_NUMBER = /^[A-Za-z0-9]{4,16}$/;

export interface CraFirmInput {
  representativeId: string;
  efileNumber: string;
  efilePassword: string;
}

export function validateCraFirmInput(input: CraFirmInput): string | null {
  const representativeId = input.representativeId.trim();
  const efileNumber = input.efileNumber.trim();
  const efilePassword = input.efilePassword;
  if (representativeId && !REPRESENTATIVE_ID.test(representativeId)) {
    return 'Representative ID must be 4 to 20 letters or digits.';
  }
  if (efileNumber && !EFILE_NUMBER.test(efileNumber)) {
    return 'EFILE number must be 4 to 16 letters or digits.';
  }
  if (efilePassword && (efilePassword.length < 4 || efilePassword.length > 128 || efilePassword.includes('\n'))) {
    return 'EFILE password must be 4 to 128 characters.';
  }
  if (!representativeId && !efileNumber && !efilePassword) {
    return 'Enter a representative ID, an EFILE number, or a password.';
  }
  return null;
}

export function missingCraSettingsFunction(message: string): boolean {
  return /admin_save_cra_firm_settings|admin_get_cra_firm_settings|schema cache|could not find the function|does not exist/i.test(message);
}
