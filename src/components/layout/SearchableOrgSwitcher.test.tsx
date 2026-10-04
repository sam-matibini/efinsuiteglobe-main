import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchableOrgSwitcher } from './SearchableOrgSwitcher';
import type { Organization } from '@/hooks/useOrganization';

const organizations = [
  { id: 'mb', name: '10255666 MANITOBA LTD.', country: 'CA' },
  { id: 'black', name: 'Black Manitoba Network', country: 'CA' },
  { id: 'afro', name: 'Afropegga Inc.', country: 'CA' },
] as Organization[];

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function renderSwitcher() {
  return render(
    <MemoryRouter>
      <SearchableOrgSwitcher
        currentOrg={organizations[0]}
        organizations={organizations}
        isLoading={false}
        onSwitch={() => undefined}
        onCreateNew={() => undefined}
        userId="tester"
      />
    </MemoryRouter>,
  );
}

describe('searchable organization switcher', () => {
  beforeEach(() => localStorage.clear());

  it('searches the list and pins a favorite at the top', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('combobox'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(screen.getByLabelText('Search organizations'), { target: { value: 'manitoba' } });
    expect(dialog).toHaveTextContent('10255666 MANITOBA LTD.');
    expect(dialog).toHaveTextContent('Black Manitoba Network');
    expect(dialog).not.toHaveTextContent('Afropegga Inc.');

    fireEvent.change(screen.getByLabelText('Search organizations'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Black Manitoba Network' }));
    expect(screen.getByText('Favorites').nextElementSibling?.textContent).toContain('Black Manitoba Network');
    expect(screen.getByText('All companies')).toBeInTheDocument();
  });
});
