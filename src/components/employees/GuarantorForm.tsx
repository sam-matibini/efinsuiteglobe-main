import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmployeeGuarantor } from '@/hooks/useEmployeeGuarantors';
import type { GuarantorRequirement } from '@/lib/addEmployee';

export type GuarantorDraft = Omit<EmployeeGuarantor, 'employee_id' | 'organization_id' | 'id'>;

export const EMPTY_GUARANTOR = (order: 1 | 2): GuarantorDraft => ({
  guarantor_order: order,
  full_name: '',
  sex: '',
  phone_number: '',
  email: '',
  marital_status: '',
  relationship: '',
  profession: '',
  residential_address: '',
  residential_city: '',
  residential_postal_code: '',
  residential_state: '',
  residential_country: '',
  office_address: '',
  office_city: '',
  office_postal_code: '',
  office_state: '',
  office_country: '',
  notes: '',
  confirmed: false,
  confirmation_method: '',
});

export function isGuarantorComplete(g: GuarantorDraft): boolean {
  return !!(g.full_name && g.full_name.trim().length > 0 && g.confirmed);
}

export function GuarantorRequirementToggle({
  requirement,
  onChange,
  className,
}: {
  requirement: GuarantorRequirement;
  onChange: (requirement: GuarantorRequirement) => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-muted/40 p-3 space-y-2', className)}>
      <div>
        <p className="text-sm font-semibold">Guarantors</p>
        <p className="text-xs text-muted-foreground">
          Optional by default. Use Mandatory only where company or regional policy requires them.
        </p>
      </div>
      <div role="group" aria-label="Guarantor requirement" className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={requirement === 'optional' ? 'default' : 'outline'}
          className={cn('h-9', requirement === 'optional' && 'shadow-sm')}
          onClick={() => onChange('optional')}
        >
          Optional
        </Button>
        <Button
          type="button"
          variant={requirement === 'mandatory' ? 'default' : 'outline'}
          className={cn('h-9', requirement === 'mandatory' && 'shadow-sm')}
          onClick={() => onChange('mandatory')}
        >
          Mandatory
        </Button>
      </div>
    </div>
  );
}

interface Props {
  value: GuarantorDraft;
  onChange: (next: GuarantorDraft) => void;
  title: string;
  required: boolean;
}

