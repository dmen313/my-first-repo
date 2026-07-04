export function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

export function fmtPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function fmtOdds(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Math.round(Number(value));
  return n > 0 ? `+${n}` : `${n}`;
}

export function fmtSigned(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value);
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(digits)}`;
}

export function resultClass(result) {
  if (!result) return '';
  const r = String(result).toUpperCase();
  if (r === 'W') return 'wc-positive';
  if (r === 'L') return 'wc-negative';
  return '';
}
