import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wallet,
  Factory,
  FolderKanban,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { BUDGET_TYPE_CATEGORIES, type BudgetType } from '@/types/budget';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: 'financial' | 'production' | 'program';
}

export function CreateBudgetDialog({ open, onOpenChange, defaultCategory = 'financial' }: CreateBudgetDialogProps) {
  const navigate = useNavigate();
  const { createBudget } = useBudgets();
  const [category, setCategory] = useState<'financial' | 'production' | 'program'>(defaultCategory);
  const [selectedType, setSelectedType] = useState<BudgetType | null>(null);
  const [useAI, setUseAI] = useState(false);

  const currentYear = new Date().getFullYear();
  const fiscalYears = [
    `${currentYear - 1}`,
    `${currentYear}`,
    `${currentYear + 1}`,
  ];

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      name: '',
      description: '',
      fiscal_year: `${currentYear}`,
      period_type: 'monthly',
      start_date: `${currentYear}-01-01`,
      end_date: `${currentYear}-12-31`,
      currency: 'CAD',
    },
  });

  const onSubmit = async (data: any) => {
    if (!selectedType) return;

    try {
      const result = await createBudget.mutateAsync({
        ...data,
        budget_type: selectedType,
        ai_generated: useAI,
      });
      
      reset();
      onOpenChange(false);
      
      if (result?.id) {
        navigate(`/budgets/${result.id}`);
      }
    } catch (error) {
      console.error('Failed to create budget:', error);
    }
  };

  const handleTypeSelect = (type: BudgetType) => {
    setSelectedType(type);
    // Auto-generate name based on type
    const typeConfig = [...BUDGET_TYPE_CATEGORIES.financial, ...BUDGET_TYPE_CATEGORIES.production, ...BUDGET_TYPE_CATEGORIES.program]
      .find(t => t.value === type);
    if (typeConfig) {
      setValue('name', `${typeConfig.label} - FY ${watch('fiscal_year')}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Budget
          </DialogTitle>
          <DialogDescription>
            Set up a new budget for financial, production, or program planning
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              {/* Budget Category */}
              <div className="space-y-3">
                <Label>Budget Category</Label>
                <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="financial" className="gap-2">
                      <Wallet className="h-4 w-4" />
                      Financial
                    </TabsTrigger>
                    <TabsTrigger value="production" className="gap-2">
                      <Factory className="h-4 w-4" />
                      Production
                    </TabsTrigger>
                    <TabsTrigger value="program" className="gap-2">
                      <FolderKanban className="h-4 w-4" />
                      Program
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="financial" className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {BUDGET_TYPE_CATEGORIES.financial.map((type) => (
                        <div
                          key={type.value}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedType === type.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-muted-foreground/50'
                          }`}
                          onClick={() => handleTypeSelect(type.value as BudgetType)}
                        >
                          <div className="font-medium text-sm">{type.label}</div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="production" className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {BUDGET_TYPE_CATEGORIES.production.map((type) => (
                        <div
                          key={type.value}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedType === type.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-muted-foreground/50'
                          }`}
                          onClick={() => handleTypeSelect(type.value as BudgetType)}
                        >
                          <div className="font-medium text-sm">{type.label}</div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="program" className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {BUDGET_TYPE_CATEGORIES.program.map((type) => (
                        <div
                          key={type.value}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedType === type.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-muted-foreground/50'
                          }`}
                          onClick={() => handleTypeSelect(type.value as BudgetType)}
                        >
                          <div className="font-medium text-sm">{type.label}</div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Budget Details */}
              {selectedType && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="name">Budget Name</Label>
                      <Input
                        id="name"
                        {...register('name', { required: 'Name is required' })}
                        placeholder="e.g., Operating Budget - FY 2024"
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fiscal_year">Fiscal Year</Label>
                      <Select
                        value={watch('fiscal_year')}
                        onValueChange={(v) => setValue('fiscal_year', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fiscalYears.map((year) => (
                            <SelectItem key={year} value={year}>
                              FY {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="period_type">Period Type</Label>
                      <Select
                        value={watch('period_type')}
                        onValueChange={(v) => setValue('period_type', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        {...register('start_date', { required: true })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        {...register('end_date', { required: true })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={watch('currency')}
                        onValueChange={(v) => setValue('currency', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="ZMW">ZMW - Zambian Kwacha</SelectItem>
                          <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                          <SelectItem value="BIF">BIF - Burundian Franc</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea
                        id="description"
                        {...register('description')}
                        placeholder="Add notes or description for this budget..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* AI Option */}
                  <div className="space-y-3">
                    <Label>Budget Generation</Label>
                    <RadioGroup
                      value={useAI ? 'ai' : 'manual'}
                      onValueChange={(v) => setUseAI(v === 'ai')}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${
                        !useAI ? 'border-primary bg-primary/5' : ''
                      }`}>
                        <RadioGroupItem value="manual" id="manual" className="mt-1" />
                        <div>
                          <Label htmlFor="manual" className="cursor-pointer font-medium">
                            Start from Scratch
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Manually enter budget line items
                          </p>
                        </div>
                      </div>
                      <div className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${
                        useAI ? 'border-primary bg-primary/5' : ''
                      }`}>
                        <RadioGroupItem value="ai" id="ai" className="mt-1" />
                        <div>
                          <Label htmlFor="ai" className="cursor-pointer font-medium flex items-center gap-2">
                            AI-Assisted
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Recommended
                            </Badge>
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Let AI analyze history and suggest budget
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedType || createBudget.isPending}>
              {createBudget.isPending ? 'Creating...' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
