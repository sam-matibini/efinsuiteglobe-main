import { VirtualAccountsList } from '@/components/virtual-accounts/VirtualAccountsList';

export default function VirtualAccounts() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Virtual Accounts</h1>
        <p className="text-muted-foreground">
          Manage the virtual bank accounts your organization uses to receive and hold funds for outgoing payments.
        </p>
      </div>
      <VirtualAccountsList />
    </div>
  );
}
