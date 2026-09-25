import { useState, useEffect } from 'react';
import { 
  PenTool, 
  User, 
  Type, 
  Calendar, 
  CheckSquare, 
  Stamp, 
  Hash,
  Check,
  Mail,
  Building2,
  Briefcase,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SignaturePad } from './SignaturePad';
import { useDefaultSignature, useSaveSignature, UserSignature } from '@/hooks/useUserSignatures';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type FieldType = 'signature' | 'initial' | 'full_name' | 'first_name' | 'last_name' | 'email' | 'company' | 'title' | 'date' | 'checkbox' | 'text' | 'stamp';

interface FieldInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldType: FieldType;
  currentValue?: string;
  onSave: (value: string) => void;
  signerName?: string;
  signerEmail?: string;
  companyName?: string;
  jobTitle?: string;
}

export function FieldInteractionDialog({
  open,
  onOpenChange,
  fieldType,
  currentValue,
  onSave,
  signerName = '',
  signerEmail = '',
  companyName = '',
  jobTitle = '',
}: FieldInteractionDialogProps) {
  const { user } = useAuth();
  const { data: defaultSignature } = useDefaultSignature();
  const saveSignature = useSaveSignature();
  
  const [value, setValue] = useState(currentValue || '');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(currentValue === 'true');

  useEffect(() => {
    if (open) {
      setValue(currentValue || '');
      setCheckboxChecked(currentValue === 'true');
    }
  }, [open, currentValue]);

  const getFieldIcon = () => {
    switch (fieldType) {
      case 'signature': return PenTool;
      case 'initial': return User;
      case 'full_name': return Type;
      case 'first_name': return UserCircle;
      case 'last_name': return UserCircle;
      case 'email': return Mail;
      case 'company': return Building2;
      case 'title': return Briefcase;
      case 'date': return Calendar;
      case 'checkbox': return CheckSquare;
      case 'text': return Hash;
      case 'stamp': return Stamp;
      default: return Type;
    }
  };

  const getFieldTitle = () => {
    switch (fieldType) {
      case 'signature': return 'Add Signature';
      case 'initial': return 'Add Initials';
      case 'full_name': return 'Enter Full Name';
      case 'first_name': return 'Enter First Name';
      case 'last_name': return 'Enter Last Name';
      case 'email': return 'Enter Email Address';
      case 'company': return 'Enter Company Name';
      case 'title': return 'Enter Job Title';
      case 'date': return 'Select Date';
      case 'checkbox': return 'Checkbox';
      case 'text': return 'Enter Text';
      case 'stamp': return 'Add Stamp/Seal';
      default: return 'Enter Value';
    }
  };

  const getDefaultValue = () => {
    switch (fieldType) {
      case 'full_name': return signerName || user?.user_metadata?.full_name || '';
      case 'first_name': return signerName?.split(' ')[0] || user?.user_metadata?.first_name || '';
      case 'last_name': return signerName?.split(' ').slice(1).join(' ') || user?.user_metadata?.last_name || '';
      case 'email': return signerEmail || user?.email || '';
      case 'company': return companyName || user?.user_metadata?.company || '';
      case 'title': return jobTitle || user?.user_metadata?.job_title || '';
      default: return '';
    }
  };

  const handleSave = () => {
    if (fieldType === 'checkbox') {
      onSave(checkboxChecked ? 'true' : 'false');
    } else {
      onSave(value);
    }
    onOpenChange(false);
  };

  const handleSignatureSave = (signatureData: string, type: 'draw' | 'type' | 'upload') => {
    // Save to user's saved signatures
    if (user?.id) {
      saveSignature.mutate({
        signatureData,
        signatureType: type,
        setAsDefault: !defaultSignature,
      });
    }
    setValue(signatureData);
    setShowSignaturePad(false);
  };

  const useExistingSignature = (signature: UserSignature) => {
    setValue(signature.signature_data);
  };

  const Icon = getFieldIcon();

  // Signature & Initial fields - show signature pad
  if (fieldType === 'signature' || fieldType === 'initial') {
    return (
      <>
        <Dialog open={open && !showSignaturePad} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-accent" />
                {getFieldTitle()}
              </DialogTitle>
              <DialogDescription>
                {fieldType === 'signature' 
                  ? 'Add your signature to this field' 
                  : 'Add your initials to this field'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Show existing signature if available */}
              {defaultSignature && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Use Saved {fieldType === 'signature' ? 'Signature' : 'Initials'}</Label>
                  <button
                    className={cn(
                      'w-full p-4 border-2 rounded-lg transition-all hover:border-accent',
                      value === defaultSignature.signature_data && 'border-accent bg-accent/5'
                    )}
                    onClick={() => useExistingSignature(defaultSignature)}
                  >
                    <img 
                      src={defaultSignature.signature_data} 
                      alt="Saved signature" 
                      className="max-h-16 mx-auto"
                    />
                  </button>
                </div>
              )}

              {/* Preview of current value */}
              {value && value !== defaultSignature?.signature_data && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current {fieldType === 'signature' ? 'Signature' : 'Initials'}</Label>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <img src={value} alt="Current signature" className="max-h-16 mx-auto" />
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowSignaturePad(true)}
              >
                <PenTool className="w-4 h-4 mr-2" />
                {value ? 'Create New' : 'Create'} {fieldType === 'signature' ? 'Signature' : 'Initials'}
              </Button>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!value}
                className="bg-accent hover:bg-accent/90"
              >
                <Check className="w-4 h-4 mr-1" />
                Apply
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <SignaturePad
          open={showSignaturePad}
          onOpenChange={setShowSignaturePad}
          onSave={handleSignatureSave}
          signerName={signerName || user?.user_metadata?.full_name || ''}
          fieldType={fieldType}
        />
      </>
    );
  }

  // Stamp field - similar to signature but for stamps/seals
  if (fieldType === 'stamp') {
    return (
      <>
        <Dialog open={open && !showSignaturePad} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-accent" />
                {getFieldTitle()}
              </DialogTitle>
              <DialogDescription>
                Add your company stamp or seal
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Preview of current value */}
              {value && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Stamp</Label>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <img src={value} alt="Current stamp" className="max-h-24 mx-auto" />
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowSignaturePad(true)}
              >
                <Stamp className="w-4 h-4 mr-2" />
                {value ? 'Upload New Stamp' : 'Upload Stamp'}
              </Button>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!value}
                className="bg-accent hover:bg-accent/90"
              >
                <Check className="w-4 h-4 mr-1" />
                Apply
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <SignaturePad
          open={showSignaturePad}
          onOpenChange={setShowSignaturePad}
          onSave={handleSignatureSave}
          signerName=""
          fieldType="signature"
        />
      </>
    );
  }

  // Full Name field
  if (fieldType === 'full_name') {
    const defaultName = signerName || user?.user_metadata?.full_name || '';
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Enter the full legal name for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={value || defaultName}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter full name"
                autoFocus
              />
            </div>

            {defaultName && !value && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setValue(defaultName)}
              >
                <User className="w-4 h-4 mr-2" />
                Use "{defaultName}"
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!value && !defaultName}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Date field
  if (fieldType === 'date') {
    const today = format(new Date(), 'yyyy-MM-dd');
    const formattedToday = format(new Date(), 'MMMM d, yyyy');
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Select the date for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={value || today}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setValue(today)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Use Today ({formattedToday})
            </Button>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Checkbox field
  if (fieldType === 'checkbox') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Toggle the checkbox value
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-3 py-4">
            <Checkbox
              id="checkbox-value"
              checked={checkboxChecked}
              onCheckedChange={(checked) => setCheckboxChecked(checked as boolean)}
              className="w-6 h-6"
            />
            <Label htmlFor="checkbox-value" className="text-base cursor-pointer">
              {checkboxChecked ? 'Checked' : 'Unchecked'}
            </Label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // First Name field
  if (fieldType === 'first_name') {
    const defaultFirstName = getDefaultValue();
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Enter the first name for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={value || defaultFirstName}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter first name"
                autoFocus
              />
            </div>

            {defaultFirstName && !value && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setValue(defaultFirstName)}
              >
                <UserCircle className="w-4 h-4 mr-2" />
                Use "{defaultFirstName}"
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!value && !defaultFirstName}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Last Name field
  if (fieldType === 'last_name') {
    const defaultLastName = getDefaultValue();
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Enter the last name for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={value || defaultLastName}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter last name"
                autoFocus
              />
            </div>

            {defaultLastName && !value && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setValue(defaultLastName)}
              >
                <UserCircle className="w-4 h-4 mr-2" />
                Use "{defaultLastName}"
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!value && !defaultLastName}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Email Address field
  if (fieldType === 'email') {
    const defaultEmail = getDefaultValue();
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Enter the email address for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={value || defaultEmail}
                onChange={(e) => setValue(e.target.value)}
                placeholder="name@example.com"
                autoFocus
              />
            </div>

            {defaultEmail && !value && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setValue(defaultEmail)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Use "{defaultEmail}"
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!value && !defaultEmail}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Company field
  if (fieldType === 'company') {
    const defaultCompany = getDefaultValue();
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Enter the company name for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={value || defaultCompany}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter company name"
                autoFocus
              />
            </div>

            {defaultCompany && !value && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setValue(defaultCompany)}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Use "{defaultCompany}"
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!value && !defaultCompany}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Title/Job Title field
  if (fieldType === 'title') {
    const defaultTitle = getDefaultValue();
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              {getFieldTitle()}
            </DialogTitle>
            <DialogDescription>
              Enter the job title for this field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input
                value={value || defaultTitle}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g., CEO, Manager, Director"
                autoFocus
              />
            </div>

            {defaultTitle && !value && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setValue(defaultTitle)}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Use "{defaultTitle}"
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!value && !defaultTitle}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Text field (default)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-accent" />
            {getFieldTitle()}
          </DialogTitle>
          <DialogDescription>
            Enter the text for this field
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Text</Label>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter text..."
              rows={3}
              autoFocus
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!value}
            className="bg-accent hover:bg-accent/90"
          >
            <Check className="w-4 h-4 mr-1" />
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
