import { useState } from 'react';
import { AIReceptionistDesk } from '@/components/receptionist/AIReceptionistDesk';
import { FilingRemindersPanel, SharedCommunicationPanel } from '@/components/receptionist/ReceptionistHubShare';
import { Contact } from '@/hooks/useContacts';
import { COMMUNICATION_NAV } from '@/lib/navigation/hubNav';
import type { SharedContact } from '@/lib/receptionist/sharedContacts';

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

const sharedContact: SharedContact = {
  id: contact.id,
  name: contact.name,
  email: contact.email,
  phone: contact.phone,
  cell_phone: contact.cell_phone,
  company: contact.company,
};

/** Fixture desk so the shared-contact and API-key flows can be exercised without a session. */
export default function E2EReceptionistHarness() {
  const [saved, setSaved] = useState('Nothing shared yet.');
  const [apiStatus, setApiStatus] = useState('No API key saved.');
  const [navLabel, setNavLabel] = useState('AI Receptionist');

  return (
    <div style={{ padding: 24 }}>
      <p data-testid="share-result">{saved}</p>
      <p data-testid="api-result">{apiStatus}</p>
      <nav aria-label="Communication" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <strong>Communication</strong>
        {COMMUNICATION_NAV.map((item) => (
          <button
            key={item.href}
            type="button"
            aria-current={navLabel === item.label ? 'page' : undefined}
            onClick={() => setNavLabel(item.label)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p data-testid="nav-result">{navLabel}</p>
      <AIReceptionistDesk
        contacts={[contact]}
        activities={[]}
        answering
        onAnsweringChange={() => {}}
        onSend={async (next, body) => {
          setSaved(`Shared with ${next.name}: ${body}`);
          return true;
        }}
        onSaveCredential={async (draft) => {
          setApiStatus(`Saved ${draft.secretName} for this organization`);
        }}
        onTestCredential={async () => {
          setApiStatus('Key tested');
        }}
      />
      <div style={{ marginTop: 24 }}>
        <SharedCommunicationPanel
          contacts={[sharedContact]}
          conversations={[
            { id: 'email-1', contactIdentifier: contact.email!, contactName: contact.name, channel: 'email', preview: 'Please send the GST return', at: '2026-10-04T14:00:00.000Z' },
            { id: 'sms-1', contactIdentifier: contact.phone!, contactName: contact.name, channel: 'sms', preview: 'HST question', at: '2026-10-04T15:00:00.000Z' },
            { id: 'wa-1', contactIdentifier: contact.phone!, contactName: contact.name, channel: 'whatsapp', preview: 'WhatsApp filing note', at: '2026-10-04T16:00:00.000Z' },
          ]}
          messages={[]}
          selectedConversationId={null}
          onOpenConversation={() => {}}
          onSend={async (channel, to, body) => {
            setSaved(`Shared ${channel} to ${to}: ${body}`);
          }}
        />
      </div>
      <div style={{ marginTop: 24 }}>
        <FilingRemindersPanel
          organizationName="eFintax Advisors Ltd"
          fiscalYearEndMonth={12}
          deadlines={[]}
          periods={[]}
          contacts={[sharedContact]}
          today="2026-10-04"
          onSend={async (channel, to, body) => {
            setSaved(`Reminder ${channel} to ${to}: ${body}`);
          }}
        />
      </div>
    </div>
  );
}
