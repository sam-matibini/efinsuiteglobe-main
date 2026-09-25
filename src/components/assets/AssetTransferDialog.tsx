import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, MapPin } from 'lucide-react';
import { FixedAsset } from '@/hooks/useFixedAssets';
import { useCreateAssetMovement } from '@/hooks/useFixedAssetsRegister';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface AssetTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
}

export function AssetTransferDialog({ open, onOpenChange, asset }: AssetTransferDialogProps) {
  const createMovement = useCreateAssetMovement();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    movement_type: 'location_change',
    movement_date: format(new Date(), 'yyyy-MM-dd'),
    to_location: '',
    to_department: '',
    to_custodian: '',
    reason: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    
    // Record the movement
    await createMovement.mutateAsync({
      asset_id: asset.id,
      movement_type: formData.movement_type,
      movement_date: formData.movement_date,
      from_location: (asset as any).location || null,
      to_location: formData.to_location || null,
      from_department: (asset as any).department || (asset as any).cost_center || null,
      to_department: formData.to_department || null,
      from_custodian: null,
      to_custodian: formData.to_custodian || null,
      reason: formData.reason || null,
      approved_by: null,
      approved_at: null,
      notes: formData.notes || null,
      created_by: null,
    });

    // Update the asset with new location/department
    await supabase
      .from('fixed_assets')
      .update({
        location: formData.to_location || undefined,
        cost_center: formData.to_department || undefined,
      })
      .eq('id', asset.id);

    queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    onOpenChange(false);
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Transfer Asset
          </DialogTitle>
          <DialogDescription>
            Record a location or department transfer for {asset.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Transfer Type *</Label>
              <Select value={formData.movement_type} onValueChange={(v) => setFormData({ ...formData, movement_type: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="location_change">Location Change</SelectItem>
                  <SelectItem value="department_change">Department Change</SelectItem>
                  <SelectItem value="custodian_change">Custodian Change</SelectItem>
                  <SelectItem value="transfer">General Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transfer Date *</Label>
              <Input 
                type="date" 
                value={formData.movement_date} 
                onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })} 
                required 
              />
            </div>
          </div>

          {(formData.movement_type === 'location_change' || formData.movement_type === 'transfer') && (
            <div className="space-y-2">
              <Label>New Location</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={(asset as any).location || 'Not set'}
                  disabled
                  className="flex-1 bg-muted"
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Input 
                  value={formData.to_location}
                  onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                  placeholder="New location"
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {(formData.movement_type === 'department_change' || formData.movement_type === 'transfer') && (
            <div className="space-y-2">
              <Label>New Department / Cost Center</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={(asset as any).cost_center || 'Not set'}
                  disabled
                  className="flex-1 bg-muted"
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Input 
                  value={formData.to_department}
                  onChange={(e) => setFormData({ ...formData, to_department: e.target.value })}
                  placeholder="New department"
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {formData.movement_type === 'custodian_change' && (
            <div className="space-y-2">
              <Label>New Custodian</Label>
              <Input 
                value={formData.to_custodian}
                onChange={(e) => setFormData({ ...formData, to_custodian: e.target.value })}
                placeholder="Name of new custodian"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Input 
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Reason for transfer"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMovement.isPending}>
              {createMovement.isPending ? 'Processing...' : 'Record Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