function GuarantorFields({ value, onChange, title, required }: Props) {
  const set = <K extends keyof GuarantorDraft>(k: K, v: GuarantorDraft[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary" />
        <h4 className="font-medium">{title}</h4>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>Full Name{required ? ' *' : ''}</Label>
          <Input
            value={value.full_name ?? ''}
            onChange={(e) => set('full_name', e.target.value)}
            placeholder="Guarantor full name"
            maxLength={150}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Sex</Label>
          <SearchableSelect
            value={value.sex ?? ''}
            onValueChange={(v) => set('sex', v)}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
            placeholder="Select"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Phone Number</Label>
          <Input
            value={value.phone_number ?? ''}
            onChange={(e) => set('phone_number', e.target.value)}
            placeholder="+234 ..."
            maxLength={30}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Marital Status</Label>
          <SearchableSelect
            value={value.marital_status ?? ''}
            onValueChange={(v) => set('marital_status', v)}
            options={[
              { value: 'single', label: 'Single' },
              { value: 'married', label: 'Married' },
              { value: 'divorced', label: 'Divorced' },
              { value: 'widowed', label: 'Widowed' },
            ]}
            placeholder="Select"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Input
            value={value.relationship ?? ''}
            onChange={(e) => set('relationship', e.target.value)}
            placeholder="e.g. Brother, Friend, Pastor"
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label>Profession</Label>
          <Input
            value={value.profession ?? ''}
            onChange={(e) => set('profession', e.target.value)}
            placeholder="e.g. Civil Servant, Engineer"
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label>Email (optional)</Label>
          <Input
            type="email"
            value={value.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            placeholder="guarantor@email.com"
            maxLength={200}
          />
        </div>
      </div>

      {/* Residential Address */}
      <div className="pt-2">
        <h5 className="text-sm font-medium text-muted-foreground mb-2">Residential Address</h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Address</Label>
            <Input
              value={value.residential_address ?? ''}
              onChange={(e) => set('residential_address', e.target.value)}
              maxLength={250}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Town / City</Label>
            <Input
              value={value.residential_city ?? ''}
              onChange={(e) => set('residential_city', e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Postal Code</Label>
            <Input
              value={value.residential_postal_code ?? ''}
              onChange={(e) => set('residential_postal_code', e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State / Province</Label>
            <Input
              value={value.residential_state ?? ''}
              onChange={(e) => set('residential_state', e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input
              value={value.residential_country ?? ''}
              onChange={(e) => set('residential_country', e.target.value)}
              maxLength={80}
            />
          </div>
        </div>
      </div>

      {/* Office Address */}
      <div className="pt-2">
        <h5 className="text-sm font-medium text-muted-foreground mb-2">Office Address</h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Address</Label>
            <Input
              value={value.office_address ?? ''}
              onChange={(e) => set('office_address', e.target.value)}
              maxLength={250}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Town / City</Label>
            <Input
              value={value.office_city ?? ''}
              onChange={(e) => set('office_city', e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Postal Code</Label>
            <Input
              value={value.office_postal_code ?? ''}
              onChange={(e) => set('office_postal_code', e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State / Province</Label>
            <Input
              value={value.office_state ?? ''}
              onChange={(e) => set('office_state', e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input
              value={value.office_country ?? ''}
              onChange={(e) => set('office_country', e.target.value)}
              maxLength={80}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes (optional)</Label>
        <Textarea
          value={value.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          maxLength={500}
        />
      </div>

      {/* Mandatory confirmation */}
      <div className={`rounded-md border p-3 ${value.confirmed ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'}`}>
        <div className="flex items-start gap-3">
          <Checkbox
            id={`confirm-${value.guarantor_order}`}
            checked={!!value.confirmed}
            onCheckedChange={(v) => set('confirmed', v === true)}
          />
          <div className="flex-1 space-y-2">
            <Label htmlFor={`confirm-${value.guarantor_order}`} className="flex items-center gap-1.5 font-medium">
              {value.confirmed ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              )}
              Guarantor confirmation{required ? ' (required) *' : ' (optional)'}
            </Label>
            <p className="text-xs text-muted-foreground">
              I confirm this guarantor has agreed to act as surety for the employee.
              {required
                ? ' This confirmation is required before the employee can be added.'
                : ' You can confirm later if guarantors are optional for this hire.'}
            </p>
            {value.confirmed && (
              <div className="space-y-1.5">
                <Label className="text-xs">Confirmation method</Label>
                <SearchableSelect
                  value={value.confirmation_method ?? ''}
                  onValueChange={(v) => set('confirmation_method', v)}
                  options={[
                    { value: 'signature', label: 'Signed form' },
                    { value: 'email', label: 'Email confirmation' },
                    { value: 'phone', label: 'Phone confirmation' },
                    { value: 'in_person', label: 'In-person confirmation' },
                    { value: 'manual', label: 'Manual / other' },
                  ]}
                  placeholder="Select method"
                  className="h-8"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface GuarantorsFormProps {
  first: GuarantorDraft;
  second: GuarantorDraft;
  onChangeFirst: (g: GuarantorDraft) => void;
  onChangeSecond: (g: GuarantorDraft) => void;
  requirement?: GuarantorRequirement;
  onRequirementChange?: (requirement: GuarantorRequirement) => void;
}

export function GuarantorsForm({
  first,
  second,
  onChangeFirst,
  onChangeSecond,
  requirement = 'optional',
  onRequirementChange,
}: GuarantorsFormProps) {
  const [localRequirement, setLocalRequirement] = useState<GuarantorRequirement>(requirement);
  const currentRequirement = onRequirementChange ? requirement : localRequirement;
  const required = currentRequirement === 'mandatory';
  const bothOk = isGuarantorComplete(first) && isGuarantorComplete(second);

  const setRequirement = (next: GuarantorRequirement) => {
    setLocalRequirement(next);
    onRequirementChange?.(next);
  };

  return (
    <div className="space-y-4">
      <GuarantorRequirementToggle requirement={currentRequirement} onChange={setRequirement} />
      <div className={`rounded-md border p-3 text-sm ${bothOk ? 'border-emerald-300 bg-emerald-50/40 text-emerald-800' : required ? 'border-amber-300 bg-amber-50/40 text-amber-900' : 'border-muted bg-muted/40 text-muted-foreground'}`}>
        {bothOk ? (
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Both guarantors provided and confirmed — employee can be fully onboarded.</span>
        ) : required ? (
          <span className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Both guarantors (name + confirmation checkbox) are required before this employee can be added.</span>
        ) : (
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Guarantors are optional for this hire. You can add them later before marking the employee active.</span>
        )}
      </div>
      <GuarantorFields title="1st Guarantor" value={first} onChange={onChangeFirst} required={required} />
      <GuarantorFields title="2nd Guarantor" value={second} onChange={onChangeSecond} required={required} />
    </div>
  );
}
