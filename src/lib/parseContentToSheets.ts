/**
 * Parses AI-generated content (markdown tables, key-value pairs, lists, plain text)
 * into structured sheet data for Excel export.
 */

interface SheetData {
  name: string;
  data: (string | number)[][];
}

/**
 * Parse a formatted string to a number if possible.
 * Handles: "$1,234.56", "(1,234.56)", "1,234", "45%", plain numbers.
 */
export function parseFormattedValue(value: string): string | number {
  if (!value || value.trim() === '' || value.trim() === '-') return value;
  const str = value.trim();

  // Percentage
  if (str.endsWith('%')) {
    const num = parseFloat(str.replace(/[,%]/g, ''));
    if (!isNaN(num)) return num / 100;
  }

  const isNegativeParens = str.startsWith('(') && str.endsWith(')');
  const cleaned = str
    .replace(/[$€£¥₦₹₱฿₫₪₨]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/^\(/, '')
    .replace(/\)$/, '');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return value;
  return isNegativeParens ? -num : num;
}

/** Check if a line is a markdown table separator like |---|---| */
function isSeparatorLine(line: string): boolean {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim());
}

/** Parse a markdown table row into cells */
function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

/** Strip markdown bold/italic from text */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

/** Extract a section title from a header line */
function extractTitle(line: string): string {
  return line.replace(/^#{1,6}\s*/, '').trim();
}

/**
 * Main parser: converts AI content string into an array of named sheets.
 */
export function parseContentToSheets(content: string): SheetData[] {
  const sheets: SheetData[] = [];
  const lines = content.split('\n');

  let currentSection: { title: string; lines: string[] } = { title: 'Report', lines: [] };
  const sections: { title: string; lines: string[] }[] = [];

  // Split into sections by markdown headers or double blank lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line)) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: extractTitle(line), lines: [] };
    } else {
      currentSection.lines.push(line);
    }
  }
  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  // If no sections found, treat entire content as one section
  if (sections.length === 0) {
    sections.push({ title: 'Report', lines });
  }

  let sheetIndex = 0;
  for (const section of sections) {
    const parsed = parseSectionToData(section.lines);
    if (parsed.length === 0) continue;

    let name = section.title.substring(0, 31).replace(/[\\\/\?\*\[\]:]/g, '');
    if (!name) name = `Sheet${sheetIndex + 1}`;

    // Ensure unique names
    const existingNames = sheets.map(s => s.name);
    let uniqueName = name;
    let suffix = 2;
    while (existingNames.includes(uniqueName)) {
      uniqueName = `${name.substring(0, 28)}_${suffix++}`;
    }

    sheets.push({ name: uniqueName, data: parsed });
    sheetIndex++;
  }

  // If nothing was parsed, return a single sheet with raw text
  if (sheets.length === 0) {
    sheets.push({
      name: 'Report',
      data: [
        ['Alice Business Advisor Report'],
        ['Generated: ' + new Date().toLocaleString()],
        [''],
        ...content.split('\n').map(l => [l]),
      ],
    });
  }

  return sheets;
}

/**
 * Parse a section's lines into a 2D array, detecting tables, key-value pairs, and lists.
 */
function parseSectionToData(lines: string[]): (string | number)[][] {
  const data: (string | number)[][] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Detect markdown table: current line has | and next line is separator (or current is header)
    if (trimmed.includes('|') && !trimmed.startsWith('http')) {
      const tableRows = collectMarkdownTable(lines, i);
      if (tableRows.length > 0) {
        for (const row of tableRows) {
          data.push(row.map((cell, idx) => {
            if (idx === 0) return stripMarkdown(cell);
            const parsed = parseFormattedValue(stripMarkdown(cell));
            return parsed;
          }));
        }
        // Advance past table lines
        let advance = 0;
        while (i + advance < lines.length && lines[i + advance].trim().includes('|')) {
          advance++;
        }
        i += Math.max(advance, tableRows.length + 1); // +1 for separator
        continue;
      }
    }

    // Detect key-value pair: "**Key**: Value" or "Key: Value"
    const kvMatch = trimmed.match(/^\*{0,2}([^:*]+)\*{0,2}\s*:\s*(.+)$/);
    if (kvMatch) {
      const key = stripMarkdown(kvMatch[1]);
      const rawVal = stripMarkdown(kvMatch[2]);
      const val = parseFormattedValue(rawVal);
      data.push([key, val]);
      i++;
      continue;
    }

    // Detect bullet/numbered list
    const listMatch = trimmed.match(/^(?:[-•]\s+|\d+\.\s+)(.+)$/);
    if (listMatch) {
      const content = stripMarkdown(listMatch[1]);
      // Check if bullet contains a key-value
      const bulletKv = content.match(/^([^:]+):\s*(.+)$/);
      if (bulletKv) {
        data.push([stripMarkdown(bulletKv[1]), parseFormattedValue(stripMarkdown(bulletKv[2]))]);
      } else {
        data.push([content]);
      }
      i++;
      continue;
    }

    // Plain text line
    data.push([stripMarkdown(trimmed)]);
    i++;
  }

  return data;
}

/**
 * Collect consecutive markdown table rows starting from index i.
 * Skips separator lines. Returns parsed rows.
 */
function collectMarkdownTable(lines: string[], startIdx: number): string[][] {
  const rows: string[][] = [];
  let i = startIdx;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed.includes('|')) break;
    if (isSeparatorLine(trimmed)) {
      i++;
      continue;
    }
    rows.push(parseTableRow(trimmed));
    i++;
  }

  // Only treat as table if we have at least 2 rows (header + data)
  return rows.length >= 2 ? rows : [];
}
