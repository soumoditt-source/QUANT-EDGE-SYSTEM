import React from 'react';
import { useStore } from '../store/useStore';

export const LiveMetrics: React.FC = () => {
  const connected = useStore(s => s.isConnected);
  const bids      = useStore(s => s.bids);
  const asks      = useStore(s => s.asks);
  const signals   = useStore(s => s.signals);

  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread  = bestAsk - bestBid;
  const mid     = bestBid > 0 ? (bestBid + bestAsk) / 2 : 0;

  const metrics = [
    { label: 'Bid',    value: bestBid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: '#10D994' },
    { label: 'Ask',    value: bestAsk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: '#FF4466' },
    { label: 'Spread', value: spread.toFixed(2),                                                                        color: '#94A3B8' },
    { label: 'OBI',    value: signals.obi >= 0 ? `+${signals.obi.toFixed(3)}` : signals.obi.toFixed(3),               color: signals.obi > 0 ? '#10D994' : '#FF4466' },
    { label: 'VPIN',   value: signals.vpin.toFixed(3),                                                                 color: signals.vpin < -0.3 ? '#FF4466' : '#94A3B8' },
  ];

  return (
    <div className="flex items-center gap-6">
      {/* Connection */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: connected ? '#10D994' : '#EF4444',
            boxShadow: `0 0 6px ${connected ? '#10D994' : '#EF4444'}`,
            animation: connected ? 'pulse 2s infinite' : 'none',
          }}
        />
        <span className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color: connected ? '#10D994' : '#EF4444' }}>
          {connected ? 'BTC/USDT LIVE' : 'OFFLINE'}
        </span>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-slate-800" />

      {/* Metric chips */}
      {metrics.map(m => (
        <div key={m.label} className="flex flex-col items-center">
          <span className="text-[8px] text-slate-600 uppercase tracking-widest">{m.label}</span>
          <span className="text-[12px] font-bold font-mono leading-tight" style={{ color: m.color }}>{m.value}</span>
        </div>
      ))}
    </div>
  );
};
