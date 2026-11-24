import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** One entry of employee_import_batches.error_report. */
export interface UploadErrorEntry {
  rowId: string;
  sheet?: string;
  row?: number;
  employeeNumber?: string | null;
  error: string;
}

/** Error list for a past import batch (Import History). */
export function UploadErrorList({ errors }: { errors: UploadErrorEntry[] }) {
  if (!errors.length) return <p className="text-sm text-muted-foreground">No errors were recorded for this import.</p>;
  const legacy = errors.some((e) => !e.sheet);
  return (
    <div className="space-y-2">
      {legacy && (
        <div className="p-3 rounded-md bg-muted text-muted-foreground text-xs">
          This import ran on the previous upload engine, which did not record row numbers and did not save the NIN.
          Upload the file again — the new engine imports it correctly.
        </div>
      )}
      <div className="overflow-auto max-h-[420px] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Row</TableHead>
              <TableHead className="w-40">Employee ID</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.slice(0, 1000).map((e, i) => (
              <TableRow key={`${e.rowId}-${i}`}>
                <TableCell className="text-xs">{e.row ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{e.employeeNumber ?? '—'}</TableCell>
                <TableCell className={`text-xs ${e.error?.startsWith('Skipped:') ? 'text-warning' : 'text-destructive'}`}>{e.error}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
