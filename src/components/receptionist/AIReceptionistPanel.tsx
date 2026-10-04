import { AIReceptionistDesk } from '@/components/receptionist/AIReceptionistDesk';
import { useOrganizationApiCredentials } from '@/hooks/useOrganizationApiCredentials';
import { useReceptionistDesk } from '@/hooks/useReceptionistDesk';

export function AIReceptionistPanel({ onActivity }: { onActivity?: () => void }) {
  const desk = useReceptionistDesk();
  const api = useOrganizationApiCredentials();

  return (
    <AIReceptionistDesk
      contacts={desk.filteredContacts}
      activities={desk.activities}
      answering={desk.answering}
      isSending={desk.isSending}
      credentials={api.credentials}
      credentialError={api.loadError}
      onAnsweringChange={desk.setAnsweringEnabled}
      onSaveCredential={api.saveCredential}
      onTestCredential={api.testCredential}
      onSend={async (contact, body, kind) => {
        const saved = await desk.logCallerMessage(contact, body, kind);
        if (saved) onActivity?.();
        return saved;
      }}
    />
  );
}
