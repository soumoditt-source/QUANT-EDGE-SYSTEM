import React from 'react';
import { useStore } from '../store/useStore';
import { Wifi, WifiOff } from 'lucide-react';

export const LiveMetrics: React.FC = () => {
  const isConnected = useStore(state => state.isConnected);
  const bids = useStore(state => state.bids);
  const asks = useStore(state => state.asks);
  
  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const spread = bestAsk - bestBid;
  
  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-800 shadow-2xl flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isConnected ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/30 rounded-full text-accent text-sm font-bold">
            <Wifi className="w-4 h-4 animate-pulse" /> LIVE STREAM
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 bg-toxic/10 border border-toxic/30 rounded-full text-toxic text-sm font-bold">
            <WifiOff className="w-4 h-4" /> DISCONNECTED
          </div>
        )}
      </div>

      <div className="flex gap-12">
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Best Bid</div>
          <div className="text-xl font-mono font-bold text-accent">{bestBid.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Best Ask</div>
          <div className="text-xl font-mono font-bold text-toxic">{bestAsk.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Spread</div>
          <div className="text-xl font-mono font-bold text-gray-200">{spread.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};
