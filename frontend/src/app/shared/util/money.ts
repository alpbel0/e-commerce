export function formatMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return String(value);
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function effectiveUnitPrice(unit: string, discountPct: string | null | undefined): number {
  const u = parseFloat(unit);
  const d = parseFloat(discountPct ?? '0');
  if (Number.isNaN(u)) return 0;
  return u * (1 - Math.min(Math.max(Number.isNaN(d) ? 0 : d, 0), 100) / 100);
}

export function starsFromRating(avg: string | null | undefined, max = 5): number {
  const n = parseFloat(avg ?? '0');
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n)));
}
