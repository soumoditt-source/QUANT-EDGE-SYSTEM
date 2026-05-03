import React from 'react';
import { useStore } from '../store/useStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export function SignalCharts() {
  const signalHistory = useStore((state) => state.signalHistory);

  // Reformat timestamp to be readable if needed, or just use raw count for x-axis
  const data = signalHistory.map((s, idx) => ({
    ...s,
    time: new Date(s.timestamp / 1e6).toLocaleTimeString(),
    index: idx
  }));

  return (
    <div className="w-full h-full bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 backdrop-blur-md flex flex-col">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Microstructure Signals (Time Series)
      </h3>
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="index" hide />
            <YAxis 
              domain={[-1, 1]} 
              stroke="#64748b"
              tickFormatter={(val) => val.toFixed(2)}
              width={40}
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
            <Line 
              type="monotone" 
              dataKey="vpin" 
              stroke="#ef4444" 
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="VPIN (Toxicity)"
            />
            <Line 
              type="monotone" 
              dataKey="vwap" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="VWAP Dev"
            />
            <Line 
              type="monotone" 
              dataKey="obi" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Order Imbalance"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
