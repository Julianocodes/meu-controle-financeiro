import { STATUS } from '../constants.js';
import {
  eachDay,
  formatMonthShort,
  formatShortBR,
  inRange,
  monthKeyOf,
  monthsBetween,
  weekStart,
} from '../utils/dates.js';

// Regras (ver README):
//  faturamento bruto = soma dos ganhos
//  despesas do período = despesas com VENCIMENTO no período (pagas + pendentes)
//  resultado líquido = faturamento bruto - despesas do período
//  saldo de caixa = faturamento bruto - despesas PAGAS do período

export function sumEarnings(earnings, from, to) {
  let total = 0;
  for (const e of earnings) if (inRange(e.date, from, to)) total += e.amountCents;
  return total;
}

export function expenseTotals(expenses, from, to) {
  let total = 0;
  let paid = 0;
  let pending = 0;
  for (const e of expenses) {
    if (!inRange(e.dueDate, from, to)) continue;
    total += e.amountCents;
    if (e.status === STATUS.PAID) paid += e.amountCents;
    else pending += e.amountCents;
  }
  return { total, paid, pending };
}

export function periodSummary(earnings, expenses, from, to) {
  const grossCents = sumEarnings(earnings, from, to);
  const ex = expenseTotals(expenses, from, to);
  return {
    grossCents,
    expensesCents: ex.total,
    paidCents: ex.paid,
    pendingCents: ex.pending,
    netCents: grossCents - ex.total,
    cashCents: grossCents - ex.paid,
  };
}

export function expensesByCategory(expenses, from, to) {
  const map = {};
  for (const e of expenses) {
    if (!inRange(e.dueDate, from, to)) continue;
    map[e.category] = (map[e.category] || 0) + e.amountCents;
  }
  return Object.entries(map)
    .map(([name, valueCents]) => ({ name, valueCents }))
    .sort((a, b) => b.valueCents - a.valueCents);
}

export function chooseGranularity(from, to) {
  const days = eachDay(from, to, 4000).length;
  if (days <= 31) return 'day';
  if (days <= 150) return 'week';
  return 'month';
}

/** Ganhos x despesas agrupados por dia, semana (segunda) ou mês. */
export function buildSeries(from, to, earnings, expenses, mode) {
  const bucket = {
    day: (iso) => iso,
    week: (iso) => weekStart(iso),
    month: (iso) => monthKeyOf(iso),
  }[mode];
  const label = {
    day: formatShortBR,
    week: formatShortBR,
    month: formatMonthShort,
  }[mode];

  let keys;
  if (mode === 'month') keys = monthsBetween(monthKeyOf(from), monthKeyOf(to));
  else keys = [...new Set(eachDay(from, to).map(bucket))];

  const rows = new Map(
    keys.map((k) => [k, { key: k, label: label(k), earningsCents: 0, expensesCents: 0 }]),
  );
  for (const e of earnings) {
    if (!inRange(e.date, from, to)) continue;
    const r = rows.get(bucket(e.date));
    if (r) r.earningsCents += e.amountCents;
  }
  for (const x of expenses) {
    if (!inRange(x.dueDate, from, to)) continue;
    const r = rows.get(bucket(x.dueDate));
    if (r) r.expensesCents += x.amountCents;
  }
  return [...rows.values()].map((r) => ({ ...r, netCents: r.earningsCents - r.expensesCents }));
}
