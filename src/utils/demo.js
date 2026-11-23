import { addDays, clampDay, monthKeyOf, addMonths } from './dates.js';
import { priceMilliFrom } from './money.js';

// Dados DEMONSTRATIVOS (opcionais). Todos levam `demo: true` e podem ser removidos de uma vez.
// Valores determinísticos (sem Math.random) para o resultado ser previsível.

const PATTERN = [8500, 12000, 6000, 15500, 10000, 4000, 13500, 9000, 11000, 7500];

export function buildDemoData(today) {
  const earnings = [];
  for (let i = 0; i < 20; i += 1) {
    const date = addDays(today, -i);
    const base = PATTERN[i % PATTERN.length];
    earnings.push({ id: `demo_e_${i}_a`, description: 'Serviço do dia', amountCents: base, date, category: 'Serviços', demo: true });
    if (i % 3 === 0) {
      earnings.push({ id: `demo_e_${i}_b`, description: 'Extra', amountCents: 2500, date, category: 'Outros', demo: true });
    }
  }

  const mk = monthKeyOf(today);
  const prev = addMonths(mk, -1);
  const expenses = [
    { id: 'demo_x_1', name: 'Mercado', amountCents: 38000, category: 'Alimentação', type: 'Variável', dueDate: clampDay(mk, 8), status: 'paid', paidDate: clampDay(mk, 8), recurrence: 'none', description: '', demo: true },
    { id: 'demo_x_2', name: 'Farmácia', amountCents: 7200, category: 'Saúde', type: 'Variável', dueDate: clampDay(mk, 20), status: 'pending', recurrence: 'none', description: '', demo: true },
    { id: 'demo_x_3', name: 'Mercado (mês passado)', amountCents: 41000, category: 'Alimentação', type: 'Variável', dueDate: clampDay(prev, 10), status: 'paid', paidDate: clampDay(prev, 10), recurrence: 'none', description: '', demo: true },
  ];
  const templates = [
    { id: 'demo_tpl_aluguel', name: 'Aluguel', amountCents: 80000, category: 'Moradia', type: 'Fixa', dayOfMonth: 5, startMonth: prev, endMonth: null, description: '', demo: true },
    { id: 'demo_tpl_internet', name: 'Internet', amountCents: 9990, category: 'Contas domésticas', type: 'Fixa', dayOfMonth: 15, startMonth: prev, endMonth: null, description: '', demo: true },
  ];

  const fuel = [3, 10, 17].map((back, i) => {
    const amountCents = [15000, 14000, 16500][i];
    const litersMilli = [26000, 24000, 28500][i];
    return {
      id: `demo_f_${i}`,
      date: addDays(today, -back),
      amountCents,
      litersMilli,
      priceMilli: priceMilliFrom(amountCents, litersMilli),
      note: i === 0 ? 'Posto da avenida' : '',
      demo: true,
    };
  });

  return { earnings, expenses, templates, fuel };
}
