import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatementSortControls } from './StatementSortControls';
import { readActiveStatementSort } from '@/lib/reports/statementSort';

describe('statement sort controls', () => {
  beforeEach(() => localStorage.clear());

  it('saves an expense amount sort that the accountant export can read', () => {
    render(<StatementSortControls organizationId="org-1" />);
    fireEvent.change(screen.getByLabelText('Sort expenses by'), { target: { value: 'amount' } });
    expect(screen.getByTestId('statement-sort-summary').textContent).toContain('Expenses by amount, high to low');

    fireEvent.change(screen.getByLabelText('Sort name'), { target: { value: 'Largest expenses' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save sort' }));

    fireEvent.change(screen.getByLabelText('Sort expenses by'), { target: { value: 'account' } });
    fireEvent.change(screen.getByLabelText('Apply a saved sort'), { target: { value: screen.getByRole('option', { name: 'Largest expenses' }).getAttribute('value') } });
    expect(readActiveStatementSort('org-1').expense).toEqual({ by: 'amount', direction: 'desc' });
    expect(screen.getByTestId('statement-sort-summary').textContent).toContain('Expenses by amount, high to low');
  });
});