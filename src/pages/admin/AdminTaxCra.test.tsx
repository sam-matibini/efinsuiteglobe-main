import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminTaxCra from './AdminTaxCra';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async (name: string) => {
      if (name === 'admin_get_cra_firm_settings') {
        return {
          data: [{
            representative_name: 'eFinTax Advisors Ltd.',
            representative_id: 'REP1234',
            efile_name: 'eFinTax EFILE',
            efile_number: 'EF12345',
            contact_email: 'efile@efinsuite.com',
            mailing_address: '100 King St, Winnipeg, MB R3C 1A5',
            telephone: '(204) 555-0100',
            password_configured: true,
            updated_at: '2026-09-26T12:00:00.000Z',
          }],
          error: null,
        };
      }
      return { data: null, error: null };
    }),
    from: vi.fn(),
  },
}));

describe('Admin Tax & CRA settings', () => {
  it('shows the saved representative ID and EFILE number without the password', async () => {
    render(<AdminTaxCra />);
    expect(await screen.findByLabelText('CRA representative name')).toHaveValue('eFinTax Advisors Ltd.');
    expect(screen.getByLabelText('CRA representative ID')).toHaveValue('REP1234');
    expect(screen.getByLabelText('EFILE name')).toHaveValue('eFinTax EFILE');
    expect(screen.getByLabelText('EFILE number')).toHaveValue('EF12345');
    expect(screen.getByLabelText('Email')).toHaveValue('efile@efinsuite.com');
    expect(screen.getByLabelText('Telephone')).toHaveValue('(204) 555-0100');
    expect(screen.getByLabelText('Mailing address')).toHaveValue('100 King St, Winnipeg, MB R3C 1A5');
    expect(screen.getByLabelText('EFILE password')).toHaveValue('');
    expect(screen.getByText('Password saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tax & CRA settings' })).toBeInTheDocument();
  });
});
