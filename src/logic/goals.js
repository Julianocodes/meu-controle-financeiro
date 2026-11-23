import {
  addDays,
  countWorkDays,
  dayOfWeek,
  eachDay,
  monthEnd,
  monthKeyOf,
  monthStart,
} from '../utils/dates.js';
import { percentOf } from '../utils/money.js';

/** { 'YYYY-MM-DD': centavos } — vários ganhos no mesmo dia são somados. */
export function earningsByDay(earnings) {
  const map = {};
  for (const e of earnings) map[e.date] = (map[e.date] || 0) + e.amountCents;
  return map;
}

export const isWorkDay = (iso, workDays) => workDays.includes(dayOfWeek(iso));

/**
 * Série diária de metas de `from` a `to`.
 *
 * Meta acumulativa: o déficit de um dia de trabalho (meta do dia - ganho) é somado à
 * meta do próximo dia de trabalho. Regras:
 *  - só dias de trabalho geram e recebem déficit;
 *  - o acúmulo reinicia a cada mês;
 *  - só conta a partir de `accumulateSince` (data em que a opção foi ativada);
 *  - sobra de um dia NÃO vira crédito: apenas zera o déficit.
 */
export function goalSeries(from, to, ctx) {
  const { byDay, dailyGoalCents, workDays, accumulateDeficit, accumulateSince } = ctx;
  const out = [];
  let carry = 0;
  let curMonth = '';
  // começa no 1º dia do mês de `from` para que o déficit anterior seja considerado
  for (const d of eachDay(monthStart(monthKeyOf(from)), to)) {
    const mk = monthKeyOf(d);
    if (mk !== curMonth) {
      curMonth = mk;
      carry = 0;
    }
    const work = isWorkDay(d, workDays);
    const accActive = accumulateDeficit && (!accumulateSince || d >= accumulateSince);
    const carryIn = work && accActive ? carry : 0;
    const baseCents = work ? dailyGoalCents : 0;
    const goalCents = baseCents + carryIn;
    const earnedCents = byDay[d] || 0;
    if (work && accActive) carry = Math.max(0, goalCents - earnedCents);
    if (d >= from) {
      out.push({
        date: d,
        isWorkDay: work,
        baseCents,
        carryCents: carryIn,
        goalCents,
        earnedCents,
        remainingCents: Math.max(0, goalCents - earnedCents),
        excessCents: Math.max(0, earnedCents - goalCents),
      });
    }
  }
  return out;
}

export function dailyGoalFor(iso, ctx) {
  const row = goalSeries(iso, iso, ctx)[0];
  return { ...row, percent: row.goalCents > 0 ? percentOf(row.earnedCents, row.goalCents) : null };
}

/**
 * Indicadores da meta mensal.
 * `today` define o que é passado/presente/futuro (mês corrente, mês passado ou futuro).
 */
export function monthGoalStats({ monthKey, byDay, monthlyGoalCents, workDays, today }) {
  const start = monthStart(monthKey);
  const end = monthEnd(monthKey);
  let earnedCents = 0;
  for (const d of eachDay(start, end)) earnedCents += byDay[d] || 0;

  const todayKey = monthKeyOf(today);
  const isCurrent = monthKey === todayKey;
  const isPast = monthKey < todayKey;

  const remainingCents = Math.max(0, monthlyGoalCents - earnedCents);
  const excessCents = Math.max(0, earnedCents - monthlyGoalCents);
  const totalWorkDays = countWorkDays(start, end, workDays);

  let elapsedWorkDays; // dias de trabalho já transcorridos (inclui hoje)
  let futureWorkDays; // dias de trabalho depois de hoje
  let leftWorkDays; // dias de trabalho que ainda podem render (inclui hoje)
  if (isPast) {
    elapsedWorkDays = totalWorkDays;
    futureWorkDays = 0;
    leftWorkDays = 0;
  } else if (isCurrent) {
    elapsedWorkDays = countWorkDays(start, today, workDays);
    futureWorkDays = today < end ? countWorkDays(addDays(today, 1), end, workDays) : 0;
    leftWorkDays = countWorkDays(today, end, workDays);
  } else {
    elapsedWorkDays = 0;
    futureWorkDays = totalWorkDays;
    leftWorkDays = totalWorkDays;
  }

  // média diária necessária (arredondada para cima, para realmente alcançar a meta)
  let requiredDailyCents = 0;
  if (remainingCents > 0) {
    requiredDailyCents = leftWorkDays > 0 ? Math.ceil(remainingCents / leftWorkDays) : null;
  }

  // projeção: ganho atual + média por dia de trabalho × dias de trabalho que faltam
  let projectedCents;
  if (isPast) projectedCents = earnedCents;
  else if (!isCurrent) projectedCents = 0;
  else if (elapsedWorkDays === 0) projectedCents = earnedCents;
  else projectedCents = earnedCents + Math.round((earnedCents / elapsedWorkDays) * futureWorkDays);

  return {
    goalCents: monthlyGoalCents,
    earnedCents,
    remainingCents,
    excessCents,
    percent: percentOf(earnedCents, monthlyGoalCents),
    totalWorkDays,
    elapsedWorkDays,
    leftWorkDays,
    requiredDailyCents,
    projectedCents,
    isCurrent,
    isPast,
  };
}
