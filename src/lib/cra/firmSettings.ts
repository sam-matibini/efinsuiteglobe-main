const REPRESENTATIVE_ID = /^[A-Za-z0-9]{4,20}$/;
const EFILE_NUMBER = /^[A-Za-z0-9]{4,16}$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEPHONE = /^[0-9+().\-\s]{7,20}$/;

export interface CraFirmInput {
  representativeName: string;
  representativeId: string;
  efileName: string;
  efileNumber: string;
  efilePassword: string;
  contactEmail: string;
  mailingAddress: string;
  telephone: string;
}

export function normalizeFirmName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeContactEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeMailingAddress(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeTelephone(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateCraFirmInput(input: CraFirmInput): string | null {
  const representativeName = normalizeFirmName(input.representativeName);
  const representativeId = input.representativeId.trim();
  const efileName = normalizeFirmName(input.efileName);
  const efileNumber = input.efileNumber.trim();
  const efilePassword = input.efilePassword;
  const contactEmail = normalizeContactEmail(input.contactEmail);
  const mailingAddress = normalizeMailingAddress(input.mailingAddress);
  const telephone = normalizeTelephone(input.telephone);
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
  if (contactEmail && (!EMAIL.test(contactEmail) || contactEmail.length > 120)) {
    return 'Enter a valid email address.';
  }
  if (mailingAddress && (mailingAddress.length < 5 || mailingAddress.length > 200 || /[\u0000-\u001F]/.test(mailingAddress) || !/[\p{L}\p{N}]/u.test(mailingAddress))) {
    return 'Mailing address must be 5 to 200 characters.';
  }
  if (telephone && (!TELEPHONE.test(telephone) || telephone.replace(/\D/g, '').length < 7)) {
    return 'Telephone must include at least 7 digits.';
  }
  if (!representativeName && !representativeId && !efileName && !efileNumber && !efilePassword && !contactEmail && !mailingAddress && !telephone) {
    return 'Enter a representative name, representative ID, an EFILE name, an EFILE number, a password, or contact details.';
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
