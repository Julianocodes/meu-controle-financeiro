import { FUEL_CATEGORY, STATUS } from '../constants.js';
import { priceMilliFrom } from '../utils/money.js';
import { inRange } from '../utils/dates.js';

/**
 * Cada abastecimento gera UMA despesa vinculada (id determinístico `fx_<id>`).
 * A lista de abastecimentos é a fonte da verdade: a cada mudança as despesas
 * vinculadas são reconstruídas, então nunca há duplicação.
 */
export function fuelToExpense(f) {
  return {
    id: `fx_${f.id}`,
    fuelId: f.id,
    name: 'Combustível',
    amountCents: f.amountCents,
    category: FUEL_CATEGORY,
    type: 'Variável',
    dueDate: f.date,
    status: STATUS.PAID, // "valor pago": já saiu do bolso
    paidDate: f.date,
    recurrence: 'none',
    description: f.note || '',
    ...(f.demo ? { demo: true } : {}),
  };
}

export function syncFuelExpenses(expenses, fuel) {
  return [...expenses.filter((e) => !e.fuelId), ...fuel.map(fuelToExpense)];
}

export function fuelTotals(fuel, from, to) {
  let amountCents = 0;
  let litersMilli = 0;
  let count = 0;
  for (const f of fuel) {
    if (!inRange(f.date, from, to)) continue;
    amountCents += f.amountCents;
    litersMilli += f.litersMilli;
    count += 1;
  }
  return {
    amountCents,
    litersMilli,
    count,
    avgPriceMilli: priceMilliFrom(amountCents, litersMilli),
  };
}
