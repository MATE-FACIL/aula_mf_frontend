// Formateo de fechas y tiempos. Los Intl.DateTimeFormat se crean una vez y se reutilizan
// (crearlos en cada render es costoso en CPU).

const LOCALE = 'es-PE';
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
    formatters.set(key, f);
  }
  return f;
}

export const formatTime = (iso: string | Date, timeZone: string) =>
  formatter(timeZone, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

export const formatWeekdayDay = (iso: string | Date, timeZone: string) =>
  capitalize(formatter(timeZone, { weekday: 'long', day: 'numeric' }).format(new Date(iso)));

export const formatLongDate = (iso: string | Date, timeZone: string) =>
  capitalize(formatter(timeZone, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)));

export const formatShortWeekday = (iso: string | Date, timeZone: string) =>
  capitalize(formatter(timeZone, { weekday: 'short' }).format(new Date(iso)).replace('.', ''));

/** «2 nov. 2026»: fechas de registro en tablas. */
export const formatShortDate = (iso: string | Date, timeZone: string) =>
  formatter(timeZone, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export const formatDayNumber = (iso: string | Date, timeZone: string) =>
  formatter(timeZone, { day: 'numeric' }).format(new Date(iso));

/** Fecha local (AAAA-MM-DD) en la zona indicada; sirve para comparar «mismo día». */
export function localDateKey(iso: string | Date, timeZone: string): string {
  const parts = formatter(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = formatter(timeZone, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Fecha local (AAAA-MM-DD) + hora local en `timeZone` → instante UTC. */
export function zonedDateTime(dateKey: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  return new Date(guess - timeZoneOffsetMs(new Date(guess), timeZone));
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function localHour(date: Date, timeZone: string): number {
  return Number(formatter(timeZone, { hour: 'numeric', hourCycle: 'h23' }).format(date));
}

export function greeting(date: Date, timeZone: string): string {
  const h = localHour(date, timeZone);
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** 754 → «12:34». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

export function relativeFromNow(iso: string, now: number): string {
  const diffMin = Math.round((new Date(iso).getTime() - now) / 60_000);
  const abs = Math.abs(diffMin);
  const unit = abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} d`;
  return diffMin >= 0 ? `en ${unit}` : `hace ${unit}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
