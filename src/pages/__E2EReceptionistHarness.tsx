import { useState } from 'react';
import { AIReceptionistDesk } from '@/components/receptionist/AIReceptionistDesk';
import { FilingRemindersPanel, SharedCommunicationPanel } from '@/components/receptionist/ReceptionistHubShare';
import { Contact } from '@/hooks/useContacts';
import { COMMUNICATION_NAV } from '@/lib/navigation/hubNav';
import type { CrmContact } from '@/lib/receptionist/crmContacts';

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

const initialCrmContacts: CrmContact[] = [
  { id: contact.id, kind: 'customer', name: contact.name, email: contact.email, phone: contact.phone, cell_phone: contact.cell_phone, company: contact.company },
  { id: 'vendor-1', kind: 'vendor', name: 'DAPRO Trading & Services Inc.', email: 'dapro.trading@gmail.com', phone: '2043332191', cell_phone: null, company: 'DAPRO Trading & Services Inc.' },
  { id: 'cust-bank', kind: 'customer', name: 'Bank of Canada', email: 'edalsan@gmail.com', phone: null, cell_phone: '6135550100', company: 'Bank of Canada' },
  { id: 'cust-3', kind: 'customer', name: '7995083 Canada Incorporated', email: 'omayeli.alamutu@gmail.com', phone: null, cell_phone: null, company: '7995083 Canada Incorporated' },
  { id: 'cust-4', kind: 'customer', name: 'CANADA-AFRICA STRATEGIC INVESTMENT GROUP INC.', email: 'edakan2@gmail.com', phone: '7789822757', cell_phone: null, company: null },
  { id: 'cust-5', kind: 'contact', name: 'Compassionate Hearts Adults Day Program', email: 'compassionatehearts.program@gmail.com', phone: '6395901921', cell_phone: null, company: null },
];

/** Fixture desk so the shared-contact and API-key flows can be exercised without a session. */
export default function E2EReceptionistHarness() {
  const [saved, setSaved] = useState('Nothing shared yet.');
  const [apiStatus, setApiStatus] = useState('No API key saved.');
  const [navLabel, setNavLabel] = useState('AI Receptionist');
  const [crmContacts, setCrmContacts] = useState(initialCrmContacts);

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
          contacts={crmContacts}
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
          onCreateContact={async (input) => {
            const created: CrmContact = {
              id: `new-${crmContacts.length + 1}`,
              kind: 'contact',
              name: input.name,
              email: input.email || null,
              phone: input.phone || null,
              cell_phone: input.cell_phone || null,
              company: null,
            };
            setCrmContacts((current) => [...current, created]);
            setSaved(`Added ${created.name}`);
            return created;
          }}
        />
      </div>
      <div style={{ marginTop: 24 }}>
        <FilingRemindersPanel
          organizationName="eFintax Advisors Ltd"
          fiscalYearEndMonth={12}
          deadlines={[]}
          periods={[]}
          contacts={crmContacts}
          today="2026-10-04"
          onSend={async (channel, to, body) => {
            setSaved(`Reminder ${channel} to ${to}: ${body}`);
          }}
        />
      </div>
    </div>
  );
}
