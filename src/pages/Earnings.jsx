import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { formatWeekdayDate, inRange } from '../utils/dates.js';
import { Card, ConfirmDialog, EmptyState, PageHeader, StatCard } from '../components/ui.jsx';
import { PeriodFilter, presetRange } from '../components/PeriodFilter.jsx';
import { EarningModal } from '../components/forms.jsx';

export default function Earnings() {
  const { state, dispatch, today, fmt, toast } = useApp();
  const [period, setPeriod] = useState(() => ({ preset: 'month', ...presetRange('month', today) }));
  const [modal, setModal] = useState(null); // { earning? }
  const [toDelete, setToDelete] = useState(null);

  const groups = useMemo(() => {
    const filtered = state.earnings.filter((e) => inRange(e.date, period.from, period.to));
    const byDate = new Map();
    for (const e of filtered) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items,
        totalCents: items.reduce((s, i) => s + i.amountCents, 0), // soma automática do dia
      }));
  }, [state.earnings, period]);

  const total = groups.reduce((s, g) => s + g.totalCents, 0);
  const count = groups.reduce((s, g) => s + g.items.length, 0);
  const average = groups.length ? Math.round(total / groups.length) : 0;

  const confirmDelete = () => {
    dispatch('DELETE_EARNING', { id: toDelete.id });
    toast('success', 'Ganho excluído.');
    setToDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Ganhos"
        subtitle="Registre cada ganho; os do mesmo dia são somados automaticamente."
        actions={<button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Novo ganho</button>}
      />
      <PeriodFilter value={period} onChange={setPeriod} today={today} />

      <div className="grid grid-3">
        <StatCard icon={TrendingUp} label="Total no período" value={fmt.money(total)} tone="green" />
        <StatCard label="Lançamentos" value={String(count)} />
        <StatCard label="Média por dia com ganho" value={fmt.money(average)} hint={`${groups.length} dia(s)`} />
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Nenhum ganho neste período"
            text={state.earnings.length ? 'Tente outro período no filtro acima.' : 'Toque em "Novo ganho" para registrar o primeiro.'}
            action={<button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Novo ganho</button>}
          />
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.date} className="day-group">
            <header className="day-header">
              <strong>{formatWeekdayDate(g.date)}</strong>
              <span className="pos">{fmt.money(g.totalCents)}</span>
            </header>
            <ul className="list">
              {g.items.map((e) => (
                <li key={e.id} className="list-item">
                  <div className="list-main">
                    <span className="list-title">{e.description || 'Sem descrição'}</span>
                    {e.category && <span className="badge">{e.category}</span>}
                    {e.demo && <span className="badge badge-demo">demo</span>}
                  </div>
                  <strong className="pos">{fmt.money(e.amountCents)}</strong>
                  <div className="list-actions">
                    <button className="icon-btn" aria-label={`Editar ${e.description}`} onClick={() => setModal({ earning: e })}><Pencil size={16} /></button>
                    <button className="icon-btn danger" aria-label={`Excluir ${e.description}`} onClick={() => setToDelete(e)}><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      {modal && <EarningModal initial={modal.earning} onClose={() => setModal(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Excluir ganho?"
          message={`"${toDelete.description}" de ${fmt.money(toDelete.amountCents)} será removido. Esta ação não pode ser desfeita.`}
          onClose={() => setToDelete(null)}
          actions={[{ label: 'Excluir', variant: 'danger', onClick: confirmDelete }]}
        />
      )}
    </>
  );
}
