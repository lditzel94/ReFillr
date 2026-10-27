const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 60],
  ['day', 24],
  ['week', 7],
  ['month', 4.345],
  ['year', 12],
];

/** "ahora", "hace 5 minutos", "ayer", "hace 2 semanas"… */
export function timeAgo(iso: string, now: number): string {
  let value = (new Date(iso).getTime() - now) / 1000;
  if (Math.abs(value) < 60) return 'ahora';
  value /= 60;
  for (let i = 1; i < STEPS.length; i++) {
    const [unit] = STEPS[i - 1];
    const [, size] = STEPS[i];
    if (Math.abs(Math.round(value)) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return relative.format(Math.round(value), 'year');
}

const monthName = new Intl.DateTimeFormat('es', { month: 'long' });
const monthYear = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });

export function formatMonth(iso: string): string {
  return monthName.format(new Date(iso));
}

export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(iso));
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
