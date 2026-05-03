import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Bot, Send, User, Loader2, Info } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoningSteps?: string[];
}

export function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { regime, confidence, signals } = useStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          context: {
            regime,
            confidence,
            signals
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: data.response,
        reasoningSteps: data.reasoning_steps
      }]);
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: "Error communicating with the Quant AI model. Ensure backend is running and Mistral API key is set." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-md flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex items-center gap-3">
        <Bot className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-slate-200">QuantEdge Analyst AI</h3>
        <span className="ml-auto text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          Mistral 14-Step Reasoning
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Ask a question about the current market microstructure.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/50">
                <Bot className="w-4 h-4 text-indigo-400" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg p-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-800/80 text-slate-300 border border-slate-700'
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              
              {msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/50">
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      <Info className="w-3 h-3" />
                      View 14-Step Internal Reasoning
                    </summary>
                    <div className="mt-2 space-y-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded max-h-40 overflow-y-auto">
                      {msg.reasoningSteps.map((step, i) => (
                        <div key={i} className="pb-1 border-b border-slate-700/30 last:border-0">{step}</div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/50">
                <User className="w-4 h-4 text-blue-400" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/50">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="bg-slate-800/80 text-slate-300 border border-slate-700 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span className="text-sm">Synthesizing 14-step analysis...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-slate-800/80 border-t border-slate-700/50">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about toxicity, regime shifts, or VWAP..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-white hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
