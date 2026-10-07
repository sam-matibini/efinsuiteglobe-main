/**
 * E2E-only page for the new-customer contact person field.
 * Registered at /__e2e__/customer-contact when served with VITE_E2E=1.
 */
import { AddCustomerDialog } from '@/components/customers/AddCustomerDialog';

export default function E2ECustomerContactHarness() {
  return (
    <div style={{ minHeight: '100vh', background: '#e8eaf2' }}>
      <AddCustomerDialog open onOpenChange={() => undefined} />
    </div>
  );
}
