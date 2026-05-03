import { create } from 'zustand';

interface OrderBookLevel {
  price: number;
  qty: number;
}

interface Signals {
  obi: number;
  vpin: number;
  vwap: number;
}

interface SignalHistoryPoint extends Signals {
  timestamp: number;
}

interface QuantState {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  regime: number; // 0=MR, 1=TREND, 2=TOXIC
  probs: number[];
  confidence: number;
  timestamp: number;
  signals: Signals;
  signalHistory: SignalHistoryPoint[];
  isConnected: boolean;
  setMarketData: (data: any) => void;
  setConnectionStatus: (status: boolean) => void;
}

export const useStore = create<QuantState>((set) => ({
  bids: [],
  asks: [],
  regime: 0,
  probs: [1.0, 0.0, 0.0],
  confidence: 1.0,
  timestamp: 0,
  signals: { obi: 0, vpin: 0, vwap: 0 },
  signalHistory: [],
  isConnected: false,
  setMarketData: (data) => set((state) => {
    const newSignals = data.signals || { obi: 0, vpin: 0, vwap: 0 };
    const newPoint = { ...newSignals, timestamp: data.timestamp };
    
    // Keep last 100 points
    const newHistory = [...state.signalHistory, newPoint].slice(-100);
    
    return {
      bids: data.bids.map((b: any) => ({ price: b[0], qty: b[1] })),
      asks: data.asks.map((a: any) => ({ price: a[0], qty: a[1] })),
      regime: data.regime,
      probs: data.probs,
      confidence: data.confidence,
      timestamp: data.timestamp,
      signals: newSignals,
      signalHistory: newHistory
    };
  }),
  setConnectionStatus: (status) => set({ isConnected: status })
}));
