import { useEffect, useMemo, useState } from 'react';
import { Check, Fuel, Pencil, Plus, Receipt, RotateCcw, Trash2 } from 'lucide-react';
import { STATUS, STATUS_LABEL } from '../constants.js';
import { useApp } from '../state/AppContext.jsx';
import { formatDateBR, monthEnd, monthStart } from '../utils/dates.js';
import { expenseTotals } from '../logic/finance.js';
import { Card, ConfirmDialog, EmptyState, MonthNav, PageHeader, StatCard } from '../components/ui.jsx';
import { ExpenseModal } from '../components/forms.jsx';

export default function Expenses({ navigate }) {
  const { state, dispatch, today, currentMonth, fmt, toast, ensureMonth } = useApp();
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => ensureMonth(month), [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const ms = monthStart(month);
  const me = monthEnd(month);
  const totals = expenseTotals(state.expenses, ms, me);

  const rows = useMemo(
    () =>
      state.expenses
        .filter((e) => e.dueDate >= ms && e.dueDate <= me)
        .filter((e) => status === 'all' || e.status === status)
        .filter((e) => category === 'all' || e.category === category)
        .sort((a, b) => (a.dueDate === b.dueDate ? a.name.localeCompare(b.name) : a.dueDate < b.dueDate ? -1 : 1)),
    [state.expenses, ms, me, status, category],
  );

  const categories = useMemo(() => {
    const set = new Set([...state.settings.expenseCategories, ...state.expenses.map((e) => e.category)]);
    return [...set];
  }, [state.settings.expenseCategories, state.expenses]);

  const togglePaid = (e) => {
    const paid = e.status !== STATUS.PAID;
    dispatch('SET_EXPENSE_PAID', { id: e.id, paid, date: today });
    toast('success', paid ? `"${e.name}" marcada como paga.` : `"${e.name}" voltou para pendente.`);
  };

  const remove = (mode) => {
    dispatch('DELETE_EXPENSE', { id: toDelete.id, mode });
    toast('success', 'Despesa excluída.');
    setToDelete(null);
  };

  const deleteActions = toDelete?.recurringId
    ? [
        { label: 'Só este mês', variant: 'danger', onClick: () => remove('one') },
        { label: 'Este e os próximos', variant: 'danger', onClick: () => remove('future') },
      ]
    : [{ label: 'Excluir', variant: 'danger', onClick: () => remove('one') }];

  return (
    <>
      <PageHeader
        title="Despesas"
        subtitle="Despesas fixas, variáveis e recorrentes por mês de vencimento."
        actions={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Nova despesa</button>
          </>
        }
      />

      <div className="grid grid-3">
        <StatCard label="Total do mês" value={fmt.money(totals.total)} tone="red" />
        <StatCard label="Pagas" value={fmt.money(totals.paid)} tone="green" />
        <StatCard label="Pendentes" value={fmt.money(totals.pending)} tone={totals.pending > 0 ? 'amber' : 'neutral'} />
      </div>

      <div className="filters">
        <div className="chips" role="group" aria-label="Status">
          {[['all', 'Todas'], [STATUS.PENDING, 'Pendentes'], [STATUS.PAID, 'Pagas']].map(([v, l]) => (
            <button key={v} className={`chip ${status === v ? 'active' : ''}`} onClick={() => setStatus(v)}>{l}</button>
          ))}
        </div>
        <select aria-label="Filtrar por categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Todas as categorias</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="Nenhuma despesa encontrada"
            text={state.expenses.length ? 'Não há despesas com esses filtros neste mês.' : 'Cadastre suas contas fixas como recorrentes: elas são geradas todo mês, sem duplicar.'}
            action={<button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Nova despesa</button>}
          />
        </Card>
      ) : (
        <Card>
          <ul className="list">
            {rows.map((e) => {
              const paid = e.status === STATUS.PAID;
              const overdue = !paid && e.dueDate < today;
              return (
                <li key={e.id} className={`list-item ${overdue ? 'overdue' : ''}`}>
                  <div className="list-main">
                    <span className="list-title">{e.name}</span>
                    <span className="list-sub">
                      Vence {formatDateBR(e.dueDate)} · {e.category} · {e.type}
                    </span>
                    <span className="badges">
                      <span className={`badge ${paid ? 'badge-green' : overdue ? 'badge-red' : 'badge-amber'}`}>
                        {overdue ? 'Vencida' : STATUS_LABEL[e.status]}
                      </span>
                      {e.recurringId && <span className="badge">Mensal</span>}
                      {e.fuelId && <span className="badge badge-blue"><Fuel size={12} /> Combustível</span>}
                      {e.demo && <span className="badge badge-demo">demo</span>}
                    </span>
                  </div>
                  <strong className="neg">{fmt.money(e.amountCents)}</strong>
                  <div className="list-actions">
                    {e.fuelId ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate('fuel')}>Gerir em Combustível</button>
                    ) : (
                      <>
                        <button
                          className="icon-btn"
                          aria-label={paid ? `Marcar ${e.name} como pendente` : `Marcar ${e.name} como paga`}
                          title={paid ? 'Desfazer pagamento' : 'Marcar como paga'}
                          onClick={() => togglePaid(e)}
                        >
                          {paid ? <RotateCcw size={16} /> : <Check size={16} />}
                        </button>
                        <button className="icon-btn" aria-label={`Editar ${e.name}`} onClick={() => setModal({ expense: e })}><Pencil size={16} /></button>
                        <button className="icon-btn danger" aria-label={`Excluir ${e.name}`} onClick={() => setToDelete(e)}><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {modal && <ExpenseModal initial={modal.expense} defaultMonth={month} onClose={() => setModal(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Excluir despesa?"
          message={
            toDelete.recurringId
              ? `"${toDelete.name}" é recorrente. Excluir só este mês ou este e todos os próximos? Não pode ser desfeito.`
              : `"${toDelete.name}" de ${fmt.money(toDelete.amountCents)} será removida. Esta ação não pode ser desfeita.`
          }
          onClose={() => setToDelete(null)}
          actions={deleteActions}
        />
      )}
    </>
  );
}
