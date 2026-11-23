// Datas são strings ISO "YYYY-MM-DD" (sem fuso). Meses são "YYYY-MM".
// Toda aritmética usa UTC internamente para evitar bugs de horário de verão/fuso.

const pad = (n) => String(n).padStart(2, '0');

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function toISO(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900 || y > 2200) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

export const isValidISO = (s) => parseISO(s) !== null;

export function todayISO(now = new Date()) {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const utcMs = (iso) => {
  const p = parseISO(iso);
  return Date.UTC(p.y, p.m - 1, p.d);
};

function fromUtcMs(ms) {
  const d = new Date(ms);
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export const addDays = (iso, n) => fromUtcMs(utcMs(iso) + n * 86400000);
export const dayOfWeek = (iso) => new Date(utcMs(iso)).getUTCDay(); // 0 = domingo
export const diffDays = (a, b) => Math.round((utcMs(b) - utcMs(a)) / 86400000);

export const monthKeyOf = (iso) => iso.slice(0, 7);

export function parseMonthKey(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

export const isValidMonthKey = (k) => parseMonthKey(k) !== null;

export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const monthStart = (key) => `${key}-01`;

export function monthEnd(key) {
  const { y, m } = parseMonthKey(key);
  return toISO(y, m, daysInMonth(y, m));
}

export function addMonths(key, n) {
  const { y, m } = parseMonthKey(key);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export function monthsBetween(fromKey, toKey, cap = 600) {
  const out = [];
  let k = fromKey;
  while (k <= toKey && out.length < cap) {
    out.push(k);
    k = addMonths(k, 1);
  }
  return out;
}

/** Dia do mês limitado ao último dia (31 → 28/29/30 quando preciso). */
export function clampDay(key, day) {
  const { y, m } = parseMonthKey(key);
  return toISO(y, m, Math.min(Math.max(1, day), daysInMonth(y, m)));
}

/** Semana de segunda a domingo que contém a data. */
export function weekStart(iso) {
  const offset = (dayOfWeek(iso) + 6) % 7;
  return addDays(iso, -offset);
}

export function weekRange(iso) {
  const from = weekStart(iso);
  return { from, to: addDays(from, 6) };
}

export function eachDay(from, to, cap = 4000) {
  const out = [];
  if (!isValidISO(from) || !isValidISO(to)) return out;
  let d = from;
  while (d <= to && out.length < cap) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function countWorkDays(from, to, workDays) {
  let n = 0;
  for (const d of eachDay(from, to)) if (workDays.includes(dayOfWeek(d))) n += 1;
  return n;
}

export function inRange(iso, from, to) {
  return (!from || iso >= from) && (!to || iso <= to);
}

export function formatDateBR(iso) {
  const p = parseISO(iso);
  return p ? `${pad(p.d)}/${pad(p.m)}/${p.y}` : '—';
}

export function formatShortBR(iso) {
  const p = parseISO(iso);
  return p ? `${pad(p.d)}/${pad(p.m)}` : '—';
}

export function formatMonthLabel(key) {
  const p = parseMonthKey(key);
  if (!p) return '—';
  const s = new Date(Date.UTC(p.y, p.m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatMonthShort(key) {
  const p = parseMonthKey(key);
  if (!p) return '—';
  const m = new Date(Date.UTC(p.y, p.m - 1, 1))
    .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
    .replace('.', '');
  return `${m}/${String(p.y).slice(2)}`;
}

export function formatWeekdayDate(iso) {
  return `${WEEKDAY_LONG[dayOfWeek(iso)]}, ${formatDateBR(iso)}`;
}
