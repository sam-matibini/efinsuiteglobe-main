import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryItems, useCreateInventoryLot, useCreateInventoryTransaction, useUpdateInventoryItem } from '@/hooks/useInventory';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { format } from 'date-fns';

interface ReceiveInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiveInventoryDialog({ open, onOpenChange }: ReceiveInventoryDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: items = [] } = useInventoryItems(organization?.id);
  const createLot = useCreateInventoryLot();
  const createTransaction = useCreateInventoryTransaction(organization?.id);
  const updateItem = useUpdateInventoryItem();
  
  const [formData, setFormData] = useState({
    item_id: '',
    quantity: 0,
    unit_cost: 0,
    lot_number: '',
    received_date: format(new Date(), 'yyyy-MM-dd'),
    reference: '',
    notes: '',
  });

  const selectedItem = items.find(i => i.id === formData.item_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_id || formData.quantity <= 0) return;
    
    const totalCost = formData.quantity * formData.unit_cost;
    
    await createLot.mutateAsync({
      item_id: formData.item_id,
      lot_number: formData.lot_number || null,
      quantity_received: formData.quantity,
      quantity_remaining: formData.quantity,
      unit_cost: formData.unit_cost,
      received_date: formData.received_date,
      expiry_date: null,
      reference: formData.reference || null,
    });
    
    await createTransaction.mutateAsync({
      item_id: formData.item_id,
      transaction_type: 'purchase',
      transaction_date: formData.received_date,
      reference: formData.reference || null,
      quantity: formData.quantity,
      unit_cost: formData.unit_cost,
      total_cost: totalCost,
      notes: formData.notes || null,
    });
    
    if (selectedItem) {
      await updateItem.mutateAsync({
        id: selectedItem.id,
        quantity_on_hand: selectedItem.quantity_on_hand + formData.quantity,
        cost_price: formData.unit_cost,
      });
    }
    
    onOpenChange(false);
    setFormData({ item_id: '', quantity: 0, unit_cost: 0, lot_number: '', received_date: format(new Date(), 'yyyy-MM-dd'), reference: '', notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Receive Inventory</DialogTitle></DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Item *</Label>
            <Select value={formData.item_id} onValueChange={(v) => { const item = items.find(i => i.id === v); setFormData({ ...formData, item_id: v, unit_cost: item?.cost_price || 0 }); }}>
              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>{items.filter(i => i.is_active).map((item) => (<SelectItem key={item.id} value={item.id}>{item.sku} - {item.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input type="number" step="0.0001" min="0.0001" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })} required />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost *</Label>
              <Input type="number" step="0.01" min="0" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })} required />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lot Number</Label>
              <Input value={formData.lot_number} onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Received Date *</Label>
              <Input type="date" value={formData.received_date} onChange={(e) => setFormData({ ...formData, received_date: e.target.value })} required />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createLot.isPending}>Receive Inventory</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
