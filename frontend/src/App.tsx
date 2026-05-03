import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { OrderBook3D } from './components/OrderBook3D';
import { ExplainabilityPanel } from './components/ExplainabilityPanel';
import { LiveMetrics } from './components/LiveMetrics';
import { SignalCharts } from './components/SignalCharts';
import { AIChatPanel } from './components/AIChatPanel';

/**
 * App Layout (full-viewport, zero scroll):
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  HEADER: logo · live metrics · tag                      │  ~52px
 *  ├───────────────────────────────────────┬─────────────────┤
 *  │                                       │                 │
 *  │        3D ORDER BOOK                  │  INTELLIGENCE   │
 *  │     (instanced depth surface,         │  CORE           │
 *  │      particles, dynamic lights)       │  (regime, MCS,  │
 *  │                                       │   prob bars)    │
 *  ├───────────────────────────────────────┤                 │
 *  │   SIGNAL CHARTS                       ├─────────────────┤
 *  │   (OBI / VPIN / VWAP area charts)    │  AI CHAT        │
 *  │                                       │  (Mistral 14-   │
 *  │                                       │   step CoT)     │
 *  └───────────────────────────────────────┴─────────────────┘
 */
function App() {
  const setMarketData      = useStore(s => s.setMarketData);
  const setConnectionStatus = useStore(s => s.setConnectionStatus);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_WS_URL || 'ws://localhost:8000/ws';
    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen    = () => setConnectionStatus(true);
      ws.onmessage = ({ data }) => {
        try {
          const d = JSON.parse(data);
          if (d.type === 'book_update') setMarketData(d);
        } catch {}
      };
      ws.onclose = () => {
        setConnectionStatus(false);
        setTimeout(connect, 2000);
      };
    };

    connect();
    return () => ws?.close();
  }, []);

  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(160deg,#020617 0%,#040a15 60%,#020617 100%)',
        fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
      }}
    >
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center justify-between px-5"
        style={{
          height: 52,
          borderBottom: '1px solid rgba(148,163,184,0.06)',
          background: 'rgba(2,6,23,0.75)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg,#3B82F6,#7C3AED)',
              boxShadow: '0 0 14px #3B82F650',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="leading-none">
            <h1
              className="text-[15px] font-black tracking-tight"
              style={{
                background: 'linear-gradient(90deg,#60A5FA,#818CF8,#A78BFA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              QuantEdge
            </h1>
            <p className="text-[8px] text-slate-600 tracking-[0.22em] uppercase mt-0.5">
              Microstructure Intelligence
            </p>
          </div>
        </div>

        {/* Live metrics — centre */}
        <div className="flex-1 flex justify-center">
          <LiveMetrics />
        </div>

        {/* Badge */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase shrink-0"
          style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.22)',
            color: '#818CF8',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          C++ · Level III
        </div>
      </header>

      {/* ─── CONTENT GRID ───────────────────────────────────────────── */}
      {/*
       * Left column  (flex-1): 3D (60%) + Charts (40%) stacked vertically
       * Right column (380px) : Intelligence Core (50%) + AI Chat (50%)
       */}
      <div className="flex-1 overflow-hidden flex gap-2.5 p-2.5">

        {/* LEFT COLUMN */}
        <div className="flex-1 overflow-hidden flex flex-col gap-2.5 min-w-0">
          {/* 3D — 60% height */}
          <div className="overflow-hidden rounded-xl" style={{ flex: '0 0 60%' }}>
            <OrderBook3D />
          </div>
          {/* Charts — 40% height */}
          <div className="overflow-hidden rounded-xl" style={{ flex: '1 1 0' }}>
            <SignalCharts />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div
          className="overflow-hidden flex flex-col gap-2.5 shrink-0"
          style={{ width: 360 }}
        >
          {/* Intelligence Core — 45% height */}
          <div className="overflow-hidden rounded-xl" style={{ flex: '0 0 45%' }}>
            <ExplainabilityPanel />
          </div>
          {/* AI Chat — rest */}
          <div className="overflow-hidden rounded-xl" style={{ flex: '1 1 0' }}>
            <AIChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
