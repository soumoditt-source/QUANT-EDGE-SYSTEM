import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Bot, Send, User, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoningSteps?: string[];
  error?: boolean;
}

const SUGGESTIONS = [
  'Explain the current VPIN toxicity level',
  "What's the Order Book Imbalance telling us?",
  'Is this a good regime for momentum strategies?',
  'Interpret the current microstructure confidence',
];

export function AIChatPanel() {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input,    setInput]        = useState('');
  const [loading,  setLoading]      = useState(false);
  const [openStep, setOpenStep]     = useState<number | null>(null);
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { regime, confidence, signals } = useStore();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (query: string) => {
    if (!query.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res  = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: { regime, confidence, signals },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || data.error || 'No response received.',
        reasoningSteps: data.reasoning_steps ?? [],
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ Unable to reach backend. Is MISTRAL_API_KEY set and the server running?\n\n${err.message}`,
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, regime, confidence, signals]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden rounded-xl"
      style={{
        background: 'linear-gradient(145deg,#030d1c 0%,#050f1e 100%)',
        border: '1px solid rgba(148,163,184,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-300 leading-none">QuantEdge Analyst</p>
          <p className="text-[8px] text-slate-600 tracking-widest mt-0.5">Mistral · 14-Step Chain-of-Thought</p>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider uppercase"
          style={{ background: 'rgba(16,217,148,0.1)', border: '1px solid rgba(16,217,148,0.2)', color: '#10D994' }}
        >
          AI
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-[10px] text-slate-600 text-center leading-relaxed max-w-[200px]">
              Ask anything about the current market microstructure
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
              >
                <Bot className="w-3 h-3 text-indigo-400" />
              </div>
            )}

            <div
              className="max-w-[82%] rounded-xl px-3 py-2.5"
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg,#1D4ED8,#4338CA)',
                boxShadow: '0 0 12px rgba(59,130,246,0.2)',
              } : {
                background: msg.error ? 'rgba(127,29,29,0.3)' : 'rgba(15,23,42,0.8)',
                border: `1px solid ${msg.error ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.07)'}`,
              }}
            >
              <p className="text-[11px] leading-relaxed whitespace-pre-wrap"
                style={{ color: msg.role === 'user' ? '#EFF6FF' : '#CBD5E1' }}>
                {msg.content}
              </p>

              {/* Reasoning accordion */}
              {msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                  <button
                    onClick={() => setOpenStep(openStep === idx ? null : idx)}
                    className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span className="text-[8px] font-bold tracking-widest uppercase">
                      View {msg.reasoningSteps.length}-Step Internal Reasoning
                    </span>
                    {openStep === idx
                      ? <ChevronUp className="w-2.5 h-2.5" />
                      : <ChevronDown className="w-2.5 h-2.5" />
                    }
                  </button>
                  {openStep === idx && (
                    <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                      {msg.reasoningSteps.map((step, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-[8px] font-mono text-slate-600 shrink-0 mt-0.5">{String(i+1).padStart(2,'0')}</span>
                          <p className="text-[9px] text-slate-500 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}
              >
                <User className="w-3 h-3 text-blue-400" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <Bot className="w-3 h-3 text-indigo-400" />
            </div>
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.07)' }}>
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="text-[10px] text-slate-500">Synthesizing 14-step analysis…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions (only when empty) */}
      {messages.length === 0 && (
        <div className="shrink-0 px-3 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              disabled={loading}
              className="text-[9px] rounded-full px-2.5 py-1 transition-all hover:scale-105"
              style={{
                background: 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(148,163,184,0.1)',
                color: '#64748B',
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)';
                (e.target as HTMLElement).style.color = '#818CF8';
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.borderColor = 'rgba(148,163,184,0.1)';
                (e.target as HTMLElement).style.color = '#64748B';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="shrink-0 px-3 pb-3"
      >
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
          style={{
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.1)',
          }}
          onFocus={() => {}}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about toxicity, regimes, VWAP…"
            disabled={loading}
            className="flex-1 bg-transparent text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: 'rgba(99,102,241,0.8)' }}
          >
            {loading
              ? <Loader2 className="w-3 h-3 text-white animate-spin" />
              : <Send className="w-3 h-3 text-white" />
            }
          </button>
        </div>
      </form>
    </div>
  );
}
