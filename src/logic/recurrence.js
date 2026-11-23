import { addMonths, clampDay, monthsBetween } from '../utils/dates.js';

/**
 * Despesas recorrentes mensais.
 *
 * Existe um "modelo" (template) por recorrência e uma despesa real (instância) por mês.
 * A instância tem id determinístico `rec_<templateId>_<YYYY-MM>`, então gerar duas vezes
 * o mesmo mês é impossível (sem duplicação). Meses removidos pelo usuário ficam em `skips`
 * ("<templateId>:<YYYY-MM>") para não serem recriados.
 */
export const instanceId = (templateId, monthKey) => `rec_${templateId}_${monthKey}`;
export const skipKey = (templateId, monthKey) => `${templateId}:${monthKey}`;

export function instanceFromTemplate(t, monthKey) {
  return {
    id: instanceId(t.id, monthKey),
    name: t.name,
    amountCents: t.amountCents,
    category: t.category,
    type: t.type,
    dueDate: clampDay(monthKey, t.dayOfMonth),
    status: 'pending',
    recurrence: 'monthly',
    recurringId: t.id,
    monthKey,
    description: t.description || '',
    ...(t.demo ? { demo: true } : {}),
  };
}

/** Retorna APENAS as despesas que ainda faltam criar até `uptoMonth` (inclusive). */
export function missingRecurringExpenses({ templates, expenses, skips, uptoMonth }) {
  // existe se o id bate OU se já há despesa daquele modelo naquele mês
  const existing = new Set(expenses.map((e) => e.id));
  const slots = new Set(expenses.filter((e) => e.recurringId).map((e) => skipKey(e.recurringId, e.monthKey)));
  const skipped = new Set(skips);
  const created = [];
  for (const t of templates) {
    const last = t.endMonth && t.endMonth < uptoMonth ? t.endMonth : uptoMonth;
    if (last < t.startMonth) continue;
    for (const mk of monthsBetween(t.startMonth, last, 240)) {
      const id = instanceId(t.id, mk);
      const slot = skipKey(t.id, mk);
      if (existing.has(id) || slots.has(slot) || skipped.has(slot)) continue;
      existing.add(id);
      slots.add(slot);
      created.push(instanceFromTemplate(t, mk));
    }
  }
  return created;
}

export const previousMonth = (key) => addMonths(key, -1);
