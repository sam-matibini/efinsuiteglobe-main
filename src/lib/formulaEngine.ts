/**
 * Formula Engine for Alice AI Sheets
 * Evaluates Excel-style expressions: =SUM(Amount), =Price*Quantity, =IF(Amount>0,"In","Out")
 *
 * SECURITY: All evaluation is done via the expr-eval library (safe AST-based parser).
 * new Function() / eval() are strictly forbidden in this file.
 */

import { Parser } from 'expr-eval';

export interface FormulaContext {
  row: Record<string, unknown>;
  allRows: Record<string, unknown>[];
  columns: string[];
}

// ---------------------------------------------------------------------------
// Blocklist guard — rejects formulas containing dangerous JS constructs
// ---------------------------------------------------------------------------
const DANGEROUS_PATTERNS = [
  /\bfunction\b/i,
  /\beval\b/i,
  /\bnew\b/i,
  /\bimport\b/i,
  /\brequire\b/i,
  /\bfetch\b/i,
  /\bXMLHttpRequest\b/i,
  /\bdocument\b/i,
  /\bwindow\b/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\bIndexedDB\b/i,
  /\bnavigator\b/i,
  /\bglobalThis\b/i,
  /\bprocess\b/i,
  /\bDeno\b/i,
  /=>/, // arrow functions
  /\basync\b/i,
  /\bawait\b/i,
  /\[\s*['"`]/, // bracket notation for property access
];

function isSafeFormula(expr: string): boolean {
  return !DANGEROUS_PATTERNS.some(p => p.test(expr));
}

// ---------------------------------------------------------------------------
// Safe numeric evaluator — supports only +, -, *, /, **, (, ) and numbers
// ---------------------------------------------------------------------------
const mathParser = new Parser({
  operators: {
    add: true,
    concatenate: false,
    conditional: false,
    divide: true,
    factorial: false,
    multiply: true,
    power: true,
    remainder: true,
    subtract: true,
    logical: false,
    comparison: false,
    assignment: false,
    'in': false,
  },
});

const conditionParser = new Parser({
  operators: {
    add: true,
    concatenate: false,
    conditional: true,
    divide: true,
    factorial: false,
    multiply: true,
    power: true,
    remainder: true,
    subtract: true,
    logical: true,
    comparison: true,
    assignment: false,
    'in': false,
  },
});

function safeEvalArithmetic(expr: string): number {
  // Only allow digits, whitespace, basic operators, parentheses, and dot
  if (!/^[\d\s+\-*/.()^%,eE]+$/.test(expr)) {
    throw new Error("Unsafe arithmetic expression");
  }
  try {
    return mathParser.evaluate(expr);
  } catch {
    throw new Error("Invalid arithmetic expression");
  }
}

// Same but for boolean conditions after resolving column refs
function safeEvalCondition(expr: string): boolean {
  // Allow digits, strings in quotes, comparison operators, logical operators, whitespace, parens
  if (!/^[\d\s+\-*/.()'"a-zA-Z_$<>=!&|,%?:]+$/.test(expr)) {
    throw new Error("Unsafe condition expression");
  }
  // Double-check no dangerous patterns remain
  if (!isSafeFormula(expr)) {
    throw new Error("Dangerous pattern in condition");
  }
  try {
    return !!conditionParser.evaluate(expr);
  } catch {
    throw new Error("Invalid condition expression");
  }
}

// ---------------------------------------------------------------------------
// Aggregate functions: SUM(Col), AVG(Col), MIN(Col), MAX(Col), COUNT(Col)
// ---------------------------------------------------------------------------
function resolveAggregates(expr: string, ctx: FormulaContext): string {
  return expr.replace(
    /\b(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\s*\(\s*([^)]+)\s*\)/gi,
    (_, fn: string, colRaw: string) => {
      const colName = colRaw.trim();
      const matchedCol = ctx.columns.find(c => c.toLowerCase() === colName.toLowerCase());
      if (!matchedCol) return '0';
      const nums = ctx.allRows.map(r => Number(r[matchedCol]) || 0);
      const upper = fn.toUpperCase();
      switch (upper) {
        case 'SUM': return String(nums.reduce((a, b) => a + b, 0));
        case 'AVG':
        case 'AVERAGE': return String(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
        case 'MIN': return String(nums.length ? Math.min(...nums) : 0);
        case 'MAX': return String(nums.length ? Math.max(...nums) : 0);
        case 'COUNT': return String(ctx.allRows.filter(r => r[matchedCol] !== '' && r[matchedCol] !== null && r[matchedCol] !== undefined).length);
        default: return '0';
      }
    }
  );
}

// ---------------------------------------------------------------------------
// ROUND(expr, decimals) — safe via safeEvalArithmetic
// ---------------------------------------------------------------------------
function resolveRound(expr: string): string {
  return expr.replace(
    /\bROUND\s*\(\s*([^,)]+)\s*,\s*(\d+)\s*\)/gi,
    (_, inner: string, decimals: string) => {
      try {
        const val = safeEvalArithmetic(inner.trim());
        const factor = Math.pow(10, Number(decimals));
        return String(Math.round(val * factor) / factor);
      } catch {
        return '0';
      }
    }
  );
}

// ---------------------------------------------------------------------------
// ABS(expr) — safe via safeEvalArithmetic
// ---------------------------------------------------------------------------
function resolveAbs(expr: string): string {
  return expr.replace(
    /\bABS\s*\(\s*([^)]+)\s*\)/gi,
    (_, inner: string) => {
      try {
        const val = safeEvalArithmetic(inner.trim());
        return String(Math.abs(val));
      } catch {
        return '0';
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Text functions: UPPER, LOWER, CONCAT
// ---------------------------------------------------------------------------
function resolveTextFunctions(expr: string, ctx: FormulaContext): string {
  expr = expr.replace(/\bUPPER\s*\(\s*([^)]+)\s*\)/gi, (_, colRaw: string) => {
    const colName = colRaw.trim();
    const matchedCol = ctx.columns.find(c => c.toLowerCase() === colName.toLowerCase());
    if (!matchedCol) return `""`;
    return JSON.stringify(String(ctx.row[matchedCol] ?? '').toUpperCase());
  });
  expr = expr.replace(/\bLOWER\s*\(\s*([^)]+)\s*\)/gi, (_, colRaw: string) => {
    const colName = colRaw.trim();
    const matchedCol = ctx.columns.find(c => c.toLowerCase() === colName.toLowerCase());
    if (!matchedCol) return `""`;
    return JSON.stringify(String(ctx.row[matchedCol] ?? '').toLowerCase());
  });
  expr = expr.replace(/\bCONCAT\s*\(([^)]+)\)/gi, (_, argsRaw: string) => {
    const args = argsRaw.split(',').map(a => {
      const trimmed = a.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      const matchedCol = ctx.columns.find(c => c.toLowerCase() === trimmed.toLowerCase());
      return matchedCol ? String(ctx.row[matchedCol] ?? '') : trimmed;
    });
    return JSON.stringify(args.join(''));
  });
  return expr;
}

// ---------------------------------------------------------------------------
// IF(condition, then, else) — condition evaluated via safeEvalCondition
// ---------------------------------------------------------------------------
function resolveIF(expr: string, ctx: FormulaContext): string {
  return expr.replace(
    /\bIF\s*\(\s*([^,]+?)\s*,\s*((?:"[^"]*"|'[^']*'|[^,])+?)\s*,\s*((?:"[^"]*"|'[^']*'|[^)]+))\s*\)/gi,
    (_, condition: string, thenVal: string, elseVal: string) => {
      const jsCondition = condition
        .replace(/([^<>!])=([^=])/g, '$1===$2')
        .replace(/(<|>|===|!==|<=|>=)/g, '$1');

      const resolvedCondition = resolveColumnRefs(jsCondition, ctx, true);
      try {
        const result = safeEvalCondition(resolvedCondition);
        return result ? thenVal.trim() : elseVal.trim();
      } catch {
        return elseVal.trim();
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Column reference resolution
// ---------------------------------------------------------------------------
function resolveColumnRefs(expr: string, ctx: FormulaContext, numericOnly = false): string {
  const sortedCols = [...ctx.columns].sort((a, b) => b.length - a.length);
  let result = expr;
  for (const col of sortedCols) {
    const regex = new RegExp(`\\b${escapeRegex(col)}\\b`, 'gi');
    if (regex.test(result)) {
      const rawVal = ctx.row[col];
      let replacement: string;
      if (numericOnly) {
        replacement = String(Number(rawVal) || 0);
      } else {
        const num = Number(rawVal);
        replacement = Number.isFinite(num) && rawVal !== '' && rawVal !== null && rawVal !== undefined
          ? String(num)
          : JSON.stringify(String(rawVal ?? ''));
      }
      result = result.replace(new RegExp(`\\b${escapeRegex(col)}\\b`, 'gi'), replacement);
    }
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a formula expression against a row context.
 * @param expr  - Formula string, with or without leading '='
 * @param ctx   - FormulaContext with current row, all rows, and column names
 * @returns     - Computed value or '#ERR' on failure
 */
export function evaluateFormula(expr: string, ctx: FormulaContext): string | number {
  try {
    // 1. Strip leading =
    let raw = expr.startsWith('=') ? expr.slice(1) : expr;

    // 2. Security guard — reject anything containing dangerous JS patterns
    if (!isSafeFormula(raw)) {
      return '#ERR';
    }

    // 3. Resolve text functions (UPPER, LOWER, CONCAT)
    raw = resolveTextFunctions(raw, ctx);

    // 4. Resolve IF
    raw = resolveIF(raw, ctx);

    // 5. Resolve aggregates (SUM, AVG, etc.)
    raw = resolveAggregates(raw, ctx);

    // 6. Resolve ABS
    raw = resolveAbs(raw);

    // 7. Resolve ROUND
    raw = resolveRound(raw);

    // 8. Resolve per-row column name references
    raw = resolveColumnRefs(raw, ctx);

    // 9. Final security guard on resolved expression
    if (!isSafeFormula(raw)) {
      return '#ERR';
    }

    // 10. Safe arithmetic evaluation — only numbers and basic operators allowed
    const result = safeEvalArithmetic(raw);

    if (typeof result === 'number') {
      if (!Number.isFinite(result)) return '#ERR';
      return Math.round(result * 1e10) / 1e10;
    }
    return result === undefined || result === null ? '' : String(result);
  } catch {
    return '#ERR';
  }
}

/**
 * Format a computed formula value for display in the grid.
 */
export function formatFormulaValue(val: string | number): string {
  if (val === '#ERR') return '#ERR';
  if (typeof val === 'number') {
    return val % 1 === 0 ? String(val) : val.toFixed(4).replace(/\.?0+$/, '');
  }
  return String(val);
}
