export interface SharedContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cell_phone?: string | null;
  company: string | null;
}

export type ReceptionistActivityKind = 'call' | 'handoff' | 'booking' | 'message';

export interface ReceptionistActivity {
  id: string;
  kind: ReceptionistActivityKind;
  body: string;
  contactId: string | null;
  contactName: string | null;
  createdAt: string;
}

/** Digits only, so +1 (437) 908-8602 and 4379088602 compare equal. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function contactPhones(contact: SharedContact): string[] {
  return [contact.phone, contact.cell_phone]
    .map(phoneDigits)
    .filter((digits) => digits.length >= 7);
}

/**
 * Find the communication-hub contact a receptionist caller belongs to.
 * Phone and email win over a name mention so a message that quotes a
 * company name does not attach to the wrong person.
 */
export function matchSharedContact(
  contacts: SharedContact[],
  input: { text?: string; phone?: string; email?: string; name?: string },
): SharedContact | null {
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const byEmail = contacts.find((contact) => contact.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  const phone = phoneDigits(input.phone);
  if (phone.length >= 7) {
    const byPhone = contacts.find((contact) =>
      contactPhones(contact).some((digits) => digits.endsWith(phone) || phone.endsWith(digits)),
    );
    if (byPhone) return byPhone;
  }

  const text = `${input.text ?? ''} ${input.name ?? ''}`.toLowerCase();
  const emailInText = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
  if (emailInText) {
    const byEmail = contacts.find((contact) => contact.email?.trim().toLowerCase() === emailInText);
    if (byEmail) return byEmail;
  }

  const digitsInText = phoneDigits(text);
  if (digitsInText.length >= 7) {
    const byPhone = contacts.find((contact) =>
      contactPhones(contact).some(
        (digits) => digitsInText.includes(digits) || digits.endsWith(digitsInText.slice(-10)),
      ),
    );
    if (byPhone) return byPhone;
  }

  const name = input.name?.trim().toLowerCase();
  if (name && name.length >= 3) {
    const byName = contacts.find(
      (contact) =>
        contact.name.trim().toLowerCase() === name ||
        contact.company?.trim().toLowerCase() === name,
    );
    if (byName) return byName;
  }

  return null;
}

export function activityCounts(activities: ReceptionistActivity[]) {
  return {
    calls: activities.filter((item) => item.kind === 'call').length,
    handoffs: activities.filter((item) => item.kind === 'handoff').length,
    bookings: activities.filter((item) => item.kind === 'booking').length,
    messages: activities.filter((item) => item.kind === 'message').length,
  };
}

export function contactIdentifier(contact: SharedContact): string {
  return contact.email?.trim() || contact.phone?.trim() || contact.cell_phone?.trim() || contact.id;
}

export interface DirectoryContactLike {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  openInvoiceCount: number;
  openBalance: number;
  currency: string;
}

function sameDirectoryPerson(existing: DirectoryContactLike, contact: SharedContact, phone: string | null): boolean {
  const email = contact.email?.trim().toLowerCase();
  if (email && existing.email?.trim().toLowerCase() === email) return true;
  const sharedPhone = phoneDigits(phone);
  const existingPhone = phoneDigits(existing.phone);
  if (sharedPhone.length >= 7 && existingPhone.length >= 7 && (sharedPhone.endsWith(existingPhone) || existingPhone.endsWith(sharedPhone))) {
    return true;
  }
  const name = contact.name.trim().toLowerCase();
  return name.length >= 3 && existing.name.trim().toLowerCase() === name;
}

/** Add communication-hub contacts the receptionist does not already know as customers. */
export function mergeDirectoryContacts<T extends DirectoryContactLike>(customers: T[], shared: SharedContact[]): T[] {
  const merged = [...customers];
  for (const contact of shared) {
    const phone = contact.phone?.trim() || contact.cell_phone?.trim() || null;
    if (merged.some((existing) => sameDirectoryPerson(existing, contact, phone))) continue;
    merged.push({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone,
      openInvoiceCount: 0,
      openBalance: 0,
      currency: 'CAD',
    } as T);
  }
  return merged;
}
