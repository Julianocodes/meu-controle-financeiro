import { addDays, addMonths, monthEnd, monthKeyOf, monthStart, weekRange } from '../utils/dates.js';

/** Períodos prontos. Retorna { from, to } (to/from vazios = sem limite). */
export function presetRange(preset, today) {
  const mk = monthKeyOf(today);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return weekRange(today);
    case 'month':
      return { from: monthStart(mk), to: monthEnd(mk) };
    case 'lastMonth': {
      const p = addMonths(mk, -1);
      return { from: monthStart(p), to: monthEnd(p) };
    }
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'all':
      return { from: '', to: '' };
    default:
      return null;
  }
}

const LABELS = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
  lastMonth: 'Mês passado',
  last30: '30 dias',
  year: 'Ano',
  all: 'Tudo',
};

/**
 * value = { preset, from, to }. Para "custom" o usuário edita as datas.
 */
export function PeriodFilter({ value, onChange, today, presets = ['today', 'week', 'month', 'lastMonth', 'last30', 'year', 'all'] }) {
  const choose = (preset) => onChange({ preset, ...presetRange(preset, today) });
  const setDate = (key, v) => onChange({ ...value, preset: 'custom', [key]: v });
  const invalid = value.from && value.to && value.from > value.to;
  return (
    <div className="period-filter">
      <div className="chips" role="group" aria-label="Período">
        {presets.map((p) => (
          <button key={p} className={`chip ${value.preset === p ? 'active' : ''}`} onClick={() => choose(p)}>
            {LABELS[p]}
          </button>
        ))}
        <button className={`chip ${value.preset === 'custom' ? 'active' : ''}`} onClick={() => onChange({ ...value, preset: 'custom' })}>
          Personalizado
        </button>
      </div>
      {value.preset === 'custom' && (
        <div className="date-range">
          <label>De <input type="date" value={value.from} onChange={(e) => setDate('from', e.target.value)} /></label>
          <label>Até <input type="date" value={value.to} onChange={(e) => setDate('to', e.target.value)} /></label>
          {invalid && <span className="field-error">A data inicial é depois da final.</span>}
        </div>
      )}
    </div>
  );
}
