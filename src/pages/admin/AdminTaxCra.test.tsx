import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminTaxCra from './AdminTaxCra';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async (name: string) => {
      if (name === 'admin_get_cra_firm_settings') {
        return {
          data: [{
            representative_id: 'REP1234',
            efile_number: 'EF12345',
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
    expect(await screen.findByLabelText('CRA representative ID')).toHaveValue('REP1234');
    expect(screen.getByLabelText('EFILE number')).toHaveValue('EF12345');
    expect(screen.getByLabelText('EFILE password')).toHaveValue('');
    expect(screen.getByText('Password saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tax & CRA settings' })).toBeInTheDocument();
  });
});
