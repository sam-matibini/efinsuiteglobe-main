import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TransactionRule } from '@/hooks/useTransactionRules';

const { rules } = vi.hoisted(() => {
  const rules: TransactionRule[] = [
  {
    id: '1',
    organization_id: 'org-1',
    name: 'Insurance Corporation Of Bc',
    description: null,
    is_active: true,
    priority: 10,
    matches_count: 1,
    last_matched_at: '2026-10-03',
    created_at: '2026-09-01',
    updated_at: '2026-10-01',
    logic_operator: 'and',
    conditions: [{ id: 'c1', field: 'payee_payor', operator: 'contains', value: 'Insurance Corporation Of Bc' }],
    actions: [{ type: 'post_to_gl', glAccountName: 'Insurance' }],
  },
  {
    id: '2',
    organization_id: 'org-1',
    name: 'Opos Adobe Inc 800-8',
    description: 'software',
    is_active: true,
    priority: 5,
    matches_count: 4,
    last_matched_at: '2026-09-01',
    created_at: '2026-08-01',
    updated_at: '2026-10-02',
    logic_operator: 'and',
    conditions: [{ id: 'c2', field: 'description', operator: 'contains', value: 'Adobe' }],
    actions: [{ type: 'categorize', category: 'Software' }],
  },
  {
    id: '3',
    organization_id: 'org-1',
    name: 'Unused rent rule',
    description: null,
    is_active: false,
    priority: 20,
    matches_count: 0,
    last_matched_at: null,
    created_at: '2026-07-01',
    updated_at: '2026-08-01',
    logic_operator: 'or',
    conditions: [{ id: 'c3', field: 'amount', operator: 'greater_than', value: '1000' }],
    actions: [{ type: 'flag_review' }],
  },
  ];
  return { rules };
});

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrganization: () => ({ organization: { id: 'org-1', name: 'Acme' }, isLoading: false }),
}));

vi.mock('@/hooks/useBankAccounts', () => ({
  useBankAccounts: () => ({ accounts: [{ id: 'ba-1', name: 'Chequing - Efintax' }] }),
}));

vi.mock('@/hooks/useTransactionRules', () => ({
  useTransactionRules: () => ({
    rules,
    activeRules: rules.filter((rule) => rule.is_active),
    isLoading: false,
    createRule: { mutate: vi.fn() },
    updateRule: { mutate: vi.fn() },
    deleteRule: { mutate: vi.fn() },
    toggleRuleActive: { mutate: vi.fn() },
  }),
}));

vi.mock('@/hooks/useBankTransactions', () => ({
  useBankTransactions: () => ({ transactions: [] }),
}));

vi.mock('@/hooks/useCreditCards', () => ({
  useCreditCards: () => ({ creditCards: [] }),
  useCreditCardTransactions: () => ({ transactions: [] }),
}));

vi.mock('@/hooks/useRuleAnalysis', () => ({
  analyzeTransactions: () => [],
  useProcessTransactions: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useCreditCardRuleAnalysis', () => ({
  analyzeCCTransactions: () => [],
  useProcessCCTransactions: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => vi.fn(),
}));

vi.mock('@/components/banking/TransactionRuleDialog', () => ({ default: () => null }));
vi.mock('@/components/banking/AnalyzePostDialog', () => ({ default: () => null }));
vi.mock('@/components/accounts/CreateOrganizationDialog', () => ({
  CreateOrganizationDialog: () => null,
}));

import TransactionRules from './TransactionRules';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function ruleNames() {
  return screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);
}

function choose(comboboxName: string, optionName: string) {
  const trigger = screen.getByRole('combobox', { name: comboboxName });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('TransactionRules header', () => {
  it('keeps the header frozen and sorts and filters the rule list', () => {
    const { container } = render(<TransactionRules />);
    const header = container.querySelector('.sticky');
    expect(header).toBeTruthy();
    expect(header?.className).toContain('top-[68px]');
    expect(within(header as HTMLElement).getByRole('button', { name: 'New Rule' })).toBeInTheDocument();
    expect(within(header as HTMLElement).getByRole('combobox', { name: 'Sort rules' })).toHaveTextContent('Priority');
    expect(ruleNames()).toEqual([
      'Unused rent rule',
      'Insurance Corporation Of Bc',
      'Opos Adobe Inc 800-8',
    ]);

    choose('Sort rules', 'Name');
    expect(ruleNames()).toEqual([
      'Insurance Corporation Of Bc',
      'Opos Adobe Inc 800-8',
      'Unused rent rule',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }));
    expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument();
    expect(ruleNames()[0]).toBe('Unused rent rule');

    choose('Filter by action', 'Categorize');
    expect(ruleNames()).toEqual(['Opos Adobe Inc 800-8']);
    expect(screen.getByText('Showing 1 of 3 rules')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(ruleNames()).toHaveLength(3);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search rules' }), { target: { value: 'adobe' } });
    expect(ruleNames()).toEqual(['Opos Adobe Inc 800-8']);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Inactive' }), { button: 0 });
    expect(screen.getByText('No rules match your filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(ruleNames()).toHaveLength(3);
  });
});
