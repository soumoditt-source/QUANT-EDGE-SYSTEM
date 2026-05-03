import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg p-3 text-xs"
      style={{
        background: 'rgba(2, 6, 23, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.12)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <p className="text-slate-500 mb-2 font-mono">Tick #{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: entry.color, boxShadow: `0 0 4px ${entry.color}` }}
          />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-bold font-mono" style={{ color: entry.color }}>
            {Number(entry.value).toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Signal Row Component ─────────────────────────────────────────────────────
const SignalRow = ({
  label,
  value,
  color,
  description,
}: {
  label: string;
  value: number;
  color: string;
  description: string;
}) => {
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0">
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color }}>
          {label}
        </p>
        <p className="text-[9px] text-slate-600 mt-0.5">{description}</p>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 relative overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.abs(value) * 50}%`,
            marginLeft: isPositive ? '50%' : `${50 - Math.abs(value) * 50}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
        {/* Centre line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600" />
      </div>
      <div
        className="w-14 text-right font-mono text-xs font-bold shrink-0"
        style={{ color }}
      >
        {value >= 0 ? '+' : ''}{value.toFixed(3)}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function SignalCharts() {
  const signalHistory = useStore((state) => state.signalHistory);
  const signals = useStore((state) => state.signals);
  const regime = useStore((state) => state.regime);
  const confidence = useStore((state) => state.confidence);

  const data = useMemo(
    () =>
      signalHistory.map((s, idx) => ({
        ...s,
        index: idx,
      })),
    [signalHistory]
  );

  const regimeName = ['Mean-Reverting', 'Trending', 'Toxic Flow'][regime];
  const regimeColor = ['#3B82F6', '#F59E0B', '#EF4444'][regime];
  const confidencePct = (confidence * 100).toFixed(1);

  return (
    <div
      className="w-full h-full rounded-xl flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #020617 0%, #080d1a 100%)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
        boxShadow: `0 0 30px ${regimeColor}10`,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex justify-between items-start">
        <div>
          <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em]">
            Microstructure Signals
          </h3>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">
            Live time-series · {data.length} ticks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase"
            style={{
              background: `${regimeColor}18`,
              border: `1px solid ${regimeColor}40`,
              color: regimeColor,
            }}
          >
            {regimeName}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            MCS{' '}
            <span className="font-bold" style={{ color: regimeColor }}>
              {confidencePct}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 px-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <defs>
              <linearGradient id="gradVPIN" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradVWAP" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradOBI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10D994" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10D994" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 4" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="index" hide />
            <YAxis
              domain={[-1, 1]}
              stroke="#334155"
              tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => v.toFixed(1)}
              width={32}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 2" strokeOpacity={0.6} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
              formatter={(value) => (
                <span style={{ color: '#94A3B8', letterSpacing: '0.05em' }}>{value}</span>
              )}
            />

            <Area
              type="monotoneX"
              dataKey="vpin"
              stroke="#EF4444"
              strokeWidth={1.5}
              fill="url(#gradVPIN)"
              dot={false}
              isAnimationActive={false}
              name="VPIN Toxicity"
            />
            <Area
              type="monotoneX"
              dataKey="vwap"
              stroke="#3B82F6"
              strokeWidth={1.5}
              fill="url(#gradVWAP)"
              dot={false}
              isAnimationActive={false}
              name="VWAP Dev"
            />
            <Area
              type="monotoneX"
              dataKey="obi"
              stroke="#10D994"
              strokeWidth={1.5}
              fill="url(#gradOBI)"
              dot={false}
              isAnimationActive={false}
              name="OBI Imbalance"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Live Signal Bars */}
      <div className="px-4 py-3 shrink-0 space-y-2.5 border-t border-slate-800/50">
        <SignalRow
          label="OBI"
          value={signals.obi}
          color="#10D994"
          description="Order Imbalance"
        />
        <SignalRow
          label="VPIN"
          value={signals.vpin}
          color="#EF4444"
          description="Toxicity Index"
        />
        <SignalRow
          label="VWAP"
          value={signals.vwap}
          color="#3B82F6"
          description="Price Deviation"
        />
      </div>
    </div>
  );
}
