import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMoneyToCents, formatBRL, centsToInput, priceMilliFrom, amountCentsFrom, parseLitersToMilli } from '../utils/money.js';
import { addDays, addMonths, clampDay, weekRange, dayOfWeek, formatDateBR, formatMonthLabel } from '../utils/dates.js';
import { earningsByDay, dailyGoalFor, goalSeries, monthGoalStats } from './goals.js';
import { periodSummary, expenseTotals } from './finance.js';
import { missingRecurringExpenses } from './recurrence.js';
import { reducer, createInitialState } from '../state/reducer.js';
import { buildBackup, parseBackup, loadAll, saveSlice } from '../storage/storage.js';
import { sanitizeState } from '../storage/schema.js';
import { fuelTotals } from './fuel.js';
import { buildDemoData } from '../utils/demo.js';
import { validateFuel, validateEarning } from '../utils/validation.js';

const nbsp = (s) => s.replace(/ /g, ' ');
let n = 0;
const dispatch = (state, type, payload) => reducer(state, { type, payload, meta: { hid: `h${n++}`, at: '2026-11-10T10:00:00Z' } });
const earning = (id, date, amountCents) => ({ id, description: 'x', amountCents, date, category: '' });

// ---------- dinheiro ----------
test('parse de dinheiro em centavos', () => {
  assert.equal(parseMoneyToCents('1.234,56'), 123456);
  assert.equal(parseMoneyToCents('R$ 70'), 7000);
  assert.equal(parseMoneyToCents('12,5'), 1250);
  assert.equal(parseMoneyToCents('0,1'), 10);
  assert.equal(parseMoneyToCents('12.5'), 1250);
  assert.equal(parseMoneyToCents('1.500'), 150000);
  assert.equal(parseMoneyToCents('10,999'), 1100);
  assert.equal(parseMoneyToCents('abc'), null);
  assert.equal(parseMoneyToCents('-5'), null);
  assert.equal(parseMoneyToCents(''), null);
  assert.equal(parseMoneyToCents('1,2,3'), null);
});

test('sem erro de ponto flutuante: 0,10 + 0,20 = 0,30', () => {
  const total = parseMoneyToCents('0,10') + parseMoneyToCents('0,20');
  assert.equal(total, 30);
  assert.equal(nbsp(formatBRL(total)), 'R$ 0,30');
});

test('formatação de moeda e campo de edição', () => {
  assert.equal(nbsp(formatBRL(123456)), 'R$ 1.234,56');
  assert.equal(nbsp(formatBRL(200000, { showCents: false })), 'R$ 2.000');
  assert.equal(centsToInput(123405), '1234,05');
  assert.equal(centsToInput(5), '0,05');
});

