import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** One entry of employee_import_batches.error_report, written by the employee-bulk-import function. */
export interface EmployeeImportPostError {
  rowId: string;
  sheet?: string;
  row?: number;
  employeeNumber?: string | null;
  error: string;
}

export function EmployeeImportErrors({ errors }: { errors: EmployeeImportPostError[] }) {
  if (!errors.length) return null;
  // Only the outdated employee-bulk-import function writes errors without a sheet/row.
  const fromOutdatedFunction = errors.some((e) => !e.sheet);
  return (
    <div className="space-y-2">
    {fromOutdatedFunction && (
      <div className="p-3 rounded-md bg-warning/10 text-warning text-xs">
        These errors were produced by an outdated version of the server upload function, which does not save the NIN.
        Deploy the latest <code>employee-bulk-import</code> function and the employee import migration
        (<code>npm run supabase:deploy</code> or the “Deploy Supabase” GitHub workflow), then upload the file again.
      </div>
    )}
    <div className="overflow-auto max-h-[420px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Sheet</TableHead>
            <TableHead className="w-16">Row</TableHead>
            <TableHead className="w-36">Employee ID</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {errors.slice(0, 500).map((e) => (
            <TableRow key={e.rowId}>
              <TableCell className="text-xs capitalize">{e.sheet ?? '—'}</TableCell>
              <TableCell className="text-xs">{e.row ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{e.employeeNumber ?? '—'}</TableCell>
              <TableCell className={`text-xs ${e.error.startsWith('Skipped:') ? 'text-warning' : 'text-destructive'}`}>{e.error}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {errors.length > 500 && (
        <div className="p-2 text-xs text-muted-foreground text-center">Showing first 500 of {errors.length}.</div>
      )}
    </div>
    </div>
  );
}
