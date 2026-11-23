import { useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload, X } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { buildBackup, clearAll, parseBackup } from '../storage/storage.js';
import { buildDemoData } from '../utils/demo.js';
import { WEEKDAY_SHORT } from '../utils/dates.js';
import { centsToInput, parseMoneyToCents } from '../utils/money.js';
import { Card, ConfirmDialog, Field, PageHeader } from '../components/ui.jsx';

function CategoryEditor({ title, list, onChange, minItems = 1 }) {
  const [text, setText] = useState('');
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || list.some((c) => c.toLowerCase() === t.toLowerCase())) return setText('');
    onChange([...list, t.slice(0, 40)]);
    setText('');
  };
  return (
    <div className="cat-editor">
      <h4>{title}</h4>
      <div className="chips">
        {list.map((c) => (
          <span key={c} className="chip chip-removable">
            {c}
            <button aria-label={`Remover ${c}`} disabled={list.length <= minItems} onClick={() => onChange(list.filter((x) => x !== c))}><X size={12} /></button>
          </span>
        ))}
      </div>
      <form className="row gap" onSubmit={add}>
        <input aria-label={`Nova categoria em ${title}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Nova categoria" maxLength={40} />
        <button className="btn btn-sm" type="submit"><Plus size={14} /> Adicionar</button>
      </form>
    </div>
  );
}

export default function Settings() {
  const { state, dispatch, today, currentMonth, toast, fmt } = useApp();
  const { goals, settings } = state;
  const fileRef = useRef(null);
  const [daily, setDaily] = useState(centsToInput(goals.dailyGoalCents));
  const [monthly, setMonthly] = useState(centsToInput(goals.monthlyGoalCents));
  const [errors, setErrors] = useState({});
  const [pendingImport, setPendingImport] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const hasDemo = state.earnings.some((e) => e.demo) || state.fuel.some((f) => f.demo);

  const saveGoals = (e) => {
    e.preventDefault();
    const d = parseMoneyToCents(daily);
    const m = parseMoneyToCents(monthly);
    const er = {};
    if (d === null || d <= 0) er.daily = 'Informe uma meta diária maior que zero.';
    if (m === null || m <= 0) er.monthly = 'Informe uma meta mensal maior que zero.';
    setErrors(er);
    if (Object.keys(er).length) return;
    dispatch('SET_GOALS', { changes: { dailyGoalCents: d, monthlyGoalCents: m }, today });
    setDaily(centsToInput(d));
    setMonthly(centsToInput(m));
    toast('success', 'Metas salvas.');
  };

  const toggleWorkDay = (i) => {
    const has = settings.workDays.includes(i);
    if (has && settings.workDays.length === 1) return toast('error', 'Mantenha pelo menos um dia de trabalho.');
    const workDays = has ? settings.workDays.filter((d) => d !== i) : [...settings.workDays, i].sort();
    dispatch('SET_SETTINGS', { changes: { workDays } });
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackup(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meu-controle-financeiro-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('success', 'Backup exportado.');
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast('error', 'Arquivo grande demais para um backup.');
    const reader = new FileReader();
    reader.onerror = () => toast('error', 'Não foi possível ler o arquivo.');
    reader.onload = () => {
      const r = parseBackup(String(reader.result));
      if (!r.ok) return toast('error', r.error);
      setPendingImport(r);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    dispatch('REPLACE_ALL', { state: pendingImport.state });
    toast('success', pendingImport.discarded ? `Backup importado. ${pendingImport.discarded} registro(s) inválido(s) foram ignorados.` : 'Backup importado com sucesso.');
    setDaily(centsToInput(pendingImport.state.goals.dailyGoalCents));
    setMonthly(centsToInput(pendingImport.state.goals.monthlyGoalCents));
    setPendingImport(null);
    dispatch('ENSURE_RECURRING', { uptoMonth: currentMonth });
  };

  const loadDemo = () => {
    dispatch('LOAD_DEMO', { demo: buildDemoData(today), uptoMonth: currentMonth });
    toast('success', 'Dados de demonstração carregados.');
  };
  const removeDemo = () => {
    dispatch('REMOVE_DEMO');
    toast('success', 'Dados de demonstração removidos.');
  };

  const resetAll = () => {
    dispatch('RESET_ALL');
    clearAll();
    setConfirmReset(false);
    setDaily(centsToInput(10000));
    setMonthly(centsToInput(200000));
    toast('success', 'Todos os dados foram apagados.');
  };

  const importCount = pendingImport
    ? `${pendingImport.state.earnings.length} ganhos, ${pendingImport.state.expenses.length} despesas, ${pendingImport.state.fuel.length} abastecimentos`
    : '';

  return (
    <>
      <PageHeader title="Configurações" subtitle="Metas, dias de trabalho, categorias, exibição e backup." />

      <div className="grid grid-2">
        <Card title="Metas">
          <form className="form" onSubmit={saveGoals} noValidate>
            <div className="form-row">
              <Field label="Meta diária (R$)" htmlFor="s-daily" error={errors.daily}>
                <input id="s-daily" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
              </Field>
              <Field label="Meta mensal (R$)" htmlFor="s-monthly" error={errors.monthly}>
                <input id="s-monthly" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
              </Field>
            </div>
            <button className="btn btn-primary" type="submit">Salvar metas</button>
          </form>
          <hr />
          <label className="switch">
            <input
              type="checkbox"
              checked={goals.accumulateDeficit}
              onChange={(e) => dispatch('SET_GOALS', { changes: { accumulateDeficit: e.target.checked }, today })}
            />
            <span>
              <strong>Meta acumulativa</strong>
              <small>O que faltar para a meta de um dia de trabalho é somado à meta do próximo dia de trabalho. Reinicia a cada mês{goals.accumulateSince ? ` (ativa desde ${goals.accumulateSince.split('-').reverse().join('/')})` : ''}.</small>
            </span>
          </label>
        </Card>

        <Card title="Dias de trabalho">
          <p className="muted">A meta diária e o déficit acumulado só valem nos dias marcados.</p>
          <div className="chips" role="group" aria-label="Dias de trabalho">
            {WEEKDAY_SHORT.map((label, i) => (
              <button key={label} className={`chip ${settings.workDays.includes(i) ? 'active' : ''}`} aria-pressed={settings.workDays.includes(i)} onClick={() => toggleWorkDay(i)}>
                {label}
              </button>
            ))}
          </div>
          <hr />
          <h4>Exibição</h4>
          <label className="switch">
            <input type="checkbox" checked={settings.display.hideValues} onChange={(e) => dispatch('SET_SETTINGS', { changes: { display: { hideValues: e.target.checked } } })} />
            <span><strong>Ocultar valores</strong><small>Mostra R$ ••••• no lugar dos valores (útil em público).</small></span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={settings.display.showCents} onChange={(e) => dispatch('SET_SETTINGS', { changes: { display: { showCents: e.target.checked } } })} />
            <span><strong>Mostrar centavos</strong><small>Exemplo: {fmt.hidden ? '—' : 'R$ 1.234,56 ou R$ 1.235'}.</small></span>
          </label>
        </Card>

        <Card title="Categorias">
          <CategoryEditor title="Categorias de ganhos" list={settings.earningCategories} minItems={1} onChange={(earningCategories) => dispatch('SET_SETTINGS', { changes: { earningCategories } })} />
          <hr />
          <CategoryEditor title="Categorias de despesas" list={settings.expenseCategories} minItems={1} onChange={(expenseCategories) => dispatch('SET_SETTINGS', { changes: { expenseCategories } })} />
          <p className="note">Registros antigos mantêm a categoria mesmo se ela for removida da lista.</p>
        </Card>

        <Card title="Backup e dados">
          <p className="muted">Os dados ficam só neste navegador. Exporte um backup para guardar ou levar para outro aparelho.</p>
          <div className="row gap wrap">
            <button className="btn" onClick={exportBackup}><Download size={16} /> Exportar backup (JSON)</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Importar backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} data-testid="import-input" />
          </div>
          <hr />
          <h4>Dados de demonstração</h4>
          <p className="muted">Exemplos para explorar o app. Ficam marcados como "demo" e saem todos de uma vez.</p>
          <div className="row gap wrap">
            <button className="btn" onClick={loadDemo} disabled={hasDemo}>Carregar demonstração</button>
            <button className="btn" onClick={removeDemo} disabled={!hasDemo}>Remover demonstração</button>
          </div>
          <hr />
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}><Trash2 size={16} /> Apagar todos os dados</button>
        </Card>
      </div>

      <Card
        title="Histórico de alterações"
        action={state.history.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => dispatch('CLEAR_HISTORY')}>Limpar histórico</button>}
      >
        {state.history.length === 0 ? (
          <p className="muted">Nenhuma alteração registrada ainda.</p>
        ) : (
          <ul className="history">
            {state.history.slice(0, 30).map((h) => (
              <li key={h.id}>
                <time dateTime={h.at}>{new Date(h.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendingImport && (
        <ConfirmDialog
          title="Importar backup?"
          message={`Isto substitui todos os dados atuais por: ${importCount}.${pendingImport.discarded ? ` ${pendingImport.discarded} registro(s) inválido(s) serão ignorados.` : ''} Exporte um backup antes se quiser guardar o que existe hoje.`}
          onClose={() => setPendingImport(null)}
          actions={[{ label: 'Substituir dados', variant: 'danger', onClick: confirmImport }]}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Apagar todos os dados?"
          message="Ganhos, despesas, abastecimentos, metas e configurações serão removidos deste navegador. Não pode ser desfeito."
          onClose={() => setConfirmReset(false)}
          actions={[{ label: 'Apagar tudo', variant: 'danger', onClick: resetAll }]}
        />
      )}
    </>
  );
}
