import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Database } from '@/integrations/supabase/types';

type Employee = Database['public']['Tables']['employees']['Row'];

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export default function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onConfirm,
  isDeleting = false,
}: DeleteEmployeeDialogProps) {
  if (!employee) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{employee.first_name} {employee.last_name}</strong>? 
            This action will remove the employee from active records. Historical payroll data will be preserved for compliance purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Employee'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
