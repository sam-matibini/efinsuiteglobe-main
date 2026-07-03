import { useMemo, useState } from 'react';
import { Calendar, Download, FileText, Users, DollarSign, Building2, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePayrollLocalization } from '@/hooks/usePayrollLocalization';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getCountryPayrollConfig } from '@/data/globalPayrollDefaults';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
}

interface PayrollStats {
  totalPayroll: number;
  totalCpp: number;
  totalEi: number;
  totalTax: number;
}

export default function PayrollReports() {
  const { payrollConfig, countryCode } = usePayrollLocalization();
  const { organization } = useCurrentOrganization();
  
  const countryLocalization = useMemo(() => 
    getCountryLocalization(countryCode), 
    [countryCode]
  );
  
  const payrollDefaults = useMemo(() =>
    getCountryPayrollConfig(countryCode),
    [countryCode]
  );

  // Fetch real payroll stats from database
  const { data: payrollStats, isLoading: isLoadingStats } = useQuery<PayrollStats>({
    queryKey: ['payroll-report-stats', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { totalPayroll: 0, totalCpp: 0, totalEi: 0, totalTax: 0 };
      
      const currentYear = new Date().getFullYear();
      
      // First get pay_runs for this organization
      const { data: payRunsData, error: payRunsError } = await supabase
        .from('pay_runs')
        .select('id, pay_date')
        .eq('organization_id', organization.id)
        .in('status', ['approved', 'paid']);
      
      if (payRunsError) throw payRunsError;
      if (!payRunsData || payRunsData.length === 0) {
        return { totalPayroll: 0, totalCpp: 0, totalEi: 0, totalTax: 0 };
      }
      
      // Filter pay runs by current year
      const currentYearPayRuns = payRunsData.filter(pr => 
        new Date(pr.pay_date).getFullYear() === currentYear
      );
      
      if (currentYearPayRuns.length === 0) {
        return { totalPayroll: 0, totalCpp: 0, totalEi: 0, totalTax: 0 };
      }
      
      const payRunIds = currentYearPayRuns.map(pr => pr.id);
      
      // Get pay_stubs for these pay runs
      const { data: stubData, error: stubError } = await supabase
        .from('pay_stubs')
        .select('gross_pay, cpp_contribution, ei_premium, federal_tax, provincial_tax')
        .in('pay_run_id', payRunIds);
      
      if (stubError) throw stubError;
      
      const totals = (stubData || []).reduce((acc, stub) => ({
        totalPayroll: acc.totalPayroll + (stub.gross_pay || 0),
        totalCpp: acc.totalCpp + (stub.cpp_contribution || 0),
        totalEi: acc.totalEi + (stub.ei_premium || 0),
        totalTax: acc.totalTax + ((stub.federal_tax || 0) + (stub.provincial_tax || 0)),
      }), { totalPayroll: 0, totalCpp: 0, totalEi: 0, totalTax: 0 });
      
      return totals;
    },
    enabled: !!organization?.id,
  });

  // Fetch pay runs for period dropdown
  const { data: payRunsList } = useQuery({
    queryKey: ['payroll-report-pay-runs', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('pay_runs')
        .select('id, pay_period_start, pay_period_end, pay_date, status')
        .eq('organization_id', organization.id)
        .in('status', ['approved', 'paid'])
        .order('pay_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // State for custom report
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedPayRunId, setSelectedPayRunId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'excel'>('pdf');

  // Helper to draw table in PDF
  const drawPdfTable = (
    doc: jsPDF,
    headers: string[],
    rows: (string | number)[][],
    startY: number,
    options?: { colWidths?: number[] }
  ): number => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 15;
    const rightMargin = pageWidth - 15;
    const tableWidth = rightMargin - leftMargin;
    const colCount = headers.length;
    const colWidths = options?.colWidths || headers.map(() => tableWidth / colCount);
    
    let y = startY;
    const rowHeight = 8;
    const headerHeight = 10;
    
    // Header background
    doc.setFillColor(30, 64, 175);
    doc.rect(leftMargin, y - 6, tableWidth, headerHeight, 'F');
    
    // Header text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let xPos = leftMargin + 3;
    headers.forEach((header, i) => {
      doc.text(header, xPos, y);
      xPos += colWidths[i];
    });
    
    y += headerHeight;
    
    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    rows.forEach((row, rowIndex) => {
      // Alternate row background
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(leftMargin, y - 5, tableWidth, rowHeight, 'F');
      }
      
      xPos = leftMargin + 3;
      row.forEach((cell, i) => {
        const cellText = typeof cell === 'number' ? formatCurrency(cell) : String(cell);
        doc.text(cellText.substring(0, 30), xPos, y);
        xPos += colWidths[i];
      });
      
      y += rowHeight;
      
      // Page break if needed
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    
    return y;
  };

  // Generate report PDF or Excel
  const handleGenerateReport = async (reportName: string, payRunId?: string, exportFormat: 'pdf' | 'excel' = 'pdf') => {
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }

    setIsGenerating(true);
    try {
      // Fetch pay run data
      let payRunsQuery = supabase
        .from('pay_runs')
        .select('id, pay_period_start, pay_period_end, pay_date, total_gross, total_deductions, total_net, employee_count, status')
        .eq('organization_id', organization.id)
        .in('status', ['approved', 'paid'])
        .order('pay_date', { ascending: false });
      
      // If a specific pay run is selected, filter to just that one
      if (payRunId && payRunId !== 'all') {
        payRunsQuery = payRunsQuery.eq('id', payRunId);
      }
      
      const { data: payRunsData, error: payRunsError } = await payRunsQuery;
      
      if (payRunsError) throw payRunsError;

      // Fetch pay stubs with employee info
      const payRunIds = (payRunsData || []).map(pr => pr.id);
      let stubsData: any[] = [];
      
      if (payRunIds.length > 0) {
        const { data, error } = await supabase
          .from('pay_stubs')
          .select(`
            id, gross_pay, total_deductions, net_pay, cpp_contribution, ei_premium, 
            federal_tax, provincial_tax, regular_hours, overtime_hours,
            employees!inner (first_name, last_name, department, job_title)
          `)
          .in('pay_run_id', payRunIds);
        
        if (error) throw error;
        stubsData = data || [];
      }

      // Prepare Excel data structure
      const excelData: { sheetName: string; data: any[] }[] = [];

      // Generate PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Professional header
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(reportName, pageWidth / 2, 12, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(organization.name, pageWidth / 2, 20, { align: 'center' });
      
      // Sub-header
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 15, 35);
      doc.text(`Report Period: ${payRunId === 'all' ? 'All Pay Runs' : 'Selected Period'}`, pageWidth - 15, 35, { align: 'right' });
      
      doc.setDrawColor(200, 200, 200);
      doc.line(15, 40, pageWidth - 15, 40);
      
      let y = 50;
      
      if (reportName === 'Payroll Summary') {
        // Summary stats card
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, y - 5, pageWidth - 30, 45, 3, 3, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 64, 175);
        doc.text('Year-to-Date Summary', 20, y + 2);
        
        y += 12;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const stats = [
          { label: 'Total Payroll', value: payrollStats?.totalPayroll || 0 },
          { label: statLabels.pension, value: payrollStats?.totalCpp || 0 },
          { label: statLabels.socialInsurance, value: payrollStats?.totalEi || 0 },
          { label: statLabels.tax, value: payrollStats?.totalTax || 0 },
        ];
        
        const colWidth = (pageWidth - 40) / 2;
        stats.forEach((stat, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const xPos = 20 + col * colWidth;
          const yPos = y + row * 10;
          
          doc.setTextColor(100, 100, 100);
          doc.text(stat.label + ':', xPos, yPos);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');
          doc.text(formatCurrency(stat.value), xPos + 60, yPos);
          doc.setFont('helvetica', 'normal');
        });
        
        y += 35;
        
        // Pay runs table
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Pay Runs', 15, y);
        y += 8;
        
        const payRunRows = (payRunsData || []).slice(0, 15).map(pr => [
          `${format(parseLocalDate(pr.pay_period_start), 'MMM d')} - ${format(parseLocalDate(pr.pay_period_end), 'MMM d, yyyy')}`,
          pr.employee_count || 0,
          pr.total_gross || 0,
          pr.total_deductions || 0,
          pr.total_net || 0,
        ]);
        
        y = drawPdfTable(doc, ['Period', 'Employees', 'Gross', 'Deductions', 'Net'], payRunRows, y, {
          colWidths: [60, 25, 35, 35, 35]
        });
        
        // Excel data
        excelData.push({
          sheetName: 'Summary',
          data: [
            { Metric: 'Total Payroll', Value: payrollStats?.totalPayroll || 0 },
            { Metric: statLabels.pension, Value: payrollStats?.totalCpp || 0 },
            { Metric: statLabels.socialInsurance, Value: payrollStats?.totalEi || 0 },
            { Metric: statLabels.tax, Value: payrollStats?.totalTax || 0 },
          ]
        });
        excelData.push({
          sheetName: 'Pay Runs',
          data: (payRunsData || []).map(pr => ({
            'Period Start': pr.pay_period_start,
            'Period End': pr.pay_period_end,
            'Pay Date': pr.pay_date,
            'Employees': pr.employee_count,
            'Gross Pay': pr.total_gross,
            'Deductions': pr.total_deductions,
            'Net Pay': pr.total_net,
            'Status': pr.status,
          }))
        });
        
      } else if (reportName === 'Employee Earnings') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Employee Earnings Breakdown', 15, y);
        y += 10;
        
        // Group by employee
        const employeeMap = new Map<string, { name: string; department: string; gross: number; deductions: number; net: number; hours: number }>();
        stubsData.forEach(stub => {
          const emp = stub.employees as any;
          const name = `${emp.first_name} ${emp.last_name}`;
          const existing = employeeMap.get(name) || { name, department: emp.department || 'N/A', gross: 0, deductions: 0, net: 0, hours: 0 };
          existing.gross += stub.gross_pay || 0;
          existing.deductions += stub.total_deductions || 0;
          existing.net += stub.net_pay || 0;
          existing.hours += (stub.regular_hours || 0) + (stub.overtime_hours || 0);
          employeeMap.set(name, existing);
        });
        
        const empRows = Array.from(employeeMap.values()).map(emp => [
          emp.name,
          emp.department,
          emp.hours,
          emp.gross,
          emp.deductions,
          emp.net,
        ]);
        
        y = drawPdfTable(doc, ['Employee', 'Department', 'Hours', 'Gross', 'Deductions', 'Net'], empRows, y, {
          colWidths: [45, 35, 20, 30, 30, 30]
        });
        
        // Totals row
        const totals = Array.from(employeeMap.values()).reduce((acc, emp) => ({
          hours: acc.hours + emp.hours,
          gross: acc.gross + emp.gross,
          deductions: acc.deductions + emp.deductions,
          net: acc.net + emp.net,
        }), { hours: 0, gross: 0, deductions: 0, net: 0 });
        
        y += 5;
        doc.setFillColor(30, 64, 175);
        doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTALS', 18, y + 1);
        doc.text(String(totals.hours), 100, y + 1);
        doc.text(formatCurrency(totals.gross), 120, y + 1);
        doc.text(formatCurrency(totals.deductions), 150, y + 1);
        doc.text(formatCurrency(totals.net), pageWidth - 20, y + 1, { align: 'right' });
        
        // Excel data
        excelData.push({
          sheetName: 'Earnings',
          data: Array.from(employeeMap.values()).map(emp => ({
            'Employee': emp.name,
            'Department': emp.department,
            'Total Hours': emp.hours,
            'Gross Pay': emp.gross,
            'Deductions': emp.deductions,
            'Net Pay': emp.net,
          }))
        });
        
      } else if (reportName === 'Deductions Summary') {
        const totals = stubsData.reduce((acc, stub) => ({
          cpp: acc.cpp + (stub.cpp_contribution || 0),
          ei: acc.ei + (stub.ei_premium || 0),
          fedTax: acc.fedTax + (stub.federal_tax || 0),
          provTax: acc.provTax + (stub.provincial_tax || 0),
        }), { cpp: 0, ei: 0, fedTax: 0, provTax: 0 });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Deductions Breakdown', 15, y);
        y += 10;
        
        const deductionRows = [
          [statLabels.pension, totals.cpp],
          [statLabels.socialInsurance, totals.ei],
          ['Federal/National Tax', totals.fedTax],
          ['Provincial/State Tax', totals.provTax],
        ];
        
        y = drawPdfTable(doc, ['Deduction Type', 'Amount'], deductionRows, y, {
          colWidths: [100, 80]
        });
        
        // Total
        y += 5;
        doc.setFillColor(220, 38, 38);
        doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL DEDUCTIONS', 18, y + 1);
        doc.text(formatCurrency(totals.cpp + totals.ei + totals.fedTax + totals.provTax), pageWidth - 20, y + 1, { align: 'right' });
        
        // Excel data
        excelData.push({
          sheetName: 'Deductions',
          data: [
            { 'Deduction Type': statLabels.pension, 'Amount': totals.cpp },
            { 'Deduction Type': statLabels.socialInsurance, 'Amount': totals.ei },
            { 'Deduction Type': 'Federal/National Tax', 'Amount': totals.fedTax },
            { 'Deduction Type': 'Provincial/State Tax', 'Amount': totals.provTax },
            { 'Deduction Type': 'TOTAL', 'Amount': totals.cpp + totals.ei + totals.fedTax + totals.provTax },
          ]
        });

      } else if (reportName === 'Department Summary') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Payroll Costs by Department', 15, y);
        y += 10;

        const deptMap = new Map<string, { gross: number; deductions: number; net: number; count: number }>();
        stubsData.forEach(stub => {
          const emp = stub.employees as any;
          const dept = emp?.department || 'Unassigned';
          const existing = deptMap.get(dept) || { gross: 0, deductions: 0, net: 0, count: 0 };
          existing.gross += stub.gross_pay || 0;
          existing.deductions += stub.total_deductions || 0;
          existing.net += stub.net_pay || 0;
          existing.count += 1;
          deptMap.set(dept, existing);
        });

        const deptRows = Array.from(deptMap.entries()).map(([dept, data]) => [
          dept,
          data.count,
          data.gross,
          data.deductions,
          data.net,
        ]);
        
        y = drawPdfTable(doc, ['Department', 'Employees', 'Gross Pay', 'Deductions', 'Net Pay'], deptRows, y, {
          colWidths: [50, 30, 40, 35, 35]
        });
        
        // Excel data
        excelData.push({
          sheetName: 'By Department',
          data: Array.from(deptMap.entries()).map(([dept, data]) => ({
            'Department': dept,
            'Employee Count': data.count,
            'Gross Pay': data.gross,
            'Deductions': data.deductions,
            'Net Pay': data.net,
          }))
        });

      } else if (reportName === 'Headcount Report') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Employee Headcount by Period', 15, y);
        y += 10;

        const headcountRows = (payRunsData || []).map(pr => [
          `${format(parseLocalDate(pr.pay_period_start), 'MMM d')} - ${format(parseLocalDate(pr.pay_period_end), 'MMM d, yyyy')}`,
          format(parseLocalDate(pr.pay_date), 'MMM d, yyyy'),
          pr.employee_count || 0,
          pr.status,
        ]);
        
        y = drawPdfTable(doc, ['Period', 'Pay Date', 'Headcount', 'Status'], headcountRows, y, {
          colWidths: [60, 45, 35, 40]
        });
        
        // Excel data
        excelData.push({
          sheetName: 'Headcount',
          data: (payRunsData || []).map(pr => ({
            'Period Start': pr.pay_period_start,
            'Period End': pr.pay_period_end,
            'Pay Date': pr.pay_date,
            'Employee Count': pr.employee_count,
            'Status': pr.status,
          }))
        });

      } else {
        // Generic report with professional styling
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${reportName} Details`, 15, y);
        y += 10;
        
        const currentYear = new Date().getFullYear();
        const totalIncome = stubsData.reduce((s, st) => s + (st.gross_pay || 0), 0);
        const totalCpp = stubsData.reduce((s, st) => s + (st.cpp_contribution || 0), 0);
        const totalEi = stubsData.reduce((s, st) => s + (st.ei_premium || 0), 0);
        const totalFedTax = stubsData.reduce((s, st) => s + (st.federal_tax || 0), 0);
        const totalProvTax = stubsData.reduce((s, st) => s + (st.provincial_tax || 0), 0);
        
        const genericRows = [
          ['Tax Year', currentYear],
          ['Total Employment Income', totalIncome],
          [statLabels.pension, totalCpp],
          [statLabels.socialInsurance, totalEi],
          ['Federal/National Tax', totalFedTax],
          ['Provincial/State Tax', totalProvTax],
          ['Total Employees', new Set(stubsData.map((s: any) => s.employees?.first_name + s.employees?.last_name)).size],
        ];
        
        y = drawPdfTable(doc, ['Metric', 'Value'], genericRows, y, {
          colWidths: [100, 80]
        });
        
        // Excel data
        excelData.push({
          sheetName: 'Report',
          data: [
            { Metric: 'Tax Year', Value: currentYear },
            { Metric: 'Total Employment Income', Value: totalIncome },
            { Metric: statLabels.pension, Value: totalCpp },
            { Metric: statLabels.socialInsurance, Value: totalEi },
            { Metric: 'Federal/National Tax', Value: totalFedTax },
            { Metric: 'Provincial/State Tax', Value: totalProvTax },
          ]
        });
      }
      
      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Powered by eFinsuite Globe | info@efintax.biz', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Page 1`, pageWidth - 15, footerY, { align: 'right' });
      
      // Save based on format
      const filename = `${reportName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}`;
      
      if (exportFormat === 'excel') {
        // Generate Excel
        const workbook = XLSX.utils.book_new();
        excelData.forEach(sheet => {
          const worksheet = XLSX.utils.json_to_sheet(sheet.data);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
        });
        XLSX.writeFile(workbook, `${filename}.xlsx`);
        toast.success(`${reportName} exported to Excel`);
      } else {
        doc.save(`${filename}.pdf`);
        toast.success(`${reportName} downloaded as PDF`);
      }
      
    } catch (error: any) {
      toast.error('Failed to generate report: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomReportGenerate = () => {
    if (!selectedReportType) {
      toast.error('Please select a report type');
      return;
    }
    if (!selectedPayRunId) {
      toast.error('Please select a period');
      return;
    }
    const reportNames: Record<string, string> = {
      summary: 'Payroll Summary',
      earnings: 'Employee Earnings',
      deductions: 'Deductions Summary',
    };
    handleGenerateReport(reportNames[selectedReportType] || 'Custom Report', selectedPayRunId, selectedFormat);
  };

  // Generate country-specific reports
  const reports: Report[] = useMemo(() => {
    const baseReports: Report[] = [
      { id: 'r1', name: 'Payroll Summary', description: 'Overview of payroll by period', category: 'Payroll', icon: DollarSign },
      { id: 'r2', name: 'Employee Earnings', description: 'Detailed earnings by employee', category: 'Payroll', icon: Users },
      { id: 'r3', name: 'Deductions Summary', description: 'Breakdown of all deductions', category: 'Payroll', icon: FileText },
      { id: 'r9', name: 'Department Summary', description: 'Payroll costs by department', category: 'Analysis', icon: Users },
      { id: 'r10', name: 'Headcount Report', description: 'Employee count by period', category: 'Analysis', icon: Users },
    ];

    // Add country-specific compliance reports
    const complianceReports: Report[] = [];
    
    switch (countryCode) {
      case 'CA':
        complianceReports.push(
          { id: 'r4', name: 'T4 Summary', description: 'Annual T4 slip data', category: 'Compliance', icon: Building2 },
          { id: 'r5', name: 'T4A Summary', description: 'Annual T4A slip data', category: 'Compliance', icon: Building2 },
          { id: 'r6', name: 'CPP Contributions', description: 'Canada Pension Plan report', category: 'Remittances', icon: DollarSign },
          { id: 'r7', name: 'EI Premiums', description: 'Employment Insurance report', category: 'Remittances', icon: DollarSign },
          { id: 'r8', name: 'Tax Remittance', description: 'Income tax withheld report', category: 'Remittances', icon: Building2 },
        );
        break;
      case 'US':
        complianceReports.push(
          { id: 'r4', name: 'W-2 Summary', description: 'Annual W-2 form data', category: 'Compliance', icon: Building2 },
          { id: 'r5', name: '1099 Summary', description: 'Contractor payment data', category: 'Compliance', icon: Building2 },
          { id: 'r6', name: 'Social Security Report', description: 'FICA-SS contributions report', category: 'Remittances', icon: DollarSign },
          { id: 'r7', name: 'Medicare Report', description: 'FICA-Medicare contributions', category: 'Remittances', icon: DollarSign },
          { id: 'r8', name: 'Federal Tax Deposit', description: 'Form 941 deposit summary', category: 'Remittances', icon: Building2 },
        );
        break;
      case 'ZM':
        complianceReports.push(
          { id: 'r4', name: 'ITF 18 Summary', description: 'Annual PAYE certificates', category: 'Compliance', icon: Building2 },
          { id: 'r6', name: 'NAPSA Contributions', description: 'Pension contributions report', category: 'Remittances', icon: DollarSign },
          { id: 'r7', name: 'NHIMA Contributions', description: 'Health insurance report', category: 'Remittances', icon: DollarSign },
          { id: 'r8', name: 'PAYE Remittance', description: 'ITF 16 summary', category: 'Remittances', icon: Building2 },
        );
        break;
      case 'KE':
        complianceReports.push(
          { id: 'r4', name: 'P9 Summary', description: 'Annual P9 tax deduction cards', category: 'Compliance', icon: Building2 },
          { id: 'r6', name: 'NSSF Contributions', description: 'Pension contributions report', category: 'Remittances', icon: DollarSign },
          { id: 'r7', name: 'SHIF Contributions', description: 'Health insurance report', category: 'Remittances', icon: DollarSign },
          { id: 'r8', name: 'PAYE Remittance', description: 'P10 monthly return', category: 'Remittances', icon: Building2 },
        );
        break;
      case 'BI':
        complianceReports.push(
          { id: 'r4', name: 'Déclaration IPR', description: 'Certificats annuels IPR', category: 'Conformité', icon: Building2 },
          { id: 'r6', name: 'Cotisations INSS', description: 'Rapport pension', category: 'Versements', icon: DollarSign },
          { id: 'r7', name: 'Cotisations MFP', description: 'Rapport assurance maladie', category: 'Versements', icon: DollarSign },
          { id: 'r8', name: 'Déclaration OBR', description: 'Versements mensuels', category: 'Versements', icon: Building2 },
        );
        break;
    }

    return [...baseReports, ...complianceReports];
  }, [countryCode]);

  // Get country-specific stat labels
  const statLabels = useMemo(() => {
    switch (countryCode) {
      case 'CA':
        return { pension: 'Total CPP Contributions', socialInsurance: 'Total EI Premiums', tax: 'Tax Withheld' };
      case 'US':
        return { pension: 'Social Security', socialInsurance: 'Medicare', tax: 'Federal Tax Withheld' };
      case 'ZM':
        return { pension: 'Total NAPSA', socialInsurance: 'Total NHIMA', tax: 'PAYE Withheld' };
      case 'KE':
        return { pension: 'Total NSSF', socialInsurance: 'Total SHIF', tax: 'PAYE Withheld' };
      case 'BI':
        return { pension: 'Cotisations INSS', socialInsurance: 'Cotisations MFP', tax: 'IPR Retenu' };
      default:
        return { pension: 'Pension Contributions', socialInsurance: 'Social Insurance', tax: 'Tax Withheld' };
    }
  }, [countryCode]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(payrollConfig.currencyLocale, {
      style: 'currency',
      currency: payrollConfig.currencyCode,
      minimumFractionDigits: 0,
    }).format(value);
  };

  const categories = [...new Set(reports.map(r => r.category))];

  const recentReports = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const slipCode = payrollConfig.taxSlips.slipCode;
    
    return [
      { name: `Payroll Summary - Dec ${currentYear}`, date: `Dec 31, ${currentYear}`, type: 'Payroll Summary' },
      { name: `${slipCode} Summary - ${currentYear}`, date: `Dec 28, ${currentYear}`, type: `${slipCode} Summary` },
      { name: `${statLabels.pension} - Q4 ${currentYear}`, date: `Dec 20, ${currentYear}`, type: statLabels.pension },
    ];
  }, [payrollConfig, statLabels]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll Reports</h1>
          <p className="text-muted-foreground">
            Generate payroll and compliance reports for {countryLocalization.name}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">{new Date().getFullYear()} Total Payroll</p>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{formatCurrency(payrollStats?.totalPayroll || 0)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">{statLabels.pension}</p>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{formatCurrency(payrollStats?.totalCpp || 0)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">{statLabels.socialInsurance}</p>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{formatCurrency(payrollStats?.totalEi || 0)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">{statLabels.tax}</p>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{formatCurrency(payrollStats?.totalTax || 0)}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Reports */}
        <div className="lg:col-span-2 space-y-6">
          {categories.map(category => (
            <Card key={category} className="overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-foreground">{category} Reports</h3>
              </div>
              <div className="divide-y divide-border">
                {reports.filter(r => r.category === category).map(report => (
                  <div key={report.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <report.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{report.name}</p>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={isGenerating}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {isGenerating ? 'Generating...' : 'Export'}
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleGenerateReport(report.name, undefined, 'pdf')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGenerateReport(report.name, undefined, 'excel')}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Export as Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Reports */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground">Recent Reports</h3>
            </div>
            <div className="divide-y divide-border">
              {recentReports.map((report, i) => (
                <div key={i} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground text-sm">{report.name}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleGenerateReport(report.type, undefined, 'pdf')}>
                          <FileText className="w-4 h-4 mr-2" />
                          PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGenerateReport(report.type, undefined, 'excel')}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{report.type}</Badge>
                    <span className="text-xs text-muted-foreground">{report.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Custom Report</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Report Type</label>
                <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Payroll Summary</SelectItem>
                    <SelectItem value="earnings">Employee Earnings</SelectItem>
                    <SelectItem value="deductions">Deductions Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Period</label>
                <Select value={selectedPayRunId} onValueChange={setSelectedPayRunId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pay Runs</SelectItem>
                    {(payRunsList || []).map(pr => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {format(parseLocalDate(pr.pay_period_start), 'MMM d')} - {format(parseLocalDate(pr.pay_period_end), 'MMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Format</label>
                <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as 'pdf' | 'excel')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        PDF Document
                      </div>
                    </SelectItem>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel Spreadsheet
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full bg-accent hover:bg-accent/90"
                onClick={handleCustomReportGenerate}
                disabled={isGenerating}
              >
                {selectedFormat === 'excel' ? <FileSpreadsheet className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                {isGenerating ? 'Generating...' : `Generate ${selectedFormat.toUpperCase()}`}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
