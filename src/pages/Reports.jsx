import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { eachDay, formatDateBR, formatShortBR, monthEnd, monthKeyOf, monthStart } from '../utils/dates.js';
import { formatLiters } from '../utils/money.js';
import { buildSeries, chooseGranularity, expensesByCategory, periodSummary } from '../logic/finance.js';
import { goalSeries } from '../logic/goals.js';
import { fuelTotals } from '../logic/fuel.js';
import { Card, EmptyState, PageHeader, StatCard } from '../components/ui.jsx';
import { PeriodFilter, presetRange } from '../components/PeriodFilter.jsx';
import { CategoryPie, COLORS, MoneyBarChart, MoneyLineChart } from '../components/charts.jsx';

const DAILY_LIMIT = 92; // gráficos diários só até ~3 meses; acima disso, agrupa

export default function Reports() {
  const { state, today, byDay, fmt } = useApp();
  const [period, setPeriod] = useState(() => ({ preset: 'month', ...presetRange('month', today) }));

  // período efetivo ("Tudo" usa o intervalo dos dados)
  const range = useMemo(() => {
    const dates = [
      ...state.earnings.map((e) => e.date),
      ...state.expenses.map((e) => e.dueDate),
      ...state.fuel.map((f) => f.date),
    ].sort();
    const fallbackFrom = dates[0] || monthStart(monthKeyOf(today));
    const fallbackTo = dates[dates.length - 1] || monthEnd(monthKeyOf(today));
    const from = period.from || fallbackFrom;
    const to = period.to || fallbackTo;
    return { from, to, invalid: from > to };
  }, [period, state, today]);

  const { from, to, invalid } = range;
  const days = invalid ? 0 : eachDay(from, to).length;

  const ctx = useMemo(
    () => ({
      byDay,
      dailyGoalCents: state.goals.dailyGoalCents,
      workDays: state.settings.workDays,
      accumulateDeficit: state.goals.accumulateDeficit,
      accumulateSince: state.goals.accumulateSince,
    }),
    [byDay, state.goals, state.settings.workDays],
  );

  const data = useMemo(() => {
    if (invalid) return null;
    const mode = chooseGranularity(from, to);
    const compare = buildSeries(from, to, state.earnings, state.expenses, mode);
    let running = 0;
    const balance = compare.map((r) => ({ label: r.label, saldo: (running += r.netCents) }));
    const goals =
      days <= DAILY_LIMIT
        ? goalSeries(from, to, ctx).map((r) => ({ label: formatShortBR(r.date), earned: r.earnedCents, goal: r.goalCents }))
        : buildSeries(from, to, state.earnings, [], 'month').map((r) => ({ label: r.label, earned: r.earningsCents, goal: state.goals.monthlyGoalCents }));
    const fuelRows = state.fuel
      .filter((f) => f.date >= from && f.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((f) => ({ label: formatShortBR(f.date), amountCents: f.amountCents }));
    return {
      mode,
      summary: periodSummary(state.earnings, state.expenses, from, to),
      daily: days <= DAILY_LIMIT ? buildSeries(from, to, state.earnings, [], 'day') : null,
      weekly: buildSeries(from, to, state.earnings, [], 'week'),
      monthly: buildSeries(from, to, state.earnings, [], 'month'),
      categories: expensesByCategory(state.expenses, from, to),
      compare,
      balance,
      goals,
      goalsMonthly: days > DAILY_LIMIT,
      fuelRows,
      fuel: fuelTotals(state.fuel, from, to),
    };
  }, [invalid, from, to, days, state, ctx]);

  const modeLabel = { day: 'por dia', week: 'por semana', month: 'por mês' };
  const noData = data && !state.earnings.length && !state.expenses.length && !state.fuel.length;

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle={invalid ? 'Período inválido' : `${formatDateBR(from)} a ${formatDateBR(to)}`}
      />
      <PeriodFilter value={period} onChange={setPeriod} today={today} />

      {invalid ? (
        <Card><EmptyState title="Período inválido" text="A data inicial precisa ser anterior ou igual à final." /></Card>
      ) : noData ? (
        <Card><EmptyState title="Sem dados para o relatório" text="Registre ganhos, despesas ou abastecimentos para ver os gráficos." /></Card>
      ) : (
        <>
          <div className="grid grid-4">
            <StatCard label="Faturamento bruto" value={fmt.money(data.summary.grossCents)} tone="green" />
            <StatCard label="Despesas do período" value={fmt.money(data.summary.expensesCents)} hint={`Pendentes: ${fmt.money(data.summary.pendingCents)}`} tone="red" />
            <StatCard label="Resultado líquido" value={fmt.money(data.summary.netCents)} tone={data.summary.netCents >= 0 ? 'green' : 'red'} />
            <StatCard label="Saldo de caixa" value={fmt.money(data.summary.cashCents)} hint="Ganhos − despesas pagas" tone={data.summary.cashCents >= 0 ? 'green' : 'red'} />
          </div>

          <div className="grid grid-2">
            <Card title="Ganhos diários">
              {data.daily ? (
                <MoneyBarChart data={data.daily} series={[{ key: 'earningsCents', name: 'Ganhos', color: COLORS.green }]} />
              ) : (
                <p className="muted">O período tem mais de {DAILY_LIMIT} dias. Veja os gráficos semanal e mensal ou escolha um período menor.</p>
              )}
            </Card>
            <Card title="Ganhos semanais (semanas iniciadas na segunda)">
              <MoneyBarChart data={data.weekly} series={[{ key: 'earningsCents', name: 'Ganhos', color: COLORS.green }]} />
            </Card>
            <Card title="Ganhos mensais">
              <MoneyBarChart data={data.monthly} series={[{ key: 'earningsCents', name: 'Ganhos', color: COLORS.green }]} />
            </Card>
            <Card title="Despesas por categoria">
              {data.categories.length ? (
                <CategoryPie data={data.categories} />
              ) : (
                <p className="muted">Nenhuma despesa com vencimento neste período.</p>
              )}
            </Card>
            <Card title={data.goalsMonthly ? 'Evolução das metas (mensal)' : 'Evolução das metas (diária)'}>
              <MoneyLineChart
                data={data.goals}
                series={[
                  { key: 'earned', name: 'Ganhos', color: COLORS.green },
                  { key: 'goal', name: data.goalsMonthly ? 'Meta mensal' : 'Meta do dia', color: COLORS.blue, dashed: true },
                ]}
              />
            </Card>
            <Card title={`Faturamento x despesas (${modeLabel[data.mode]})`}>
              <MoneyBarChart
                data={data.compare}
                series={[
                  { key: 'earningsCents', name: 'Ganhos', color: COLORS.green },
                  { key: 'expensesCents', name: 'Despesas', color: COLORS.red },
                ]}
              />
            </Card>
            <Card title="Saldo financeiro acumulado (resultado líquido)">
              <MoneyLineChart data={data.balance} series={[{ key: 'saldo', name: 'Saldo', color: COLORS.blue }]} />
            </Card>
            <Card title="Histórico de combustível">
              {data.fuelRows.length ? (
                <>
                  <MoneyBarChart data={data.fuelRows} series={[{ key: 'amountCents', name: 'Abastecimento', color: COLORS.amber }]} height={220} />
                  <p className="note">
                    Total {fmt.money(data.fuel.amountCents)} · {formatLiters(data.fuel.litersMilli)} · {data.fuel.count} abastecimento(s)
                  </p>
                </>
              ) : (
                <p className="muted">Nenhum abastecimento neste período.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
