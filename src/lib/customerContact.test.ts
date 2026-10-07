import { describe, expect, it } from 'vitest';
import { isMissingContactPersonColumn } from './customerContact';

describe('customer contact person', () => {
  it('recognizes a database that has not added the column yet', () => {
    expect(isMissingContactPersonColumn({
      code: 'PGRST204',
      message: "Could not find the 'contact_person' column of 'customers' in the schema cache",
    })).toBe(true);
    expect(isMissingContactPersonColumn({ message: 'null value in column "name"' })).toBe(false);
    expect(isMissingContactPersonColumn(null)).toBe(false);
  });
});