// ---------- datas ----------
test('datas: formatação, meses e semana', () => {
  assert.equal(formatDateBR('2026-11-05'), '05/11/2026');
  assert.equal(formatMonthLabel('2026-11'), 'Novembro de 2026');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(clampDay('2026-02', 31), '2026-02-28');
  assert.equal(clampDay('2028-02', 31), '2028-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(dayOfWeek('2026-11-09'), 1); // segunda
  assert.deepEqual(weekRange('2026-11-12'), { from: '2026-11-09', to: '2026-11-15' });
  assert.deepEqual(weekRange('2026-11-15'), { from: '2026-11-09', to: '2026-11-15' });
});

// ---------- ganhos / metas ----------
const baseCtx = (earnings, extra = {}) => ({
  byDay: earningsByDay(earnings),
  dailyGoalCents: 10000,
  workDays: [1, 2, 3, 4, 5],
  accumulateDeficit: false,
  accumulateSince: null,
  ...extra,
});

test('vários ganhos no mesmo dia são somados', () => {
  const e = [earning('1', '2026-11-09', 3000), earning('2', '2026-11-09', 4500), earning('3', '2026-11-10', 1000)];
  assert.deepEqual(earningsByDay(e), { '2026-11-09': 7500, '2026-11-10': 1000 });
});

test('meta diária: restante, percentual e excedente', () => {
  const ctx = baseCtx([earning('1', '2026-11-09', 7000)]);
  const d = dailyGoalFor('2026-11-09', ctx);
  assert.equal(d.goalCents, 10000);
  assert.equal(d.remainingCents, 3000);
  assert.equal(d.excessCents, 0);
  assert.equal(d.percent, 70);
  const over = dailyGoalFor('2026-11-09', baseCtx([earning('1', '2026-11-09', 12500)]));
  assert.equal(over.remainingCents, 0); // nunca negativo
  assert.equal(over.excessCents, 2500);
});

test('meta acumulativa: exemplo do enunciado (seg 70 → ter meta 130)', () => {
  const ctx = baseCtx([earning('1', '2026-11-09', 7000)], { accumulateDeficit: true, accumulateSince: '2026-11-09' });
  assert.equal(dailyGoalFor('2026-11-10', ctx).goalCents, 13000);
  // sem acumular, a meta de terça continua 100
  assert.equal(dailyGoalFor('2026-11-10', baseCtx([earning('1', '2026-11-09', 7000)])).goalCents, 10000);
});

test('meta acumulativa: déficit encadeia, é quitado e pula fim de semana', () => {
  const e = [earning('1', '2026-11-09', 7000), earning('2', '2026-11-10', 5000), earning('3', '2026-11-11', 20000)];
  const ctx = baseCtx(e, { accumulateDeficit: true, accumulateSince: '2026-11-09' });
  assert.equal(dailyGoalFor('2026-11-10', ctx).goalCents, 13000); // 100 + 30
  assert.equal(dailyGoalFor('2026-11-11', ctx).goalCents, 18000); // 100 + (130-50)
});

test('meta acumulativa: cálculo correto da cadeia', () => {
  // seg: meta 100, ganhou 70 → déficit 30
  // ter: meta 130, ganhou 50 → déficit 80
  // qua: meta 180, ganhou 200 → déficit 0 (sobra não vira crédito)
  // qui: meta 100
  const e = [earning('1', '2026-11-09', 7000), earning('2', '2026-11-10', 5000), earning('3', '2026-11-11', 20000)];
  const ctx = baseCtx(e, { accumulateDeficit: true, accumulateSince: '2026-11-09' });
  assert.equal(dailyGoalFor('2026-11-11', ctx).goalCents, 18000);
  assert.equal(dailyGoalFor('2026-11-12', ctx).goalCents, 10000);
});

test('meta acumulativa: sexta com déficit passa para segunda; fim de semana não tem meta', () => {
  const ctx = baseCtx([earning('1', '2026-11-13', 6000)], { accumulateDeficit: true, accumulateSince: '2026-11-13' });
  const series = goalSeries('2026-11-13', '2026-11-16', ctx);
  assert.equal(series[0].goalCents, 10000); // sex
  assert.equal(series[1].goalCents, 0); // sáb
  assert.equal(series[2].goalCents, 0); // dom
  assert.equal(series[3].goalCents, 14000); // seg: 100 + déficit de 40 da sexta
});

test('meta acumulativa só considera dias de trabalho e a data de ativação', () => {
  // ativada em 12/11 (quinta): dias anteriores não geram déficit
  const ctx = baseCtx([], { accumulateDeficit: true, accumulateSince: '2026-11-12' });
  assert.equal(dailyGoalFor('2026-11-12', ctx).goalCents, 10000);
  assert.equal(dailyGoalFor('2026-11-13', ctx).goalCents, 20000);
  // sábado: sem meta; segunda seguinte carrega sex+qui (3 dias de trabalho sem ganho)
  assert.equal(dailyGoalFor('2026-11-14', ctx).goalCents, 0);
  assert.equal(dailyGoalFor('2026-11-16', ctx).goalCents, 30000);
});

test('meta acumulativa reinicia a cada mês', () => {
  const ctx = baseCtx([], { accumulateDeficit: true, accumulateSince: '2026-10-01' });
  assert.equal(dailyGoalFor('2026-11-02', ctx).goalCents, 10000); // 02/11 é segunda; 31/10 era sábado
  assert.equal(dailyGoalFor('2026-11-03', ctx).goalCents, 20000);
});

test('meta mensal: restante, necessário por dia e projeção', () => {
  // 11/2026: 21 dias úteis. Hoje: sex 13/11 → 10 úteis transcorridos (2–6 e 9–13).
  const e = [earning('1', '2026-11-03', 90000)];
  const s = monthGoalStats({
    monthKey: '2026-11', byDay: earningsByDay(e), monthlyGoalCents: 200000,
    workDays: [1, 2, 3, 4, 5], today: '2026-11-13',
  });
  assert.equal(s.totalWorkDays, 21);
  assert.equal(s.elapsedWorkDays, 10);
  assert.equal(s.earnedCents, 90000);
  assert.equal(s.remainingCents, 110000);
  assert.equal(s.percent, 45);
  assert.equal(s.leftWorkDays, 12); // 13/11 (hoje) até 30/11
  assert.equal(s.requiredDailyCents, Math.ceil(110000 / 12));
  // projeção: 90000 + (90000/10) × 11 dias úteis futuros (16/11 a 30/11) = 189000
  assert.equal(s.projectedCents, 189000);
});

test('meta mensal: ultrapassada e mês passado', () => {
  const byDay = { '2026-10-05': 250000 };
  const s = monthGoalStats({ monthKey: '2026-10', byDay, monthlyGoalCents: 200000, workDays: [1, 2, 3, 4, 5], today: '2026-11-13' });
  assert.equal(s.remainingCents, 0);
  assert.equal(s.excessCents, 50000);
  assert.equal(s.requiredDailyCents, 0);
  assert.equal(s.projectedCents, 250000);
});

test('mudança de mês: ganho de um mês não entra no outro', () => {
  const byDay = earningsByDay([earning('1', '2026-10-31', 5000), earning('2', '2026-11-01', 7000)]);
  const oct = monthGoalStats({ monthKey: '2026-10', byDay, monthlyGoalCents: 1, workDays: [1], today: '2026-11-13' });
  const nov = monthGoalStats({ monthKey: '2026-11', byDay, monthlyGoalCents: 1, workDays: [1], today: '2026-11-13' });
  assert.equal(oct.earnedCents, 5000);
  assert.equal(nov.earnedCents, 7000);
});

// ---------- despesas / resumo ----------
const exp = (id, dueDate, amountCents, status = 'pending', extra = {}) => ({
  id, name: id, amountCents, category: 'Outros', type: 'Fixa', dueDate, status, recurrence: 'none', description: '', ...extra,
});

test('despesas pagas x pendentes; líquido e saldo de caixa', () => {
  const earnings = [earning('a', '2026-11-05', 100000)];
  const expenses = [exp('x1', '2026-11-10', 30000, 'paid'), exp('x2', '2026-11-20', 20000, 'pending'), exp('x3', '2026-12-01', 99999)];
  const t = expenseTotals(expenses, '2026-11-01', '2026-11-30');
  assert.deepEqual(t, { total: 50000, paid: 30000, pending: 20000 });
  const s = periodSummary(earnings, expenses, '2026-11-01', '2026-11-30');
  assert.equal(s.netCents, 50000); // 100000 - 50000
  assert.equal(s.cashCents, 70000); // 100000 - 30000 pagos
});

// ---------- recorrência ----------
const tpl = { id: 't1', name: 'Aluguel', amountCents: 80000, category: 'Moradia', type: 'Fixa', dayOfMonth: 31, startMonth: '2026-09', endMonth: null, description: '' };

test('recorrentes: gera cada mês uma única vez e ajusta dia 31', () => {
  const created = missingRecurringExpenses({ templates: [tpl], expenses: [], skips: [], uptoMonth: '2026-11' });
  assert.deepEqual(created.map((e) => e.dueDate), ['2026-09-30', '2026-10-31', '2026-11-30']);
  // rodar de novo com as já criadas não duplica
  assert.equal(missingRecurringExpenses({ templates: [tpl], expenses: created, skips: [], uptoMonth: '2026-11' }).length, 0);
  assert.equal(missingRecurringExpenses({ templates: [tpl], expenses: created, skips: [], uptoMonth: '2026-12' }).length, 1);
});

test('recorrentes: respeita skips e mês final', () => {
  const t = { ...tpl, endMonth: '2026-10' };
  const created = missingRecurringExpenses({ templates: [t], expenses: [], skips: ['t1:2026-09'], uptoMonth: '2026-12' });
  assert.deepEqual(created.map((e) => e.monthKey), ['2026-10']);
});

test('reducer: despesa recorrente cria modelo + meses até o atual sem duplicar', () => {
  let s = createInitialState();
  const e = exp('e1', '2026-09-05', 50000, 'pending', { recurrence: 'monthly' });
  s = dispatch(s, 'ADD_EXPENSE', { expense: e, uptoMonth: '2026-11' });
  assert.equal(s.expenses.length, 3);
  assert.equal(s.recurring.templates.length, 1);
  s = dispatch(s, 'ENSURE_RECURRING', { uptoMonth: '2026-11' });
  s = dispatch(s, 'ENSURE_RECURRING', { uptoMonth: '2026-11' });
  assert.equal(s.expenses.length, 3);
  assert.equal(new Set(s.expenses.map((x) => x.id)).size, 3);
});

test('reducer: excluir "só este mês" não recria; "este e próximos" encerra', () => {
  let s = createInitialState();
  s = dispatch(s, 'ADD_EXPENSE', { expense: exp('e1', '2026-09-05', 50000, 'pending', { recurrence: 'monthly' }), uptoMonth: '2026-11' });
  const oct = s.expenses.find((x) => x.monthKey === '2026-10');
  s = dispatch(s, 'DELETE_EXPENSE', { id: oct.id, mode: 'one' });
  s = dispatch(s, 'ENSURE_RECURRING', { uptoMonth: '2026-12' });
  assert.deepEqual(s.expenses.map((x) => x.monthKey).sort(), ['2026-09', '2026-11', '2026-12']);
  const nov = s.expenses.find((x) => x.monthKey === '2026-11');
  s = dispatch(s, 'DELETE_EXPENSE', { id: nov.id, mode: 'future' });
  s = dispatch(s, 'ENSURE_RECURRING', { uptoMonth: '2027-03' });
  assert.deepEqual(s.expenses.map((x) => x.monthKey), ['2026-09']);
});

test('reducer: editar recorrente aplicando às próximas pendentes', () => {
  let s = createInitialState();
  s = dispatch(s, 'ADD_EXPENSE', { expense: exp('e1', '2026-09-05', 50000, 'pending', { recurrence: 'monthly' }), uptoMonth: '2026-11' });
  const sep = s.expenses.find((x) => x.monthKey === '2026-09');
  s = dispatch(s, 'UPDATE_EXPENSE', { id: sep.id, changes: { amountCents: 60000 }, applyToFuture: true, uptoMonth: '2026-12' });
  const amounts = Object.fromEntries(s.expenses.map((x) => [x.monthKey, x.amountCents]));
  assert.deepEqual(amounts, { '2026-09': 60000, '2026-10': 60000, '2026-11': 60000, '2026-12': 60000 });
});

test('reducer: marcar paga e voltar a pendente', () => {
  let s = createInitialState();
  s = dispatch(s, 'ADD_EXPENSE', { expense: exp('e1', '2026-11-05', 10000), uptoMonth: '2026-11' });
  s = dispatch(s, 'SET_EXPENSE_PAID', { id: 'e1', paid: true, date: '2026-11-06' });
  assert.equal(s.expenses[0].status, 'paid');
  assert.equal(s.expenses[0].paidDate, '2026-11-06');
  s = dispatch(s, 'SET_EXPENSE_PAID', { id: 'e1', paid: false });
  assert.equal(s.expenses[0].status, 'pending');
  assert.equal('paidDate' in s.expenses[0], false);
});

// ---------- combustível ----------
test('combustível: cálculo de preço/litro e litros', () => {
  assert.equal(parseLitersToMilli('32,5'), 32500);
  assert.equal(priceMilliFrom(20000, 40000), 5000); // R$ 200 / 40 L = R$ 5,000/L
  assert.equal(amountCentsFrom(5899, 30000), 17697); // 5,899 × 30 L = R$ 176,97
});

test('combustível entra UMA vez nas despesas (sem duplicação)', () => {
  let s = createInitialState();
  const fuel = { id: 'f1', date: '2026-11-10', amountCents: 15000, litersMilli: 25000, priceMilli: 6000, note: '' };
  s = dispatch(s, 'ADD_FUEL', { fuel });
  assert.equal(s.expenses.filter((e) => e.fuelId === 'f1').length, 1);
  // editar não duplica e atualiza o valor
  s = dispatch(s, 'UPDATE_FUEL', { id: 'f1', changes: { amountCents: 16000, priceMilli: 6400 } });
  assert.equal(s.expenses.filter((e) => e.fuelId === 'f1').length, 1);
  assert.equal(s.expenses.find((e) => e.fuelId === 'f1').amountCents, 16000);
  // total de despesas do mês contém o combustível uma única vez
  assert.equal(expenseTotals(s.expenses, '2026-11-01', '2026-11-30').total, 16000);
  assert.equal(fuelTotals(s.fuel, '2026-11-01', '2026-11-30').amountCents, 16000);
  // não pode editar/excluir a despesa vinculada pelo módulo de despesas
  const before = s;
  s = dispatch(s, 'DELETE_EXPENSE', { id: 'fx_f1', mode: 'one' });
  assert.equal(s.expenses.length, before.expenses.length);
  // excluir o abastecimento remove a despesa
  s = dispatch(s, 'DELETE_FUEL', { id: 'f1' });
  assert.equal(s.expenses.length, 0);
});

test('combustível: totais por dia, semana e mês', () => {
  const fuel = [
    { id: '1', date: '2026-11-09', amountCents: 10000, litersMilli: 20000 },
    { id: '2', date: '2026-11-12', amountCents: 5000, litersMilli: 10000 },
    { id: '3', date: '2026-11-20', amountCents: 7000, litersMilli: 14000 },
  ];
  assert.equal(fuelTotals(fuel, '2026-11-12', '2026-11-12').amountCents, 5000);
  const w = weekRange('2026-11-12');
  assert.equal(fuelTotals(fuel, w.from, w.to).amountCents, 15000);
  assert.equal(fuelTotals(fuel, '2026-11-01', '2026-11-30').amountCents, 22000);
});

// ---------- demo ----------
test('dados de demonstração: carregar e remover por completo', () => {
  let s = createInitialState();
  s = dispatch(s, 'ADD_EARNING', { earning: earning('real', '2026-11-10', 5000) });
  const demo = buildDemoData('2026-11-13');
  s = dispatch(s, 'LOAD_DEMO', { demo, uptoMonth: '2026-11' });
  assert.ok(s.earnings.length > 1);
  assert.ok(s.expenses.some((e) => e.fuelId));
  const count = s.earnings.length;
  s = dispatch(s, 'LOAD_DEMO', { demo, uptoMonth: '2026-11' }); // segunda vez é ignorada
  assert.equal(s.earnings.length, count);
  s = dispatch(s, 'REMOVE_DEMO');
  assert.deepEqual(s.earnings.map((e) => e.id), ['real']);
  assert.equal(s.expenses.length, 0);
  assert.equal(s.fuel.length, 0);
  assert.equal(s.recurring.templates.length, 0);
});

// ---------- metas / configurações ----------
test('ativar acumulação registra a data; desativar limpa', () => {
  let s = createInitialState();
  s = dispatch(s, 'SET_GOALS', { changes: { accumulateDeficit: true }, today: '2026-11-13' });
  assert.equal(s.goals.accumulateSince, '2026-11-13');
  s = dispatch(s, 'SET_GOALS', { changes: { dailyGoalCents: 15000 }, today: '2026-11-14' });
  assert.equal(s.goals.accumulateSince, '2026-11-13'); // não reinicia ao editar outra coisa
  s = dispatch(s, 'SET_GOALS', { changes: { accumulateDeficit: false }, today: '2026-11-15' });
  assert.equal(s.goals.accumulateSince, null);
});

test('valores iniciais: metas e dias de trabalho', () => {
  const s = createInitialState();
  assert.equal(s.goals.dailyGoalCents, 10000);
  assert.equal(s.goals.monthlyGoalCents, 200000);
  assert.deepEqual(s.settings.workDays, [1, 2, 3, 4, 5]);
  assert.equal(s.settings.expenseCategories.length, 8);
});

// ---------- persistência e backup ----------
function fakeStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test('persistência: salvar e reabrir (simula fechar o navegador)', () => {
  const store = fakeStore();
  let s = createInitialState();
  s = dispatch(s, 'ADD_EARNING', { earning: earning('e1', '2026-11-10', 12345) });
  s = dispatch(s, 'ADD_FUEL', { fuel: { id: 'f1', date: '2026-11-10', amountCents: 9000, litersMilli: 15000, priceMilli: 6000, note: '' } });
  for (const k of ['earnings', 'expenses', 'recurring', 'fuel', 'goals', 'settings', 'history']) {
    assert.equal(saveSlice(k, s[k], store).ok, true);
  }
  const loaded = loadAll(store);
  assert.equal(loaded.issues.length, 0);
  assert.equal(loaded.state.earnings[0].amountCents, 12345);
  assert.equal(loaded.state.expenses.filter((e) => e.fuelId).length, 1);
});

test('persistência: dados corrompidos e inválidos não quebram o app', () => {
  const store = fakeStore({
    'mcf:v1:earnings': '{isso não é json',
    'mcf:v1:expenses': JSON.stringify([{ id: 'ok', name: 'Luz', amountCents: 100, dueDate: '2026-11-10' }, { id: 'ruim', name: '', amountCents: -1 }, 'lixo']),
  });
  const r = loadAll(store);
  assert.equal(r.state.earnings.length, 0);
  assert.equal(r.state.expenses.length, 1);
  assert.ok(r.issues.length >= 2);
  assert.ok(Object.keys(store.data).some((k) => k.includes('corrupt:earnings')));
});

test('persistência: armazenamento cheio devolve erro amigável', () => {
  const store = { getItem: () => null, setItem: () => { const e = new Error('q'); e.name = 'QuotaExceededError'; throw e; }, removeItem() {} };
  const r = saveSlice('earnings', [], store);
  assert.equal(r.ok, false);
  assert.match(r.error, /cheio/);
});

test('backup: exportar e importar preserva tudo; combustível sem duplicar', () => {
  let s = createInitialState();
  s = dispatch(s, 'ADD_EARNING', { earning: earning('e1', '2026-11-10', 5000) });
  s = dispatch(s, 'ADD_EXPENSE', { expense: exp('x1', '2026-10-05', 30000, 'pending', { recurrence: 'monthly' }), uptoMonth: '2026-11' });
  s = dispatch(s, 'ADD_FUEL', { fuel: { id: 'f1', date: '2026-11-10', amountCents: 9000, litersMilli: 15000, priceMilli: 6000, note: 'x' } });
  s = dispatch(s, 'SET_GOALS', { changes: { dailyGoalCents: 12000, accumulateDeficit: true }, today: '2026-11-10' });
  const text = JSON.stringify(buildBackup(s, new Date('2026-11-13T12:00:00Z')));
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.equal(r.discarded, 0);
  assert.deepEqual(r.state.earnings, s.earnings);
  assert.deepEqual(r.state.goals, s.goals);
  assert.equal(r.state.expenses.length, s.expenses.length);
  assert.equal(r.state.expenses.filter((e) => e.fuelId).length, 1);
  assert.deepEqual(r.state.recurring, s.recurring);
});

test('backup: rejeita arquivos inválidos', () => {
  assert.equal(parseBackup('não json').ok, false);
  assert.equal(parseBackup('{"app":"outro","data":{}}').ok, false);
  assert.equal(parseBackup(JSON.stringify({ app: 'meu-controle-financeiro', version: 99, data: {} })).ok, false);
  const partial = parseBackup(JSON.stringify({ app: 'meu-controle-financeiro', version: 1, data: { earnings: [{ id: 'a', amountCents: 'x', date: '2026-11-01' }] } }));
  assert.equal(partial.ok, true);
  assert.equal(partial.discarded, 1);
  assert.equal(partial.state.goals.dailyGoalCents, 10000); // defaults
});

test('sanitizeState: ids duplicados são descartados', () => {
  const { state, discarded } = sanitizeState({ earnings: [earning('a', '2026-11-01', 100), earning('a', '2026-11-02', 200)] });
  assert.equal(state.earnings.length, 1);
  assert.equal(discarded, 1);
});

// ---------- validação ----------
test('validação de formulários', () => {
  assert.equal(validateEarning({ description: '', amount: '10', date: '2026-11-10' }).ok, false);
  assert.equal(validateEarning({ description: 'x', amount: '0', date: '2026-11-10' }).ok, false);
  assert.equal(validateEarning({ description: 'x', amount: '10', date: '2026-02-31' }).ok, false);
  const ok = validateEarning({ description: ' corrida ', amount: '15,50', date: '2026-11-10', category: '' });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.amountCents, 1550);
  const f = validateFuel({ date: '2026-11-10', amount: '200', liters: '40', note: '' });
  assert.equal(f.ok, true);
  assert.equal(f.value.priceMilli, 5000);
  assert.equal(validateFuel({ date: '2026-11-10', amount: '200', liters: '', note: '' }).ok, false);
});
