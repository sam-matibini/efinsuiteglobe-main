import { describe, expect, it } from 'vitest';
import { filterCrmContacts, mergeCrmContacts } from './crmContacts';

describe('CRM contacts for the receptionist', () => {
  it('includes customers and vendors that are not already communication contacts', () => {
    const merged = mergeCrmContacts({
      contacts: [
        { id: 'hub-1', name: 'Bank of Canada', email: 'edalsan@gmail.com', phone: null, cell_phone: '6135550100', company: 'Bank of Canada' },
      ],
      customers: [
        { id: 'cust-1', name: 'Bank of Canada', email: 'edalsan@gmail.com', phone: null, is_active: true },
        { id: 'cust-2', name: '17259484 Canada Inc.', email: 'nnamdi@example.com', phone: '4379088602', is_active: true },
        { id: 'cust-3', name: 'Closed Co', email: 'old@example.com', phone: null, is_active: false },
      ],
      vendors: [
        { id: 'ven-1', name: 'DAPRO Trading & Services Inc.', email: 'dapro.trading@gmail.com', phone: '2043332191', is_active: true },
      ],
    });

    expect(merged.map((item) => item.name)).toEqual([
      '17259484 Canada Inc.',
      'Bank of Canada',
      'DAPRO Trading & Services Inc.',
    ]);
    expect(merged.find((item) => item.name === 'Bank of Canada')).toMatchObject({
      kind: 'contact',
      cell_phone: '6135550100',
      email: 'edalsan@gmail.com',
    });
    expect(merged.find((item) => item.name === '17259484 Canada Inc.')?.kind).toBe('customer');
    expect(merged.find((item) => item.name.startsWith('DAPRO'))?.kind).toBe('vendor');
  });

  it('filters a typed lookup by name, email, or phone', () => {
    const contacts = mergeCrmContacts({
      customers: [
        { id: 'cust-2', name: '17259484 Canada Inc.', email: 'nnamdi@example.com', phone: '4379088602', is_active: true },
        { id: 'cust-1', name: 'Bank of Canada', email: 'edalsan@gmail.com', phone: '6135550100', is_active: true },
      ],
    });
    expect(filterCrmContacts(contacts, 'bank').map((item) => item.id)).toEqual(['cust-1']);
    expect(filterCrmContacts(contacts, 'nnamdi@').map((item) => item.id)).toEqual(['cust-2']);
    expect(filterCrmContacts(contacts, '437-908').map((item) => item.id)).toEqual(['cust-2']);
    expect(filterCrmContacts(contacts, 'missing')).toEqual([]);
  });
});
