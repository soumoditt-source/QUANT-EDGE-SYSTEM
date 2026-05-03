import React from 'react';
import { useStore } from '../store/useStore';
import { AlertTriangle, TrendingUp, ArrowLeftRight, Activity } from 'lucide-react';

const REGIMES = [
  { name: 'MEAN-REVERTING', short: 'MR',  color: '#3B82F6', glow: '#60A5FA', icon: ArrowLeftRight },
  { name: 'TRENDING',       short: 'TRD', color: '#F59E0B', glow: '#FCD34D', icon: TrendingUp    },
  { name: 'TOXIC FLOW',     short: 'TOX', color: '#EF4444', glow: '#FCA5A5', icon: AlertTriangle  },
];

const DESCRIPTIONS = [
  'Market makers dominate. Stat-arb opportunities present. Tight spreads, balanced book.',
  'Directional institutional flow detected. Momentum strategies effective. Wider spreads.',
  'Informed traders active. Adverse selection risk HIGH. Market makers withdrawing.',
];

export const ExplainabilityPanel: React.FC = () => {
  const regime     = useStore(s => s.regime);
  const probs      = useStore(s => s.probs);
  const confidence = useStore(s => s.confidence);
  const signals    = useStore(s => s.signals);
  const r = REGIMES[regime] ?? REGIMES[0];
  const Icon = r.icon;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden rounded-xl"
      style={{
        background: 'linear-gradient(145deg,#040c1a 0%,#060e1e 100%)',
        border: '1px solid rgba(148,163,184,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
      >
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">Intelligence Core</p>
          <p className="text-[8px] text-slate-700 tracking-widest uppercase mt-0.5">LRDE · MCS · 5D Feature Space</p>
        </div>
        <Activity className="w-4 h-4" style={{ color: r.glow }} />
      </div>

      {/* Active Regime */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div
          className="rounded-lg px-3 py-2.5 flex items-center gap-3"
          style={{
            background: `${r.color}12`,
            border: `1px solid ${r.color}30`,
            boxShadow: `0 0 20px ${r.color}08`,
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${r.color}20`, border: `1px solid ${r.color}40` }}
          >
            <Icon className="w-4 h-4" style={{ color: r.glow }} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Active Regime</p>
            <p className="text-sm font-black tracking-tight leading-tight" style={{ color: r.glow }}>
              {r.name}
            </p>
          </div>
        </div>
        <p className="text-[9px] text-slate-600 mt-2 leading-relaxed px-1">
          {DESCRIPTIONS[regime]}
        </p>
      </div>

      {/* MCS Bar */}
      <div className="shrink-0 px-4 pb-3">
        <div className="flex justify-between items-end mb-1.5">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest">Microstructure Confidence</p>
          <p
            className="text-sm font-black font-mono"
            style={{ color: confidence < 0.5 ? '#EF4444' : confidence < 0.75 ? '#F59E0B' : '#10D994' }}
          >
            {(confidence * 100).toFixed(1)}%
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${confidence * 100}%`,
              background: confidence < 0.5
                ? 'linear-gradient(90deg,#7F1D1D,#EF4444)'
                : confidence < 0.75
                ? 'linear-gradient(90deg,#78350F,#F59E0B)'
                : 'linear-gradient(90deg,#064E3B,#10D994)',
              boxShadow: `0 0 8px ${confidence < 0.5 ? '#EF444460' : confidence < 0.75 ? '#F59E0B60' : '#10D99460'}`,
            }}
          />
        </div>
        {confidence < 0.5 && (
          <p className="mt-1.5 text-[8px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            High entropy — signals unreliable, widen stops
          </p>
        )}
      </div>

      {/* Regime Probability Bars */}
      <div className="flex-1 px-4 pb-3 min-h-0">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-2">Regime Probabilities</p>
        <div className="space-y-2">
          {REGIMES.map((rg, i) => (
            <div key={rg.short} className="flex items-center gap-2">
              <p className="text-[8px] font-bold w-8 shrink-0" style={{ color: rg.color }}>{rg.short}</p>
              <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(probs[i] ?? 0) * 100}%`,
                    background: rg.color,
                    boxShadow: regime === i ? `0 0 8px ${rg.color}80` : 'none',
                  }}
                />
              </div>
              <p className="text-[9px] font-mono w-8 text-right shrink-0" style={{ color: rg.color }}>
                {((probs[i] ?? 0) * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>

        {/* Signal snapshot */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[
            { label: 'OBI',  val: signals.obi,  col: '#10D994' },
            { label: 'VPIN', val: signals.vpin, col: '#EF4444' },
            { label: 'VWAP', val: signals.vwap, col: '#3B82F6' },
          ].map(s => (
            <div key={s.label}
              className="rounded-lg px-2 py-1.5 text-center"
              style={{ background: `${s.col}0D`, border: `1px solid ${s.col}25` }}
            >
              <p className="text-[7px] uppercase tracking-widest" style={{ color: s.col }}>{s.label}</p>
              <p className="text-[11px] font-black font-mono mt-0.5" style={{ color: s.col }}>
                {s.val >= 0 ? '+' : ''}{s.val.toFixed(3)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
