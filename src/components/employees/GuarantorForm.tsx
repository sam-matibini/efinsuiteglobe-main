import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus } from 'lucide-react';
import type { EmployeeGuarantor } from '@/hooks/useEmployeeGuarantors';

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
});

interface Props {
  value: GuarantorDraft;
  onChange: (next: GuarantorDraft) => void;
  title: string;
}

function GuarantorFields({ value, onChange, title }: Props) {
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
          <Label>Full Name *</Label>
          <Input
            value={value.full_name ?? ''}
            onChange={(e) => set('full_name', e.target.value)}
            placeholder="Guarantor full name"
            maxLength={150}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Sex</Label>
          <Select value={value.sex ?? ''} onValueChange={(v) => set('sex', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
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
          <Select value={value.marital_status ?? ''} onValueChange={(v) => set('marital_status', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married">Married</SelectItem>
              <SelectItem value="divorced">Divorced</SelectItem>
              <SelectItem value="widowed">Widowed</SelectItem>
            </SelectContent>
          </Select>
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
    </Card>
  );
}

interface GuarantorsFormProps {
  first: GuarantorDraft;
  second: GuarantorDraft;
  onChangeFirst: (g: GuarantorDraft) => void;
  onChangeSecond: (g: GuarantorDraft) => void;
}

export function GuarantorsForm({ first, second, onChangeFirst, onChangeSecond }: GuarantorsFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Provide two guarantors as surety in case of default or termination. Guarantor 1 is required;
        Guarantor 2 is recommended for full compliance.
      </p>
      <GuarantorFields title="1st Guarantor" value={first} onChange={onChangeFirst} />
      <GuarantorFields title="2nd Guarantor" value={second} onChange={onChangeSecond} />
    </div>
  );
}
