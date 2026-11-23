import { EXPENSE_TYPES } from '../constants.js';
import { isValidISO } from './dates.js';
import {
  amountCentsFrom,
  parseLitersToMilli,
  parseMoneyToCents,
  parsePriceToMilli,
  priceMilliFrom,
} from './money.js';

const MAX_CENTS = 10_000_000_00; // R$ 10 milhões: evita digitação errada absurda

function checkMoney(raw, errors, key, label = 'valor') {
  const cents = parseMoneyToCents(raw);
  if (cents === null || cents <= 0) errors[key] = `Informe um ${label} maior que zero (ex.: 150,00).`;
  else if (cents > MAX_CENTS) errors[key] = `O ${label} informado é alto demais.`;
  return cents;
}

export function validateEarning(f) {
  const errors = {};
  const description = (f.description || '').trim();
  if (!description) errors.description = 'Informe uma descrição.';
  else if (description.length > 120) errors.description = 'Use no máximo 120 caracteres.';
  const amountCents = checkMoney(f.amount, errors, 'amount');
  if (!isValidISO(f.date)) errors.date = 'Informe uma data válida.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { description, amountCents, date: f.date, category: (f.category || '').trim() },
  };
}

export function validateExpense(f) {
  const errors = {};
  const name = (f.name || '').trim();
  if (!name) errors.name = 'Informe o nome da despesa.';
  else if (name.length > 80) errors.name = 'Use no máximo 80 caracteres.';
  const amountCents = checkMoney(f.amount, errors, 'amount');
  if (!(f.category || '').trim()) errors.category = 'Escolha uma categoria.';
  if (!EXPENSE_TYPES.includes(f.type)) errors.type = 'Escolha o tipo.';
  if (!isValidISO(f.dueDate)) errors.dueDate = 'Informe uma data de vencimento válida.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      amountCents,
      category: (f.category || '').trim(),
      type: f.type,
      dueDate: f.dueDate,
      status: f.status === 'paid' ? 'paid' : 'pending',
      recurrence: f.recurrence === 'monthly' ? 'monthly' : 'none',
      description: (f.description || '').trim(),
    },
  };
}

export function validateFuel(f) {
  const errors = {};
  if (!isValidISO(f.date)) errors.date = 'Informe uma data válida.';
  const amountCents = checkMoney(f.amount, errors, 'amount', 'valor pago');
  const litersMilli = parseLitersToMilli(f.liters);
  if (litersMilli === null || litersMilli <= 0) errors.liters = 'Informe os litros (ex.: 32,5).';
  else if (litersMilli > 2_000_000) errors.liters = 'Quantidade de litros alta demais.';
  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          date: f.date,
          amountCents,
          litersMilli,
          priceMilli: priceMilliFrom(amountCents, litersMilli),
          note: (f.note || '').trim(),
        }
      : null,
  };
}

export { amountCentsFrom, parsePriceToMilli };
