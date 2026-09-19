import * as XLSX from 'xlsx';

export interface ExcelExportData {
  title: string;
  subtitle?: string;
  organizationName?: string;
  dateRange?: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: { label: string; value: string | number }[];
}

/**
 * Parse a formatted currency string back to a number
 * Handles formats like "$1,234.56", "(1,234.56)", "-$1,234.56", "1,234.56"
 */
const parseFormattedNumber = (value: string | number): number | string => {
  if (typeof value === 'number') return value;
  if (value === '' || value === '-' || value === null || value === undefined) return '';
  
  const str = String(value).trim();
  
  // Check if it's a dash (blank)
  if (str === '-') return '';
  
  // Check for accounting negative format with parentheses: (1,234.56)
  const isNegativeParens = str.startsWith('(') && str.endsWith(')');
  
  // Remove currency symbols, commas, parentheses, spaces
  let cleaned = str
    .replace(/[$€£¥₦₹₱฿₫₪₨]/g, '') // Remove currency symbols
    .replace(/,/g, '')              // Remove commas
    .replace(/\s/g, '')             // Remove spaces
    .replace(/^\(/, '')             // Remove opening paren
    .replace(/\)$/, '');            // Remove closing paren
  
  // Parse the number
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return value; // Return original if not parseable
  
  // Apply negative sign for parentheses format
  return isNegativeParens ? -num : num;
};

/**
 * Check if a row is a total row based on its label
 */
const isTotalRow = (row: (string | number)[]): boolean => {
  const firstCell = String(row[0] || '').toLowerCase().trim();
  return (
    firstCell.startsWith('total') ||
    firstCell.includes('total ') ||
    firstCell === 'net profit/loss' ||
    firstCell === 'net income' ||
    firstCell === 'net change in cash' ||
    firstCell === 'ending cash balance' ||
    firstCell === 'gross profit' ||
    firstCell === 'operating profit' ||
    firstCell === 'operating income' ||
    firstCell === 'net tax' ||
    firstCell.includes('net tax') ||
    firstCell.includes('liabilities and equity')
  );
};

/**
 * Check if a row is a section header
 */
const isSectionHeader = (row: (string | number)[]): boolean => {
  const firstCell = String(row[0] || '').toLowerCase().trim();
  // Section headers typically have empty amount columns
  const hasEmptyAmounts = row.slice(1).every(cell => 
    cell === '' || cell === null || cell === undefined
  );
  
  return hasEmptyAmounts && firstCell !== '' && !firstCell.startsWith(' ');
};

/**
 * Export financial report data to Excel with proper formatting:
 * - Numeric columns with comma formatting
 * - Right-aligned numbers
 * - Total rows with border lines above and below
 * - All amounts read from database (passed as data)
 */
export function exportToFormattedExcel(data: ExcelExportData): void {
  const workbook = XLSX.utils.book_new();
  
  // Build worksheet data
  const wsData: (string | number)[][] = [];
  
  // Title and metadata rows
  wsData.push([data.title]);
  if (data.subtitle) wsData.push([data.subtitle]);
  if (data.organizationName) wsData.push([`Organization: ${data.organizationName}`]);
  if (data.dateRange) wsData.push([`Period: ${data.dateRange}`]);
  wsData.push([]); // Empty row before headers
  
  const headerRowIndex = wsData.length; // 0-indexed row where headers will be
  
  // Headers
  wsData.push(data.headers);
  
  // Track which rows are totals for styling
  const totalRowIndices: number[] = [];
  const sectionHeaderIndices: number[] = [];
  
  // Data rows - parse formatted strings back to numbers
  data.rows.forEach((row) => {
    const rowIndex = wsData.length;
    
    // Check if this is a total or section row
    if (isTotalRow(row)) {
      totalRowIndices.push(rowIndex);
    } else if (isSectionHeader(row)) {
      sectionHeaderIndices.push(rowIndex);
    }
    
    // Process each cell - convert formatted currency back to numbers
    const processedRow = row.map((cell, colIndex) => {
      // First column (account name) stays as string
      if (colIndex === 0) return cell;
      
      // Convert formatted numbers back to actual numbers
      return parseFormattedNumber(cell);
    });
    
    wsData.push(processedRow);
  });
  
  // Totals section
  if (data.totals && data.totals.length > 0) {
    wsData.push([]); // Empty row
    data.totals.forEach(total => {
      const rowIndex = wsData.length;
      totalRowIndices.push(rowIndex);
      wsData.push([total.label, parseFormattedNumber(total.value)]);
    });
  }
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  const colWidths = data.headers.map((h, i) => {
    let maxLen = h.length;
    data.rows.forEach(r => {
      const cellLen = String(r[i] || '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    return { wch: Math.min(maxLen + 4, 40) }; // Add padding, max 40
  });
  worksheet['!cols'] = colWidths;
  
  // Apply number formatting and styling
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      
      if (!cell) continue;
      
      // Initialize style object
      if (!cell.s) cell.s = {};
      
      // Apply number format and right alignment to numeric columns (not first column)
      if (C > 0 && typeof cell.v === 'number') {
        // Comma format with 2 decimals, accounting negative with parentheses
        cell.z = '#,##0.00;(#,##0.00)';
        cell.s = {
          ...cell.s,
          alignment: { horizontal: 'right' },
          numFmt: '#,##0.00;(#,##0.00)',
        };
      }
      
      // Header row styling
      if (R === headerRowIndex) {
        cell.s = {
          ...cell.s,
          font: { bold: true },
          fill: { fgColor: { rgb: 'F0F0F0' } },
          alignment: C === 0 ? { horizontal: 'left' } : { horizontal: 'right' },
          border: {
            bottom: { style: 'medium', color: { rgb: '000000' } },
          },
        };
      }
      
      // Total row styling - bold with borders above and below
      if (totalRowIndices.includes(R)) {
        cell.s = {
          ...cell.s,
          font: { bold: true },
          alignment: C === 0 ? { horizontal: 'left' } : { horizontal: 'right' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
          },
        };
      }
      
      // Section header styling
      if (sectionHeaderIndices.includes(R)) {
        cell.s = {
          ...cell.s,
          font: { bold: true },
        };
      }
    }
  }
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  
  // Generate filename
  const filename = `${data.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Write with cell styles enabled
  XLSX.writeFile(workbook, filename, { 
    bookSST: false,
    cellStyles: true,
  });
}

/**
 * Get column letter from index (0 = A, 1 = B, etc.)
 */
export function getColumnLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}
