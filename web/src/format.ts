export const rupees = (n?: number) =>
  n == null ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

export const humanize = (code: string) =>
  (code.charAt(0) + code.slice(1).toLowerCase().replaceAll('_', ' ')).replace(/^Ac /, 'AC ');

/** ['GENERAL_SERVICE', 'BRAKE_SERVICE'] -> "General service + Brake service" */
export const humanizeList = (codes: string[]) => codes.map(humanize).join(' + ');

/** 150 -> "2 h 30 min", 60 -> "1 h", 30 -> "30 min" */
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 min';
}

/** "09:00:00" -> "9:00 AM" */
export function time12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "2026-09-27T09:00:00" -> "9:00 AM" */
export const timeOf = (localDateTime: string) => time12(localDateTime.split('T')[1]);

export const isoDate = (d: Date) => d.toLocaleDateString('en-CA');

export function nextDays(count: number): Date[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
}

export function dayLabel(d: Date) {
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 86400000));
  const iso = isoDate(d);
  return {
    top: iso === today ? 'Today' : iso === tomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
    bottom: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

export function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
