const MONEY_COL =
  /revenue|ciro|price|fiyat|amount|tutar|harcama|spending|total|toplam|sales|satis|balance|bakiye/i;
const NON_MONEY_NUMERIC_COL =
  /count|adet|quantity|qty|units sold|total units sold|unit sold|unit count|order count|total orders|total order|orders|siparis|sipari|id|no\b|number/i;
const RATING_COL = /rating|puan|score|sentiment/i;
const DATE_COL = /date|tarih|time|created|updated|day|gun|month|ay/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

const numFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const fixed2Fmt = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatTableCell(
  column: string,
  value: unknown,
  row?: unknown[],
  columns?: string[]
): string {
  const isPlainNumericColumn = isNonMoneyNumericColumn(column);
  const isMoneyColumn = isCurrencyFormattedColumn(column);

  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'number') {
    if (isPlainNumericColumn) {
      return Number.isInteger(value) ? intFmt.format(value) : numFmt.format(value);
    }
    const currency = resolveRowCurrency(column, row, columns);
    if (isMoneyColumn && currency) {
      return formatCurrency(value, currency);
    }
    if (isRatingColumn(column)) {
      return fixed2Fmt.format(value);
    }
    return numFmt.format(value);
  }
  if (typeof value === 'string') {
    if (isPlainNumericColumn) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && value.trim() !== '') {
        return Number.isInteger(parsed) ? intFmt.format(parsed) : numFmt.format(parsed);
      }
    }
    if (isMoneyColumn) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && value.trim() !== '') {
        const currency = resolveRowCurrency(column, row, columns);
        return currency ? formatCurrency(parsed, currency) : numFmt.format(parsed);
      }
    }
    if (isRatingColumn(column)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && value.trim() !== '') {
        return fixed2Fmt.format(parsed);
      }
    }
    if (DATE_COL.test(column) && ISO_DATE.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return dateFmt.format(d);
      }
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'Evet' : 'Hayir';
  }
  return String(value);
}

function isCurrencyFormattedColumn(column: string): boolean {
  return MONEY_COL.test(column) && !NON_MONEY_NUMERIC_COL.test(column);
}

function isNonMoneyNumericColumn(column: string): boolean {
  return NON_MONEY_NUMERIC_COL.test(column);
}

function isRatingColumn(column: string): boolean {
  return RATING_COL.test(column);
}

function resolveRowCurrency(column: string, row?: unknown[], columns?: string[]): string | null {
  if (!row || !columns?.length) {
    return null;
  }

  const explicitTargetCurrency = extractExplicitTargetCurrency(column);
  if (explicitTargetCurrency) {
    return explicitTargetCurrency;
  }

  const normalizedColumns = columns.map((value) => value.toLowerCase());
  const candidates: string[] = [];
  const prefix = normalizeCurrencyPrefix(column.toLowerCase());

  const preferredKeys = prefix
    ? [`${prefix} currency`, `${prefix} currency code`, `${prefix}_currency`, `${prefix}_currency_code`]
    : [];
  preferredKeys.push('currency', 'currency code', 'currency_code');

  for (const key of preferredKeys) {
    const index = normalizedColumns.indexOf(key);
    if (index >= 0) {
      const code = normalizeCurrencyCode(row[index]);
      if (code) {
        return code;
      }
    }
  }

  normalizedColumns.forEach((col, index) => {
    if (col.includes('currency')) {
      const code = normalizeCurrencyCode(row[index]);
      if (code) {
        candidates.push(code);
      }
    }
  });

  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function normalizeCurrencyPrefix(column: string): string {
  const explicitTargetCurrency = extractExplicitTargetCurrency(column);
  if (explicitTargetCurrency) {
    return column
      .toLowerCase()
      .replace(new RegExp(`([ _-])${explicitTargetCurrency.toLowerCase()}$`), '')
      .trim();
  }
  const suffixes = [' revenue', ' price', ' amount', ' total', ' fee', ' cost', ' sales'];
  for (const suffix of suffixes) {
    if (column.endsWith(suffix)) {
      return column.slice(0, -suffix.length).trim();
    }
  }
  return '';
}

function extractExplicitTargetCurrency(column: string): string | null {
  const match = column.trim().match(/(?:^|[_\s-])(usd|eur|try|gbp|pkr|inr)$/i);
  return match ? match[1].toUpperCase() : null;
}

function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${numFmt.format(value)} ${currency}`;
  }
}
