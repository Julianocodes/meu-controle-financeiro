import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../state/AppContext.jsx';

export const COLORS = {
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  teal: '#14B8A6',
  grid: '#273247',
  axis: '#94A3B8',
};
export const PIE_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#EC4899', '#94A3B8'];

const compact = (cents) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

function useMoneyAxis() {
  const { fmt } = useApp();
  return {
    tick: (v) => (fmt.hidden ? '' : compact(v)),
    tooltip: (v) => fmt.money(v),
  };
}

const tooltipStyle = {
  contentStyle: { background: '#151B2B', border: '1px solid #273247', borderRadius: 8, color: '#F1F5F9' },
  labelStyle: { color: '#94A3B8' },
  itemStyle: { color: '#F1F5F9' },
  cursor: { fill: 'rgba(148,163,184,0.08)' },
};

const axisProps = { stroke: COLORS.axis, tick: { fill: COLORS.axis, fontSize: 12 }, tickLine: false };

export function ChartBox({ height = 260, children }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

/** series: [{ key, name, color }] ; data valores em CENTAVOS */
export function MoneyBarChart({ data, xKey = 'label', series, height }) {
  const ax = useMoneyAxis();
  return (
    <ChartBox height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} tickFormatter={ax.tick} width={48} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [ax.tooltip(v), n]} />
        {series.length > 1 && <Legend wrapperStyle={{ color: COLORS.axis, fontSize: 12 }} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ChartBox>
  );
}

export function MoneyLineChart({ data, xKey = 'label', series, height }) {
  const ax = useMoneyAxis();
  return (
    <ChartBox height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} tickFormatter={ax.tick} width={48} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [ax.tooltip(v), n]} />
        {series.length > 1 && <Legend wrapperStyle={{ color: COLORS.axis, fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            dot={data.length <= 31 ? { r: 2 } : false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ChartBox>
  );
}

export function CategoryPie({ data, height = 280 }) {
  const { fmt } = useApp();
  const total = data.reduce((s, d) => s + d.valueCents, 0);
  return (
    <ChartBox height={height}>
      <PieChart>
        <Pie data={data} dataKey="valueCents" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#151B2B">
          {data.map((d, i) => (
            <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v, n) => [`${fmt.money(v)} (${total ? Math.round((v * 100) / total) : 0}%)`, n]}
        />
        <Legend wrapperStyle={{ color: COLORS.axis, fontSize: 12 }} />
      </PieChart>
    </ChartBox>
  );
}

/** Linha com valores em reais (ex.: preço do litro). */
export function PlainLineChart({ data, xKey = 'label', series, height, yFormatter }) {
  return (
    <ChartBox height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={48} domain={['auto', 'auto']} tickFormatter={yFormatter} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [yFormatter ? yFormatter(v) : v, n]} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ChartBox>
  );
}
