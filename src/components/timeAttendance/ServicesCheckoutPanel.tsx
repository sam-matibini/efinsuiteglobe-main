import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { CompanyTimeSettings } from '@/lib/timeAttendance/types';

const SERVICES = [
  { key: 'accounting', label: 'Accounting', locked: true },
  { key: 'payroll', label: 'Payroll', locked: true },
  { key: 'tax', label: 'Tax', locked: true },
  { key: 'cra', label: 'CRA Services', locked: true },
  { key: 'banking', label: 'Banking', locked: true },
] as const;

interface ServicesCheckoutPanelProps {
  company: CompanyTimeSettings;
  onSave: (company: CompanyTimeSettings) => Promise<void> | void;
  busy?: boolean;
}

export function ServicesCheckoutPanel({ company, onSave, busy }: ServicesCheckoutPanelProps) {
  const [draft, setDraft] = useState(company);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDraft(company);
  }, [company]);

  const selected = draft.enabled;
  const setFlag = (patch: Partial<CompanyTimeSettings>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Services Checkout</CardTitle>
        <p className="text-sm text-muted-foreground">eFinsuite Services</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {SERVICES.map((service) => (
          <label key={service.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked readOnly />
            {service.label}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => {
              const enabled = event.target.checked;
              setFlag({ enabled, clockInOutEnabled: enabled ? draft.clockInOutEnabled : false });
              if (enabled) setOpen(true);
            }}
          />
          Time & Attendance
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected} onChange={(event) => setFlag({ enabled: event.target.checked, clockInOutEnabled: event.target.checked })} />
          Employee Clock-In / Clock-Out
        </label>

        {selected && (
          <div className="space-y-3 rounded-md border p-4">
            <p className="font-medium">Time & Attendance</p>
            <Flag label="Employee Clock-In/Out" checked={draft.clockInOutEnabled} onChange={(clockInOutEnabled) => setFlag({ clockInOutEnabled })} />
            <Flag label="Payroll Integration" checked={draft.payrollIntegration} onChange={(payrollIntegration) => setFlag({ payrollIntegration })} />
            <Flag label="Manager Approval" checked={draft.managerApprovalRequired} onChange={(managerApprovalRequired) => setFlag({ managerApprovalRequired })} />
            <Flag label="Overtime Tracking" checked={draft.overtimeEnabled} onChange={(overtimeEnabled) => setFlag({ overtimeEnabled })} />
            <Flag label="Break Tracking" checked={draft.breakTrackingEnabled} onChange={(breakTrackingEnabled) => setFlag({ breakTrackingEnabled })} />
            <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>Configure</Button>
            {open && (
              <div className="grid gap-3 border-t pt-3 text-sm md:grid-cols-2">
                <label>
                  Breaks
                  <select
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                    value={draft.breakMode}
                    onChange={(event) => setFlag({ breakMode: event.target.value as CompanyTimeSettings['breakMode'] })}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="automatic">Automatically deducted</option>
                    <option value="manual">Manually recorded</option>
                  </select>
                </label>
                <label>
                  Automatic break minutes
                  <input
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                    type="number"
                    min={0}
                    value={draft.autoBreakMinutes}
                    onChange={(event) => setFlag({ autoBreakMinutes: Number(event.target.value) || 0 })}
                  />
                </label>
                <label>
                  Timezone
                  <input
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                    value={draft.timezone}
                    onChange={(event) => setFlag({ timezone: event.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 self-end">
                  <input
                    type="checkbox"
                    checked={draft.allowUnresolvedPayroll}
                    onChange={(event) => setFlag({ allowUnresolvedPayroll: event.target.checked })}
                  />
                  Allow payroll with unresolved records
                </label>
                <label>
                  Daily regular hours
                  <input
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                    type="number"
                    min={0}
                    step="0.25"
                    value={draft.overtimePolicy.dailyRegularLimit}
                    onChange={(event) => setFlag({
                      overtimePolicy: { ...draft.overtimePolicy, dailyRegularLimit: Number(event.target.value) || 0 },
                    })}
                  />
                </label>
                <label>
                  Weekly regular hours
                  <input
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                    type="number"
                    min={0}
                    step="0.25"
                    value={draft.overtimePolicy.weeklyRegularLimit}
                    onChange={(event) => setFlag({
                      overtimePolicy: { ...draft.overtimePolicy, weeklyRegularLimit: Number(event.target.value) || 0 },
                    })}
                  />
                </label>
                <label>
                  Overtime multiplier
                  <input
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                    type="number"
                    min={1}
                    step="0.1"
                    value={draft.overtimePolicy.overtimeMultiplier}
                    onChange={(event) => setFlag({
                      overtimePolicy: { ...draft.overtimePolicy, overtimeMultiplier: Number(event.target.value) || 1.5 },
                    })}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => onSave({ ...draft, enabled: selected })}>
            Save services
          </Button>
        </div>
        {!selected && (
          <p className="text-sm text-muted-foreground">
            Clock-in stays hidden. Payroll continues with each employee’s existing salary or hours.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Flag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
