import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FilingRemindersPanel, SharedCommunicationPanel } from './ReceptionistHubShare';

const contact = {
  id: 'c1',
  name: '17259484 Canada Inc.',
  email: 'nnamdi@example.com',
  phone: '4379088602',
  cell_phone: null,
  company: '17259484 Canada Inc.',
};

describe('receptionist shared communication', () => {
  it('sends on the selected channel and shows hub history', async () => {
    const onSend = vi.fn(async () => ({ id: 'm1' }));
    const onOpen = vi.fn();
    render(
      <SharedCommunicationPanel
        contacts={[contact]}
        conversations={[{
          id: 'conv-sms',
          contactIdentifier: '4379088602',
          contactName: contact.name,
          channel: 'sms',
          preview: 'Payroll question',
          at: '2026-10-04T15:00:00.000Z',
        }]}
        messages={[{ id: 'msg-1', body: 'Payroll question', direction: 'inbound', created_at: '2026-10-04T15:00:00.000Z' }]}
        selectedConversationId="conv-sms"
        onOpenConversation={onOpen}
        onSend={onSend}
      />,
    );

    expect(screen.getAllByText('Payroll question').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Look up a contact'), { target: { value: 'nnamdi' } });
    fireEvent.click(screen.getByRole('option', { name: /17259484 Canada Inc\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    fireEvent.change(screen.getByLabelText('Message to the contact'), { target: { value: 'Your HST return is ready.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send WhatsApp' }));
    });
    expect(onSend).toHaveBeenCalledWith('whatsapp', '4379088602', 'Your HST return is ready.', undefined);
  });

  it('saves a new contact with a name, cell number, and email', async () => {
    const onCreate = vi.fn(async () => ({ id: 'new-1' }));
    render(
      <SharedCommunicationPanel
        contacts={[]}
        conversations={[]}
        messages={[]}
        selectedConversationId={null}
        onOpenConversation={vi.fn()}
        onSend={vi.fn()}
        onCreateContact={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ngozi Ade' } });
    fireEvent.change(screen.getByLabelText('Cell / phone'), { target: { value: '4165550199' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ngozi@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    });
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Ngozi Ade',
      email: 'ngozi@example.com',
      phone: '4165550199',
      cell_phone: '4165550199',
    });
  });

  it('sends a corporation tax reminder to the shared contact', async () => {
    const onSend = vi.fn(async () => ({ id: 'm1' }));
    render(
      <FilingRemindersPanel
        organizationName="eFintax Advisors Ltd"
        fiscalYearEndMonth={12}
        deadlines={[]}
        periods={[]}
        contacts={[contact]}
        onSend={onSend}
        today="2026-10-04"
      />,
    );

    expect(screen.getByText('Due 2027-03-31')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'sms' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send Corporation tax balance reminder due 2027-03-31' }));
    });
    expect(onSend).toHaveBeenCalledWith(
      'sms',
      '4379088602',
      expect.stringContaining('eFintax Advisors Ltd: Corporation tax balance is due March 31, 2027.'),
      expect.objectContaining({ subject: 'Corporation tax balance due March 31, 2027' }),
    );
  });
});
