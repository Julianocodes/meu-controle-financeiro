import { useEffect, useMemo, useState } from 'react';
import { Fuel, PiggyBank, Plus, Receipt, Scale, Target, TrendingUp, Wallet } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { buildDemoData } from '../utils/demo.js';
import { addMonths, formatShortBR, formatMonthLabel, monthEnd, monthStart, weekRange, formatDateBR } from '../utils/dates.js';
import { dailyGoalFor, goalSeries, isWorkDay, monthGoalStats } from '../logic/goals.js';
import { buildSeries, periodSummary, sumEarnings } from '../logic/finance.js';
import { fuelTotals } from '../logic/fuel.js';
import { Card, EmptyState, MonthNav, PageHeader, ProgressBar, StatCard } from '../components/ui.jsx';
import { MoneyBarChart, MoneyLineChart, COLORS } from '../components/charts.jsx';
import { EarningModal, ExpenseModal, FuelModal } from '../components/forms.jsx';

const pct = (n) => `${Math.round(n)}%`;

export default function Dashboard({ navigate }) {
  const { state, dispatch, today, currentMonth, byDay, fmt, toast, ensureMonth } = useApp();
  const [month, setMonth] = useState(currentMonth);
  const [modal, setModal] = useState(null);
  const { goals, settings } = state;

  useEffect(() => ensureMonth(month), [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const ms = monthStart(month);
  const me = monthEnd(month);
  const refDate = month === currentMonth ? today : month < currentMonth ? me : ms;
  const ctx = useMemo(
    () => ({
      byDay,
      dailyGoalCents: goals.dailyGoalCents,
      workDays: settings.workDays,
      accumulateDeficit: goals.accumulateDeficit,
      accumulateSince: goals.accumulateSince,
    }),
    [byDay, goals, settings.workDays],
  );

  const daily = dailyGoalFor(refDate, ctx);
  const monthly = monthGoalStats({ monthKey: month, byDay, monthlyGoalCents: goals.monthlyGoalCents, workDays: settings.workDays, today });
  const week = weekRange(refDate);
  const weekEarned = sumEarnings(state.earnings, week.from, week.to);
  const sum = periodSummary(state.earnings, state.expenses, ms, me);
  const fuelMonth = fuelTotals(state.fuel, ms, me);

  const dailyData = useMemo(() => {
    const upto = month === currentMonth ? today : me;
    const rows = month > currentMonth ? [] : goalSeries(ms, upto, ctx);
    const data = rows.map((r) => ({ label: r.date.slice(8), earned: r.earnedCents, goal: r.goalCents }));
    if (upto < me) {
      // dias futuros: só a meta-base, sem ganho
      for (let i = Number(upto.slice(8)) + 1; i <= Number(me.slice(8)); i += 1) {
        const iso = `${month}-${String(i).padStart(2, '0')}`;
        data.push({ label: iso.slice(8), earned: null, goal: isWorkDay(iso, settings.workDays) ? goals.dailyGoalCents : 0 });
      }
    }
    return data;
  }, [month, currentMonth, today, ms, me, ctx, settings.workDays, goals.dailyGoalCents]);

  const compareData = useMemo(
    () => buildSeries(monthStart(addMonths(month, -5)), me, state.earnings, state.expenses, 'month'),
    [month, me, state.earnings, state.expenses],
  );

  const isEmpty = !state.earnings.length && !state.expenses.length && !state.fuel.length;
  const isToday = refDate === today;
  const dayLabel = isToday ? 'hoje' : formatDateBR(refDate);

  const loadDemo = () => {
    dispatch('LOAD_DEMO', { demo: buildDemoData(today), uptoMonth: currentMonth });
    toast('success', 'Dados de demonstração carregados. Remova quando quiser em Configurações.');
  };

  const netTone = sum.netCents >= 0 ? 'green' : 'red';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Visão de ${formatMonthLabel(month)}`}
        actions={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <button className="btn btn-primary" onClick={() => setModal('earning')}><Plus size={16} /> Ganho</button>
            <button className="btn" onClick={() => setModal('expense')}><Plus size={16} /> Despesa</button>
            <button className="btn" onClick={() => setModal('fuel')}><Fuel size={16} /> Abastecimento</button>
          </>
        }
      />

      {isEmpty && (
        <Card className="welcome">
          <EmptyState
            icon={PiggyBank}
            title="Comece registrando seu primeiro ganho"
            text="Os indicadores, metas e gráficos aparecem aqui assim que você lançar ganhos e despesas. Quer só explorar? Carregue dados de demonstração e remova depois."
            action={
              <div className="row gap">
                <button className="btn btn-primary" onClick={() => setModal('earning')}><Plus size={16} /> Registrar ganho</button>
                <button className="btn" onClick={loadDemo}>Carregar dados de demonstração</button>
              </div>
            }
          />
        </Card>
      )}

      <div className="grid grid-2">
        <Card title={`Meta diária (${dayLabel})`} action={<Target size={18} className="muted" />}>
          {daily.isWorkDay || daily.goalCents > 0 ? (
            <>
              <div className="goal-main">
                <strong className="big">{fmt.money(daily.earnedCents)}</strong>
                <span className="muted">de {fmt.money(daily.goalCents)}</span>
              </div>
              <ProgressBar percent={daily.percent} tone={daily.excessCents > 0 ? 'green' : 'blue'} label="Progresso da meta diária" />
              <div className="goal-meta">
                <span>{pct(daily.percent ?? 0)} concluído</span>
                {daily.excessCents > 0 ? (
                  <span className="pos">Meta superada em {fmt.money(daily.excessCents)}</span>
                ) : (
                  <span>Faltam {fmt.money(daily.remainingCents)}</span>
                )}
              </div>
              {daily.carryCents > 0 && (
                <p className="note">
                  Meta base {fmt.money(daily.baseCents)} + déficit acumulado {fmt.money(daily.carryCents)}
                </p>
              )}
            </>
          ) : (
            <p className="muted">Dia de folga — sem meta configurada. Ganhos de hoje: <strong>{fmt.money(daily.earnedCents)}</strong>.</p>
          )}
        </Card>

        <Card title="Meta mensal" action={<Target size={18} className="muted" />}>
          <div className="goal-main">
            <strong className="big">{fmt.money(monthly.earnedCents)}</strong>
            <span className="muted">de {fmt.money(monthly.goalCents)}</span>
          </div>
          <ProgressBar percent={monthly.percent} tone={monthly.excessCents > 0 ? 'green' : 'blue'} label="Progresso da meta mensal" />
          <div className="goal-meta">
            <span>{pct(monthly.percent)} concluído</span>
            {monthly.excessCents > 0 ? (
              <span className="pos">Meta superada em {fmt.money(monthly.excessCents)}</span>
            ) : (
              <span>Faltam {fmt.money(monthly.remainingCents)}</span>
            )}
          </div>
          <dl className="kv">
            <div>
              <dt>Média diária necessária</dt>
              <dd>
                {monthly.remainingCents === 0
                  ? '—'
                  : monthly.requiredDailyCents === null
                    ? 'Sem dias de trabalho restantes'
                    : `${fmt.money(monthly.requiredDailyCents)} por dia de trabalho`}
              </dd>
            </div>
            <div>
              <dt>Projeção até o fim do mês</dt>
              <dd>{monthly.isCurrent || monthly.isPast ? fmt.money(monthly.projectedCents) : '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid grid-4">
        <StatCard icon={TrendingUp} label={`Ganhos (${dayLabel})`} value={fmt.money(daily.earnedCents)} tone="green" />
        <StatCard icon={TrendingUp} label="Faturamento semanal" value={fmt.money(weekEarned)} hint={`${formatShortBR(week.from)} a ${formatShortBR(week.to)}`} tone="green" />
        <StatCard icon={TrendingUp} label="Faturamento mensal" value={fmt.money(sum.grossCents)} hint="Bruto, antes das despesas" tone="green" />
        <StatCard icon={Receipt} label="Despesas do mês" value={fmt.money(sum.expensesCents)} hint={`Pagas: ${fmt.money(sum.paidCents)}`} tone="red" />
        <StatCard icon={Receipt} label="Despesas pendentes" value={fmt.money(sum.pendingCents)} tone={sum.pendingCents > 0 ? 'amber' : 'neutral'} />
        <StatCard icon={Fuel} label="Gastos com combustível" value={fmt.money(fuelMonth.amountCents)} hint={`${fuelMonth.count} abastecimento(s) no mês`} tone="blue" />
        <StatCard icon={Scale} label="Resultado líquido" value={fmt.money(sum.netCents)} hint="Faturamento − despesas do mês" tone={netTone} />
        <StatCard icon={Wallet} label="Saldo de caixa" value={fmt.money(sum.cashCents)} hint="Ganhos − despesas pagas" tone={sum.cashCents >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid grid-2">
        <Card title="Evolução diária do mês">
          {dailyData.length ? (
            <MoneyLineChart
              data={dailyData}
              series={[
                { key: 'earned', name: 'Ganhos', color: COLORS.green },
                { key: 'goal', name: 'Meta do dia', color: COLORS.blue, dashed: true },
              ]}
            />
          ) : (
            <EmptyState title="Sem dados neste mês" text="Navegue para um mês com lançamentos ou registre um ganho." />
          )}
        </Card>
        <Card title="Ganhos x despesas (6 meses)">
          <MoneyBarChart
            data={compareData}
            series={[
              { key: 'earningsCents', name: 'Ganhos', color: COLORS.green },
              { key: 'expensesCents', name: 'Despesas', color: COLORS.red },
            ]}
          />
        </Card>
      </div>

      {modal === 'earning' && <EarningModal defaultDate={refDate <= today ? refDate : today} onClose={() => setModal(null)} />}
      {modal === 'expense' && <ExpenseModal defaultMonth={month} onClose={() => setModal(null)} />}
      {modal === 'fuel' && <FuelModal onClose={() => setModal(null)} />}
    </>
  );
}
