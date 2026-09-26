import { AdminCraSettingsForm } from '@/components/admin/AdminCraSettingsForm';

export default function AdminTaxCra() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tax & CRA</h1>
        <p className="text-muted-foreground">
          Save the firm representative ID and EFILE software credentials used for tax reporting, payments, and enquiries.
        </p>
      </div>
      <AdminCraSettingsForm />
    </div>
  );
}
