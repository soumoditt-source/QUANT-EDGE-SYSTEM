import React from 'react';
import { useStore } from '../store/useStore';
import { Activity, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

const REGIMES = [
  { name: 'MEAN-REVERTING', color: 'text-meanrev', bg: 'bg-meanrev/20', border: 'border-meanrev/50' },
  { name: 'TRENDING', color: 'text-accent', bg: 'bg-accent/20', border: 'border-accent/50' },
  { name: 'TOXIC', color: 'text-toxic', bg: 'bg-toxic/20', border: 'border-toxic/50' }
];

export const ExplainabilityPanel: React.FC = () => {
  const regime = useStore(state => state.regime);
  const probs = useStore(state => state.probs);
  const confidence = useStore(state => state.confidence);
  
  const currentRegime = REGIMES[regime] || REGIMES[0];

  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-800 shadow-2xl flex flex-col gap-6">
      <div className="flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-gray-200">INTELLIGENCE CORE</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest">LRDE + MCS Analysis</p>
        </div>
        <Activity className="w-6 h-6 text-primary" />
      </div>

      <div className={`p-4 rounded-lg border ${currentRegime.border} ${currentRegime.bg} transition-colors duration-500`}>
        <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Active Regime</div>
        <div className={`text-2xl font-black tracking-tight ${currentRegime.color}`}>
          {currentRegime.name}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <div className="text-sm text-gray-400">Microstructure Confidence Score</div>
          <div className={`text-lg font-bold ${confidence < 0.6 ? 'text-toxic' : 'text-accent'}`}>
            {(confidence * 100).toFixed(1)}%
          </div>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${confidence < 0.6 ? 'bg-toxic' : 'bg-accent'}`}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
        {confidence < 0.6 && (
          <div className="mt-2 text-xs text-toxic flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Trading suppressed due to high entropy
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-800">
        <div className="text-xs uppercase tracking-widest text-gray-400">Regime Probabilities</div>
        
        {REGIMES.map((r, i) => (
          <div key={r.name} className="flex items-center gap-4">
            <div className={`w-24 text-xs font-bold ${r.color}`}>{r.name}</div>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-500 ${r.bg.replace('/20', '')}`}
                style={{ width: `${probs[i] * 100}%` }}
              />
            </div>
            <div className="w-12 text-right text-xs text-gray-400">
              {(probs[i] * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
