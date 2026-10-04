import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIReceptionistDesk } from './AIReceptionistDesk';
import { AddApiKeyDialog } from './AddApiKeyDialog';
import { Contact } from '@/hooks/useContacts';

const contact = {
  id: 'c1',
  organization_id: 'org',
  name: '17259484 Canada Inc.',
  first_name: null,
  last_name: null,
  email: 'nnamdi@example.com',
  phone: '4379088602',
  phone_normalized: '+14379088602',
  cell_phone: null,
  cell_phone_normalized: null,
  landline: null,
  landline_normalized: null,
  company: '17259484 Canada Inc.',
  address_line1: null,
  address_line2: null,
  city: null,
  province: null,
  postal_code: null,
  country: null,
  notes: null,
  source: 'customer',
  source_id: 'cust-1',
  is_favorite: false,
  is_active: true,
  tags: null,
  created_at: '',
  updated_at: '',
  created_by: null,
} as Contact;

describe('AI Receptionist desk', () => {
  it('files a caller message on a shared communication contact', async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(
      <AIReceptionistDesk
        contacts={[contact]}
        activities={[]}
        answering
        onAnsweringChange={() => {}}
        onSend={onSend}
        onSaveCredential={async () => {}}
        onTestCredential={async () => {}}
      />,
    );

    expect(screen.getByText('Shared contacts')).toBeInTheDocument();
    expect(screen.getByText('17259484 Canada Inc.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Caller message'), {
      target: { value: "I'd like to speak with someone about my payroll." },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith(
      contact,
      "I'd like to speak with someone about my payroll.",
      'message',
    );
  });
});

describe('Add API dialog', () => {
  it('saves an ElevenLabs key without asking for platform settings', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AddApiKeyDialog open onOpenChange={() => {}} onSave={onSave} onTest={async () => {}} />,
    );

    expect(screen.getByDisplayValue('ELEVENLABS_API_KEY')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk_test_eleven_1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save API key' }));

    expect(onSave).toHaveBeenCalledWith({
      provider: 'elevenlabs',
      name: 'ElevenLabs',
      secretName: 'ELEVENLABS_API_KEY',
      apiKey: 'sk_test_eleven_1234',
    });
    expect(screen.queryByText('Platform API settings are unavailable.')).not.toBeInTheDocument();
  });

  it('replaces a platform-settings failure with an organization save message', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Platform API settings are unavailable.'));
    render(
      <AddApiKeyDialog open onOpenChange={() => {}} onSave={onSave} onTest={async () => {}} />,
    );

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk_test_eleven_1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save API key' }));

    expect(await screen.findByText(/current organization/i)).toBeInTheDocument();
    expect(screen.queryByText('Platform API settings are unavailable.')).not.toBeInTheDocument();
  });
});
