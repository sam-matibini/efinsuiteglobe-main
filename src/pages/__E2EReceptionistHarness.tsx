import { useState } from 'react';
import { AIReceptionistDesk } from '@/components/receptionist/AIReceptionistDesk';
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

/** Fixture desk so the shared-contact and API-key flows can be exercised without a session. */
export default function E2EReceptionistHarness() {
  const [saved, setSaved] = useState('Nothing shared yet.');
  const [apiStatus, setApiStatus] = useState('No API key saved.');

  return (
    <div style={{ padding: 24 }}>
      <p data-testid="share-result">{saved}</p>
      <p data-testid="api-result">{apiStatus}</p>
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
    </div>
  );
}
