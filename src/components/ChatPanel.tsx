'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, DemoScenario } from '@/lib/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isProcessing: boolean;
  selectedScenario: DemoScenario | null;
  onToggleSidebar: () => void;
  agentMode?: 'mock' | 'live';
}

export default function ChatPanel({
  messages,
  onSendMessage,
  isProcessing,
  selectedScenario,
  onToggleSidebar,
  agentMode = 'mock',
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    onSendMessage(text);
  };

  const handleQuickSend = () => {
    if (selectedScenario && !isProcessing) {
      onSendMessage(selectedScenario.message);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const hasError = lastMessage?.role === 'system' && lastMessage.content.toLowerCase().includes('error');

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-white transition-colors"
            title="Toggle Sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Customer Support Chat</h2>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                  agentMode === 'mock'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {agentMode === 'mock' ? 'Mock Mode' : 'Live Agent'}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] truncate max-w-md">
              {selectedScenario ? `Active: ${selectedScenario.name}` : 'Select a preset scenario from the sidebar'}
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--primary)] animate-pulse">
            <div className="w-2 h-2 bg-[var(--primary)] rounded-full" />
            Agent reasoning...
          </div>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md p-6 bg-[var(--card)] rounded-2xl border border-[var(--border)]">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-base font-semibold text-white mb-2">Autonomous Support Agent</h3>
              <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
                Test automated resolutions, policy constraints, and the mandatory out-of-stock replanning scenario using actual simulated backend enterprise tools.
              </p>
              {selectedScenario && (
                <button
                  onClick={handleQuickSend}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
                >
                  ▶ Launch Scenario: {selectedScenario.name}
                </button>
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`animate-fade-in flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--primary)] text-white rounded-br-sm'
                  : msg.role === 'agent'
                  ? 'bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-sm shadow-sm'
                  : 'bg-red-950/20 text-red-300 rounded-bl-sm border border-red-500/30'
              }`}
            >
              {msg.role === 'agent' && (
                <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-[var(--border)]/50">
                  <span className="text-xs font-bold text-[var(--primary)]">
                    {agentMode === 'mock' ? '🤖 Mock Agent (Simulation Stub)' : '🤖 AI Agent (Live Service)'}
                  </span>
                </div>
              )}
              {msg.role === 'system' && (
                <div className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
                  <span>⚙️ System Notification</span>
                </div>
              )}
              {msg.content}
              <div className="text-[10px] text-[var(--muted)] mt-2 text-right opacity-60">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-[var(--card)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="text-xs text-[var(--primary)] font-semibold mb-1">
                {agentMode === 'mock' ? '🤖 Mock Agent' : '🤖 AI Agent'}
              </div>
              <div className="loading-dots flex gap-1.5 py-1">
                <span className="w-2 h-2 bg-[var(--primary)] rounded-full inline-block animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-[var(--primary)] rounded-full inline-block animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-[var(--primary)] rounded-full inline-block animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Run / Retry Bar */}
      {selectedScenario && messages.length > 0 && !isProcessing && (
        <div className="px-4 pb-2 flex gap-2">
          <button
            onClick={handleQuickSend}
            className="flex-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs text-[var(--muted)] hover:text-white hover:border-[var(--primary)] transition-colors text-left flex items-center justify-between"
          >
            <span className="truncate">▶ Re-run: &quot;{selectedScenario.message}&quot;</span>
            <span className="text-[10px] text-[var(--primary)] font-semibold ml-2 shrink-0">Click to run</span>
          </button>
          {hasError && (
            <button
              onClick={handleQuickSend}
              className="px-3 py-2 bg-red-900/30 text-red-200 border border-red-500/40 rounded-lg text-xs font-semibold hover:bg-red-900/50 transition-colors"
            >
              🔄 Retry
            </button>
          )}
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedScenario
                ? 'Type custom customer issue or press ▶ above...'
                : 'Select a demo scenario from the left to start...'
            }
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
