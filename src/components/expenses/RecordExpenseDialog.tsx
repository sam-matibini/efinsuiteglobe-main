import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, Car, ListPlus } from 'lucide-react';
import { RecordExpenseTab } from './RecordExpenseTab';
import { RecordMileageTab } from './RecordMileageTab';
import { BulkAddExpensesTab } from './BulkAddExpensesTab';

interface RecordExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordExpenseDialog({ open, onOpenChange }: RecordExpenseDialogProps) {
  const [activeTab, setActiveTab] = useState('expense');

  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Record Expenses
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="expense" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Record Expense
            </TabsTrigger>
            <TabsTrigger value="mileage" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Record Mileage
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <ListPlus className="w-4 h-4" />
              Bulk Add Expenses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expense" className="mt-0">
            <RecordExpenseTab onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="mileage" className="mt-0">
            <RecordMileageTab onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="bulk" className="mt-0">
            <BulkAddExpensesTab onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
