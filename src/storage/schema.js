import {
  DEFAULT_GOALS,
  DEFAULT_SETTINGS,
  EXPENSE_TYPES,
  HISTORY_LIMIT,
  STATUS,
} from '../constants.js';
import { isValidISO, isValidMonthKey } from '../utils/dates.js';
import { priceMilliFrom } from '../utils/money.js';
import { syncFuelExpenses } from '../logic/fuel.js';

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => (isStr(v) ? v.trim().slice(0, max) : '');
const posInt = (v) => Number.isSafeInteger(v) && v > 0;
const demoFlag = (x) => (x.demo ? { demo: true } : {});

export function sanitizeEarning(x) {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  if (!posInt(x.amountCents) || !isValidISO(x.date)) return null;
  return {
    id: x.id,
    description: text(x.description, 120),
    amountCents: x.amountCents,
    date: x.date,
    category: text(x.category, 40),
    ...demoFlag(x),
  };
}

export function sanitizeExpense(x) {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  if (!text(x.name, 80) || !posInt(x.amountCents) || !isValidISO(x.dueDate)) return null;
  const status = x.status === STATUS.PAID ? STATUS.PAID : STATUS.PENDING;
  const out = {
    id: x.id,
    name: text(x.name, 80),
    amountCents: x.amountCents,
    category: text(x.category, 40) || 'Outros',
    type: EXPENSE_TYPES.includes(x.type) ? x.type : 'Variável',
    dueDate: x.dueDate,
    status,
    paidDate: status === STATUS.PAID && isValidISO(x.paidDate) ? x.paidDate : undefined,
    recurrence: x.recurrence === 'monthly' ? 'monthly' : 'none',
    description: text(x.description, 200),
    ...demoFlag(x),
  };
  if (!out.paidDate) delete out.paidDate;
  if (isStr(x.recurringId) && isValidMonthKey(x.monthKey)) {
    out.recurringId = x.recurringId;
    out.monthKey = x.monthKey;
    out.recurrence = 'monthly';
  } else if (out.recurrence === 'monthly') {
    out.recurrence = 'none'; // recorrente sem modelo/mês: trata como avulsa
  }
  if (isStr(x.fuelId)) out.fuelId = x.fuelId;
  return out;
}

export function sanitizeFuel(x) {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  if (!posInt(x.amountCents) || !posInt(x.litersMilli) || !isValidISO(x.date)) return null;
  return {
    id: x.id,
    date: x.date,
    amountCents: x.amountCents,
    litersMilli: x.litersMilli,
    priceMilli: priceMilliFrom(x.amountCents, x.litersMilli), // sempre recalculado
    note: text(x.note, 200),
    ...demoFlag(x),
  };
}

export function sanitizeTemplate(x) {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  if (!text(x.name, 80) || !posInt(x.amountCents) || !isValidMonthKey(x.startMonth)) return null;
  const day = Number(x.dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return {
    id: x.id,
    name: text(x.name, 80),
    amountCents: x.amountCents,
    category: text(x.category, 40) || 'Outros',
    type: EXPENSE_TYPES.includes(x.type) ? x.type : 'Variável',
    dayOfMonth: day,
    startMonth: x.startMonth,
    endMonth: isValidMonthKey(x.endMonth) ? x.endMonth : null,
    description: text(x.description, 200),
    ...demoFlag(x),
  };
}

export function sanitizeGoals(x) {
  const g = isObj(x) ? x : {};
  return {
    dailyGoalCents: Number.isSafeInteger(g.dailyGoalCents) && g.dailyGoalCents >= 0 ? g.dailyGoalCents : DEFAULT_GOALS.dailyGoalCents,
    monthlyGoalCents: Number.isSafeInteger(g.monthlyGoalCents) && g.monthlyGoalCents >= 0 ? g.monthlyGoalCents : DEFAULT_GOALS.monthlyGoalCents,
    accumulateDeficit: g.accumulateDeficit === true,
    accumulateSince: g.accumulateDeficit === true && isValidISO(g.accumulateSince) ? g.accumulateSince : null,
  };
}

function sanitizeCategories(list, fallback) {
  if (!Array.isArray(list)) return [...fallback];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const t = text(c, 40);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.length ? out : [...fallback];
}

export function sanitizeSettings(x) {
  const s = isObj(x) ? x : {};
  const workDays = Array.isArray(s.workDays)
    ? [...new Set(s.workDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [...DEFAULT_SETTINGS.workDays];
  const d = isObj(s.display) ? s.display : {};
  return {
    workDays,
    earningCategories: sanitizeCategories(s.earningCategories, DEFAULT_SETTINGS.earningCategories),
    expenseCategories: sanitizeCategories(s.expenseCategories, DEFAULT_SETTINGS.expenseCategories),
    display: {
      hideValues: d.hideValues === true,
      showCents: d.showCents !== false,
    },
  };
}

export function sanitizeHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((h) => isObj(h) && isStr(h.id) && isStr(h.at) && isStr(h.text))
    .map((h) => ({ id: h.id, at: h.at, type: text(h.type, 40), text: text(h.text, 200) }))
    .slice(0, HISTORY_LIMIT);
}

function cleanList(list, sanitizer) {
  const input = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];
  let discarded = 0;
  for (const raw of input) {
    const item = sanitizer(raw);
    if (!item || seen.has(item.id)) {
      discarded += 1;
      continue;
    }
    seen.add(item.id);
    out.push(item);
  }
  return { out, discarded };
}

/**
 * Valida e normaliza qualquer objeto no formato do estado do app.
 * Itens inválidos são descartados (e contados); defaults preenchem o que faltar.
 * Despesas de combustível são sempre reconstruídas a partir dos abastecimentos.
 */
export function sanitizeState(raw) {
  const r = isObj(raw) ? raw : {};
  const rec = isObj(r.recurring) ? r.recurring : {};
  const earnings = cleanList(r.earnings, sanitizeEarning);
  const fuel = cleanList(r.fuel, sanitizeFuel);
  const templates = cleanList(rec.templates, sanitizeTemplate);
  const expenses = cleanList(r.expenses, sanitizeExpense);
  const skips = Array.isArray(rec.skips) ? [...new Set(rec.skips.filter(isStr))] : [];
  const state = {
    earnings: earnings.out,
    expenses: syncFuelExpenses(expenses.out, fuel.out),
    recurring: { templates: templates.out, skips },
    fuel: fuel.out,
    goals: sanitizeGoals(r.goals),
    settings: sanitizeSettings(r.settings),
    history: sanitizeHistory(r.history),
  };
  const discarded =
    earnings.discarded + fuel.discarded + templates.discarded + expenses.discarded;
  return { state, discarded };
}
