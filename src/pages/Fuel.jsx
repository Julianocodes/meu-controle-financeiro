import { useMemo, useState } from 'react';
import { Fuel as FuelIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { formatDateBR, monthEnd, monthStart, weekRange } from '../utils/dates.js';
import { formatLiters, formatPricePerLiter } from '../utils/money.js';
import { fuelTotals } from '../logic/fuel.js';
import { Card, ConfirmDialog, EmptyState, MonthNav, PageHeader, StatCard } from '../components/ui.jsx';
import { FuelModal } from '../components/forms.jsx';

export default function Fuel() {
  const { state, dispatch, today, currentMonth, fmt, toast } = useApp();
  const [month, setMonth] = useState(currentMonth);
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const ms = monthStart(month);
  const me = monthEnd(month);
  const refDate = month === currentMonth ? today : month < currentMonth ? me : ms;
  const week = weekRange(refDate);

  const day = fuelTotals(state.fuel, refDate, refDate);
  const wk = fuelTotals(state.fuel, week.from, week.to);
  const mo = fuelTotals(state.fuel, ms, me);

  const rows = useMemo(
    () => state.fuel.filter((f) => f.date >= ms && f.date <= me).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.fuel, ms, me],
  );

  const confirmDelete = () => {
    dispatch('DELETE_FUEL', { id: toDelete.id });
    toast('success', 'Abastecimento excluído (e a despesa vinculada também).');
    setToDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Combustível"
        subtitle="Cada abastecimento é lançado nas despesas automaticamente, sem duplicar."
        actions={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Novo abastecimento</button>
          </>
        }
      />

      <div className="grid grid-4">
        <StatCard icon={FuelIcon} label={refDate === today ? 'Custo hoje' : `Custo em ${formatDateBR(refDate)}`} value={fmt.money(day.amountCents)} tone="blue" />
        <StatCard icon={FuelIcon} label="Custo da semana" value={fmt.money(wk.amountCents)} tone="blue" />
        <StatCard icon={FuelIcon} label="Custo do mês" value={fmt.money(mo.amountCents)} hint={`${mo.count} abastecimento(s)`} tone="blue" />
        <StatCard label="Litros / preço médio" value={formatLiters(mo.litersMilli)} hint={mo.count ? formatPricePerLiter(mo.avgPriceMilli) : '—'} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FuelIcon}
            title="Nenhum abastecimento neste mês"
            text="Informe valor pago e litros; o preço por litro é calculado e a despesa é criada sozinha."
            action={<button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Novo abastecimento</button>}
          />
        </Card>
      ) : (
        <Card>
          <ul className="list">
            {rows.map((f) => (
              <li key={f.id} className="list-item">
                <div className="list-main">
                  <span className="list-title">{formatDateBR(f.date)}</span>
                  <span className="list-sub">
                    {formatLiters(f.litersMilli)} · {formatPricePerLiter(f.priceMilli)}
                    {f.note ? ` · ${f.note}` : ''}
                  </span>
                  {f.demo && <span className="badges"><span className="badge badge-demo">demo</span></span>}
                </div>
                <strong className="neg">{fmt.money(f.amountCents)}</strong>
                <div className="list-actions">
                  <button className="icon-btn" aria-label={`Editar abastecimento de ${formatDateBR(f.date)}`} onClick={() => setModal({ fuel: f })}><Pencil size={16} /></button>
                  <button className="icon-btn danger" aria-label={`Excluir abastecimento de ${formatDateBR(f.date)}`} onClick={() => setToDelete(f)}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {modal && <FuelModal initial={modal.fuel} onClose={() => setModal(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Excluir abastecimento?"
          message={`O abastecimento de ${fmt.money(toDelete.amountCents)} e a despesa vinculada serão removidos. Esta ação não pode ser desfeita.`}
          onClose={() => setToDelete(null)}
          actions={[{ label: 'Excluir', variant: 'danger', onClick: confirmDelete }]}
        />
      )}
    </>
  );
}
