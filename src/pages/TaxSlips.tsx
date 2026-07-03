import { useState, useMemo } from 'react';
import { FileText, Download, Check, Trash2, AlertCircle, FileCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useTaxSlips } from '@/hooks/useTaxSlips';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { downloadT4Pdf } from '@/lib/generateT4Pdf';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getPayrollLocalization } from '@/data/payrollLocalization';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';

export default function TaxSlips() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateYear, setGenerateYear] = useState(currentYear - 1);

  const { taxSlips, isLoading, generateT4Slips, issueSlip, deleteSlip, stats } = useTaxSlips(selectedYear);
  const { organization } = useCurrentOrganization();

  // Determine country from organization
  const countryCode = useMemo(() => {
    if (organization?.country) {
      const upperCountry = organization.country.toUpperCase();
      if (COUNTRY_LOCALIZATIONS[upperCountry]) return upperCountry;
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    return 'CA';
  }, [organization?.country]);

  const payrollConfig = useMemo(() => getPayrollLocalization(countryCode), [countryCode]);
  const { taxSlips: slipConfig } = payrollConfig;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(payrollConfig.currencyLocale, {
      style: 'currency',
      currency: payrollConfig.currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Draft</Badge>;
      case 'issued':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Issued</Badge>;
      case 'amended':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Amended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleGenerate = async () => {
    await generateT4Slips.mutateAsync(generateYear);
    setGenerateDialogOpen(false);
    setSelectedYear(generateYear);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{slipConfig.slipName}</h1>
          <p className="text-muted-foreground">{slipConfig.description}</p>
        </div>
        <Button onClick={() => setGenerateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
          <RefreshCw className="w-4 h-4 mr-2" />
          {slipConfig.generateButtonLabel}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total {slipConfig.slipCode}s</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalSlips}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Draft</p>
              <p className="text-2xl font-bold text-foreground">{stats.draftCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Issued</p>
              <p className="text-2xl font-bold text-foreground">{stats.issuedCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Employment Income</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalIncome)}</p>
        </Card>
      </div>

      {stats.draftCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {stats.draftCount} draft {slipConfig.slipCode}(s) pending review. Issue them when ready to provide to employees.
          </AlertDescription>
        </Alert>
      )}

      {/* Year Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Tax Year:</span>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tax Slips Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Employee #</TableHead>
              <TableHead className="text-right">{slipConfig.boxLabels.income}</TableHead>
              <TableHead className="text-right">{slipConfig.boxLabels.taxDeducted}</TableHead>
              <TableHead className="text-right">{slipConfig.boxLabels.pension}</TableHead>
              <TableHead className="text-right">{slipConfig.boxLabels.socialInsurance}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : taxSlips && taxSlips.length > 0 ? (
              taxSlips.map((slip) => (
                <TableRow key={slip.id}>
                  <TableCell className="font-medium">
                    {slip.employees?.first_name} {slip.employees?.last_name}
                  </TableCell>
                  <TableCell>{slip.employees?.employee_number}</TableCell>
                  <TableCell className="text-right">{formatCurrency(slip.box_14_employment_income || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(slip.box_22_income_tax_deducted || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(slip.box_16_cpp_contributions || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(slip.box_18_ei_premiums || 0)}</TableCell>
                  <TableCell>{getStatusBadge(slip.status || 'draft')}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadT4Pdf(slip, organization?.name || 'Company')}>
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </DropdownMenuItem>
                        {slip.status === 'draft' && (
                          <DropdownMenuItem onClick={() => issueSlip.mutate(slip.id)}>
                            <Check className="w-4 h-4 mr-2" />
                            Issue to Employee
                          </DropdownMenuItem>
                        )}
                        {slip.status === 'draft' && (
                          <DropdownMenuItem 
                            onClick={() => deleteSlip.mutate(slip.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {slipConfig.emptyStateMessage.replace('{year}', selectedYear.toString())}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{slipConfig.generateButtonLabel}</DialogTitle>
            <DialogDescription>
              Generate {slipConfig.slipCode} tax documents for all employees with payroll data for the selected tax year.
              This will create draft slips that can be reviewed before issuing.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground">Tax Year</label>
            <Select value={generateYear.toString()} onValueChange={(v) => setGenerateYear(parseInt(v))}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleGenerate} 
              disabled={generateT4Slips.isPending}
              className="bg-accent hover:bg-accent/90"
            >
              {generateT4Slips.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
