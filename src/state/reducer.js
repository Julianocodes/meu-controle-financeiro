import { HISTORY_LIMIT, STATUS } from '../constants.js';
import { sanitizeState } from '../storage/schema.js';
import { syncFuelExpenses } from '../logic/fuel.js';
import {
  instanceFromTemplate,
  missingRecurringExpenses,
  previousMonth,
  skipKey,
} from '../logic/recurrence.js';
import { clampDay, formatDateBR, monthKeyOf, parseISO } from '../utils/dates.js';
import { formatBRL } from '../utils/money.js';

export function createInitialState() {
  return sanitizeState({}).state;
}

function log(state, action, text) {
  const meta = action.meta || { hid: `h_${Date.now()}`, at: new Date().toISOString() };
  return {
    ...state,
    history: [{ id: meta.hid, at: meta.at, type: action.type, text }, ...state.history].slice(0, HISTORY_LIMIT),
  };
}

const money = (c) => formatBRL(c);

function templateFromExpense(e, tplId) {
  return {
    id: tplId,
    name: e.name,
    amountCents: e.amountCents,
    category: e.category,
    type: e.type,
    dayOfMonth: parseISO(e.dueDate).d,
    startMonth: monthKeyOf(e.dueDate),
    endMonth: null,
    description: e.description || '',
  };
}

/** Acrescenta ao estado as instâncias recorrentes que faltam até `uptoMonth`. */
function withRecurring(state, uptoMonth) {
  if (!uptoMonth) return state;
  const created = missingRecurringExpenses({
    templates: state.recurring.templates,
    expenses: state.expenses,
    skips: state.recurring.skips,
    uptoMonth,
  });
  return created.length ? { ...state, expenses: [...state.expenses, ...created] } : state;
}

function addExpense(state, action) {
  const { expense, uptoMonth } = action.payload;
  let next = state;
  let e = { ...expense };
  if (e.status === STATUS.PAID && !e.paidDate) e.paidDate = e.dueDate;
  if (e.status !== STATUS.PAID) delete e.paidDate;
  if (e.recurrence === 'monthly') {
    const tpl = templateFromExpense(e, `tpl_${e.id}`);
    e = { ...e, recurringId: tpl.id, monthKey: tpl.startMonth };
    next = { ...next, recurring: { ...next.recurring, templates: [...next.recurring.templates, tpl] } };
  }
  next = { ...next, expenses: [...next.expenses, e] };
  next = withRecurring(next, uptoMonth);
  return log(next, action, `Despesa adicionada: ${e.name} (${money(e.amountCents)})${e.recurrence === 'monthly' ? ' · recorrente' : ''}`);
}

function updateExpense(state, action) {
  const { id, changes, applyToFuture, uptoMonth } = action.payload;
  const current = state.expenses.find((e) => e.id === id);
  if (!current || current.fuelId) return state; // despesas de combustível são geridas no módulo Combustível
  let updated = { ...current, ...changes };
  if (updated.status === STATUS.PAID && !updated.paidDate) updated.paidDate = updated.dueDate;
  if (updated.status !== STATUS.PAID) delete updated.paidDate;

  let next = state;
  let templates = state.recurring.templates;

  if (current.recurringId) {
    updated.recurrence = 'monthly';
    if (applyToFuture) {
      const dayOfMonth = parseISO(updated.dueDate).d;
      templates = templates.map((t) =>
        t.id === current.recurringId
          ? { ...t, name: updated.name, amountCents: updated.amountCents, category: updated.category, type: updated.type, description: updated.description || '', dayOfMonth }
          : t,
      );
      const tpl = templates.find((t) => t.id === current.recurringId);
      next = {
        ...next,
        expenses: next.expenses.map((e) =>
          e.recurringId === current.recurringId && e.monthKey > current.monthKey && e.status !== STATUS.PAID
            ? { ...instanceFromTemplate(tpl, e.monthKey), id: e.id }
            : e,
        ),
      };
    }
  } else if (changes.recurrence === 'monthly') {
    const tpl = templateFromExpense(updated, `tpl_${updated.id}`);
    updated = { ...updated, recurringId: tpl.id, monthKey: tpl.startMonth, recurrence: 'monthly' };
    templates = [...templates, tpl];
  } else {
    updated.recurrence = 'none';
  }

  next = {
    ...next,
    recurring: { ...next.recurring, templates },
    expenses: next.expenses.map((e) => (e.id === id ? updated : e)),
  };
  next = withRecurring(next, uptoMonth);
  return log(next, action, `Despesa editada: ${updated.name} (${money(updated.amountCents)})`);
}

function deleteExpense(state, action) {
  const { id, mode } = action.payload; // mode: 'one' | 'future'
  const target = state.expenses.find((e) => e.id === id);
  if (!target || target.fuelId) return state;
  let next = state;

  if (target.recurringId && mode === 'future') {
    const rid = target.recurringId;
    const lastKeep = previousMonth(target.monthKey);
    let templates = next.recurring.templates.map((t) => (t.id === rid ? { ...t, endMonth: lastKeep } : t));
    templates = templates.filter((t) => t.id !== rid || t.endMonth >= t.startMonth);
    next = {
      ...next,
      recurring: { ...next.recurring, templates },
      expenses: next.expenses.filter((e) => !(e.recurringId === rid && e.monthKey >= target.monthKey)),
    };
  } else {
    next = { ...next, expenses: next.expenses.filter((e) => e.id !== id) };
    if (target.recurringId) {
      next = {
        ...next,
        recurring: {
          ...next.recurring,
          skips: [...new Set([...next.recurring.skips, skipKey(target.recurringId, target.monthKey)])],
        },
      };
    }
  }
  return log(next, action, `Despesa excluída: ${target.name} (${money(target.amountCents)})`);
}

