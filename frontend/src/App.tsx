import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { OrderBook3D } from './components/OrderBook3D';
import { ExplainabilityPanel } from './components/ExplainabilityPanel';
import { LiveMetrics } from './components/LiveMetrics';
import { SignalCharts } from './components/SignalCharts';
import { AIChatPanel } from './components/AIChatPanel';

function App() {
  const setMarketData = useStore(state => state.setMarketData);
  const setConnectionStatus = useStore(state => state.setConnectionStatus);

  useEffect(() => {
    // In dev mode, Vite proxies this or we just use full URL
    const wsUrl = import.meta.env.VITE_API_WS_URL || 'ws://localhost:8000/ws';
    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Connected to QuantEdge Intelligence Core");
        setConnectionStatus(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'book_update') {
            setMarketData(data);
          }
        } catch (e) {
          console.error("Parse error", e);
        }
      };
      
      ws.onclose = () => {
        console.log("Disconnected. Reconnecting...");
        setConnectionStatus(false);
        setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1800px] mx-auto space-y-6">
        
        <header className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-sm">
              QuantEdge
            </h1>
            <p className="text-slate-400 mt-1 tracking-widest text-xs uppercase font-medium">Adaptive Microstructure Intelligence Platform</p>
          </div>
        </header>

        <LiveMetrics />

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Top/Left Section: 3D Visualization */}
          <div className="lg:col-span-2 xl:col-span-3 h-[500px]">
            <OrderBook3D />
          </div>
          
          {/* Top Right Section: Explainability */}
          <div className="lg:col-span-1 xl:col-span-1 h-[500px]">
            <ExplainabilityPanel />
          </div>

          {/* Bottom Left Section: Time Series */}
          <div className="lg:col-span-2 xl:col-span-2 h-[450px]">
            <SignalCharts />
          </div>
          
          {/* Bottom Right Section: AI Chat */}
          <div className="lg:col-span-1 xl:col-span-2 h-[450px]">
            <AIChatPanel />
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default App;
