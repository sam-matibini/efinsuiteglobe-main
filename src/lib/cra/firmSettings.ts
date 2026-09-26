const REPRESENTATIVE_ID = /^[A-Za-z0-9]{4,20}$/;
const EFILE_NUMBER = /^[A-Za-z0-9]{4,16}$/;

export interface CraFirmInput {
  representativeName: string;
  representativeId: string;
  efileName: string;
  efileNumber: string;
  efilePassword: string;
}

export function normalizeFirmName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateCraFirmInput(input: CraFirmInput): string | null {
  const representativeName = normalizeFirmName(input.representativeName);
  const representativeId = input.representativeId.trim();
  const efileName = normalizeFirmName(input.efileName);
  const efileNumber = input.efileNumber.trim();
  const efilePassword = input.efilePassword;
  if (invalidFirmName(representativeName)) {
    return 'Representative name must be 2 to 80 characters.';
  }
  if (representativeId && !REPRESENTATIVE_ID.test(representativeId)) {
    return 'Representative ID must be 4 to 20 letters or digits.';
  }
  if (invalidFirmName(efileName)) {
    return 'EFILE name must be 2 to 80 characters.';
  }
  if (efileNumber && !EFILE_NUMBER.test(efileNumber)) {
    return 'EFILE number must be 4 to 16 letters or digits.';
  }
  if (efilePassword && (efilePassword.length < 4 || efilePassword.length > 128 || efilePassword.includes('\n'))) {
    return 'EFILE password must be 4 to 128 characters.';
  }
  if (!representativeName && !representativeId && !efileName && !efileNumber && !efilePassword) {
    return 'Enter a representative name, representative ID, an EFILE name, an EFILE number, or a password.';
  }
  return null;
}

function invalidFirmName(value: string): boolean {
  if (!value) return false;
  if (value.length < 2 || value.length > 80) return true;
  if (/[\u0000-\u001F]/.test(value)) return true;
  return !/[\p{L}\p{N}]/u.test(value);
}

export function missingCraSettingsFunction(message: string): boolean {
  return /admin_save_cra_firm_settings|admin_get_cra_firm_settings|schema cache|could not find the function|does not exist/i.test(message);
}
