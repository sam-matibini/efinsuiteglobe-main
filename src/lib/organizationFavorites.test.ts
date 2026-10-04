import { describe, expect, it } from 'vitest';
import {
  orderOrganizationsByFavorite,
  readFavoriteOrganizationIds,
  toggleFavoriteOrganization,
  writeFavoriteOrganizationIds,
} from './organizationFavorites';

const companies = [
  { id: 'mb', name: '10255666 MANITOBA LTD.' },
  { id: 'bc', name: '1410443 B.C. Ltd' },
  { id: 'black', name: 'Black Manitoba Network' },
  { id: 'afro', name: 'Afropegga Inc.' },
];

describe('organization favorites', () => {
  it('pins favorites above the alphabetical list', () => {
    const ordered = orderOrganizationsByFavorite(companies, ['black', 'afro']);
    expect(ordered.map((item) => item.name)).toEqual([
      'Afropegga Inc.',
      'Black Manitoba Network',
      '10255666 MANITOBA LTD.',
      '1410443 B.C. Ltd',
    ]);
  });

  it('toggles and stores favorite ids for the signed-in user', () => {
    const once = toggleFavoriteOrganization([], 'black');
    const twice = toggleFavoriteOrganization(once, 'black');
    expect(once).toEqual(['black']);
    expect(twice).toEqual([]);
    writeFavoriteOrganizationIds('user-1', once);
    expect(readFavoriteOrganizationIds('user-1')).toEqual(['black']);
    expect(readFavoriteOrganizationIds('user-2')).toEqual([]);
  });
});