function setPaid(state, action) {
  const { id, paid, date } = action.payload;
  const target = state.expenses.find((e) => e.id === id);
  if (!target || target.fuelId) return state;
  const next = {
    ...state,
    expenses: state.expenses.map((e) => {
      if (e.id !== id) return e;
      const copy = { ...e, status: paid ? STATUS.PAID : STATUS.PENDING };
      if (paid) copy.paidDate = date || e.dueDate;
      else delete copy.paidDate;
      return copy;
    }),
  };
  return log(next, action, `${paid ? 'Marcada como paga' : 'Marcada como pendente'}: ${target.name}`);
}

function withFuel(state, fuel) {
  return { ...state, fuel, expenses: syncFuelExpenses(state.expenses, fuel) };
}

function removeDemo(state) {
  const fuel = state.fuel.filter((f) => !f.demo);
  const templates = state.recurring.templates.filter((t) => !t.demo);
  const keep = new Set(templates.map((t) => t.id));
  return {
    ...state,
    earnings: state.earnings.filter((e) => !e.demo),
    fuel,
    expenses: syncFuelExpenses(state.expenses.filter((e) => !e.demo), fuel),
    recurring: {
      templates,
      skips: state.recurring.skips.filter((k) => keep.has(k.split(':')[0])),
    },
  };
}

export function reducer(state, action) {
  const p = action.payload;
  switch (action.type) {
    case 'ADD_EARNING':
      return log(
        { ...state, earnings: [...state.earnings, p.earning] },
        action,
        `Ganho adicionado: ${p.earning.description} (${money(p.earning.amountCents)}) em ${formatDateBR(p.earning.date)}`,
      );
    case 'UPDATE_EARNING': {
      const exists = state.earnings.some((e) => e.id === p.id);
      if (!exists) return state;
      return log(
        { ...state, earnings: state.earnings.map((e) => (e.id === p.id ? { ...e, ...p.changes } : e)) },
        action,
        `Ganho editado: ${p.changes.description ?? ''} (${money(p.changes.amountCents ?? 0)})`,
      );
    }
    case 'DELETE_EARNING': {
      const t = state.earnings.find((e) => e.id === p.id);
      if (!t) return state;
      return log(
        { ...state, earnings: state.earnings.filter((e) => e.id !== p.id) },
        action,
        `Ganho excluído: ${t.description} (${money(t.amountCents)})`,
      );
    }
    case 'ADD_EXPENSE':
      return addExpense(state, action);
    case 'UPDATE_EXPENSE':
      return updateExpense(state, action);
    case 'DELETE_EXPENSE':
      return deleteExpense(state, action);
    case 'SET_EXPENSE_PAID':
      return setPaid(state, action);
    case 'ENSURE_RECURRING':
      return withRecurring(state, p.uptoMonth);
    case 'ADD_FUEL':
      return log(
        withFuel(state, [...state.fuel, p.fuel]),
        action,
        `Abastecimento adicionado: ${money(p.fuel.amountCents)} em ${formatDateBR(p.fuel.date)}`,
      );
    case 'UPDATE_FUEL': {
      if (!state.fuel.some((f) => f.id === p.id)) return state;
      return log(
        withFuel(state, state.fuel.map((f) => (f.id === p.id ? { ...f, ...p.changes } : f))),
        action,
        `Abastecimento editado: ${money(p.changes.amountCents ?? 0)}`,
      );
    }
    case 'DELETE_FUEL': {
      const t = state.fuel.find((f) => f.id === p.id);
      if (!t) return state;
      return log(
        withFuel(state, state.fuel.filter((f) => f.id !== p.id)),
        action,
        `Abastecimento excluído: ${money(t.amountCents)} em ${formatDateBR(t.date)}`,
      );
    }
    case 'SET_GOALS': {
      const prev = state.goals;
      const goals = { ...prev, ...p.changes };
      if (goals.accumulateDeficit && !prev.accumulateDeficit) goals.accumulateSince = p.today;
      if (!goals.accumulateDeficit) goals.accumulateSince = null;
      return log({ ...state, goals }, action, 'Metas atualizadas');
    }
    case 'SET_SETTINGS': {
      const settings = {
        ...state.settings,
        ...p.changes,
        display: { ...state.settings.display, ...(p.changes.display || {}) },
      };
      return log({ ...state, settings }, action, 'Configurações atualizadas');
    }
    case 'LOAD_DEMO': {
      if (state.earnings.some((e) => e.demo) || state.fuel.some((f) => f.demo)) return state;
      const d = p.demo;
      const next = withFuel(
        {
          ...state,
          earnings: [...state.earnings, ...d.earnings],
          expenses: [...state.expenses, ...d.expenses],
          recurring: { ...state.recurring, templates: [...state.recurring.templates, ...d.templates] },
        },
        [...state.fuel, ...d.fuel],
      );
      return log(withRecurring(next, p.uptoMonth), action, 'Dados de demonstração carregados');
    }
    case 'REMOVE_DEMO':
      return log(removeDemo(state), action, 'Dados de demonstração removidos');
    case 'REPLACE_ALL':
      return log(p.state, action, 'Backup importado');
    case 'RESET_ALL':
      return log(createInitialState(), action, 'Todos os dados foram apagados');
    case 'CLEAR_HISTORY':
      return { ...state, history: [] };
    default:
      return state;
  }
}

export { clampDay };
