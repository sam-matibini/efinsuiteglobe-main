import { phoneDigits, type SharedContact } from './sharedContacts';

export type CrmContactKind = 'customer' | 'vendor' | 'contact';

export interface CrmContact extends SharedContact {
  kind: CrmContactKind;
}

export interface CrmParty {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active?: boolean;
}

function samePerson(left: SharedContact, right: SharedContact): boolean {
  const leftEmail = left.email?.trim().toLowerCase();
  const rightEmail = right.email?.trim().toLowerCase();
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;
  const leftPhones = [left.phone, left.cell_phone].map(phoneDigits).filter((digits) => digits.length >= 7);
  const rightPhones = [right.phone, right.cell_phone].map(phoneDigits).filter((digits) => digits.length >= 7);
  if (leftPhones.some((phone) => rightPhones.some((other) => phone.endsWith(other) || other.endsWith(phone)))) return true;
  const leftName = left.name.trim().toLowerCase();
  const rightName = right.name.trim().toLowerCase();
  return leftName.length >= 3 && leftName === rightName;
}

function fillBlanks(current: CrmContact, next: CrmContact): CrmContact {
  return {
    ...current,
    email: current.email?.trim() || next.email,
    phone: current.phone?.trim() || next.phone,
    cell_phone: current.cell_phone?.trim() || next.cell_phone,
    company: current.company?.trim() || next.company,
  };
}

function partyContact(party: CrmParty, kind: CrmContactKind): CrmContact {
  return {
    id: party.id,
    name: party.name,
    email: party.email,
    phone: party.phone,
    cell_phone: null,
    company: party.name,
    kind,
  };
}

/** Customers and vendors from the CRM, plus people already saved in Communication. */
export function mergeCrmContacts(input: {
  customers?: CrmParty[];
  vendors?: CrmParty[];
  contacts?: SharedContact[];
}): CrmContact[] {
  const merged: CrmContact[] = [];
  const add = (contact: CrmContact) => {
    const index = merged.findIndex((existing) => samePerson(existing, contact));
    if (index === -1) {
      merged.push(contact);
      return;
    }
    merged[index] = fillBlanks(merged[index], contact);
  };

  for (const contact of input.contacts ?? []) {
    add({ ...contact, kind: 'contact' });
  }
  for (const customer of input.customers ?? []) {
    if (customer.is_active === false) continue;
    add(partyContact(customer, 'customer'));
  }
  for (const vendor of input.vendors ?? []) {
    if (vendor.is_active === false) continue;
    add(partyContact(vendor, 'vendor'));
  }

  return merged.sort((left, right) => left.name.localeCompare(right.name));
}

/** Type-ahead match on name, company, email, or phone digits. */
export function filterCrmContacts<T extends SharedContact>(contacts: T[], query: string): T[] {
  const text = query.trim().toLowerCase();
  if (!text) return contacts;
  const digits = phoneDigits(text);
  return contacts.filter((contact) => {
    if (contact.name.toLowerCase().includes(text)) return true;
    if (contact.company?.toLowerCase().includes(text)) return true;
    if (contact.email?.toLowerCase().includes(text)) return true;
    if (digits.length >= 3) {
      const phones = phoneDigits(`${contact.phone ?? ''} ${contact.cell_phone ?? ''}`);
      if (phones.includes(digits)) return true;
    }
    return false;
  });
}

export function crmKindLabel(kind: CrmContactKind | undefined): string {
  if (kind === 'customer') return 'Customer';
  if (kind === 'vendor') return 'Vendor';
  return 'Contact';
}
