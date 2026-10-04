import { describe, expect, it } from 'vitest';
import { getNavigation } from './Sidebar';

describe('sidebar communication group', () => {
  it('nests the AI receptionist under Communication instead of a separate item', () => {
    const navigation = getNavigation({ taxSlips: 'T4', separationDoc: 'ROE', remittances: 'Remittances' });
    expect(navigation.some((item) => item.label === 'AI Receptionist')).toBe(false);
    const communication = navigation.find((item) => item.label === 'Communication');
    expect(communication?.href).toBeUndefined();
    expect(communication?.children?.map((child) => child.label)).toEqual([
      'Compose',
      'Inbox',
      'Contacts',
      'Voice',
      'Branding',
      'AI Receptionist',
    ]);
    expect(communication?.children?.find((child) => child.label === 'AI Receptionist')?.href).toBe('/communication?tab=receptionist');
    expect(communication?.children?.find((child) => child.label === 'Compose')?.href).toBe('/communication');
  });
});