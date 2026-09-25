import { ShieldCheck } from 'lucide-react';

export function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
      <ShieldCheck className="h-4 w-4 shrink-0" />
      <span>You have <strong>read-only</strong> access (Auditor). You cannot create, edit, or delete records.</span>
    </div>
  );
}
