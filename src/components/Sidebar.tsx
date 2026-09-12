'use client';

import { DemoScenario } from '@/lib/types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  scenarios: DemoScenario[];
  selectedScenario: DemoScenario | null;
  onSelectScenario: (scenario: DemoScenario) => void;
  agentMode: 'mock' | 'live';
  onSetAgentMode: (mode: 'mock' | 'live') => void;
  onReset: () => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  scenarios,
  selectedScenario,
  onSelectScenario,
  agentMode,
  onSetAgentMode,
  onReset,
}: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-xs"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed lg:relative z-40 h-full bg-[var(--card)] border-r border-[var(--border)] transition-all duration-300 flex flex-col ${
          isOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'
        } overflow-hidden shadow-xl lg:shadow-none`}
      >
        <div className="min-w-[320px] h-full flex flex-col">
          {/* Brand Header */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🤖</span>
                  <span>Resolution Agent</span>
                </h1>
                <p className="text-xs text-[var(--muted)] mt-0.5">Autonomous Customer Resolution System</p>
              </div>
              <button
                onClick={onToggle}
                className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background)]/30">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Agent Execution Mode
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSetAgentMode('mock')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  agentMode === 'mock'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                🧪 Mock Simulation
              </button>
              <button
                onClick={() => onSetAgentMode('live')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  agentMode === 'live'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-white'
                }`}
              >
                ⚡ Live Teammate
              </button>
            </div>
            <div className="mt-2 p-2 rounded-md bg-[var(--card)] border border-[var(--border)] text-[11px] text-[var(--muted)] leading-relaxed">
              {agentMode === 'mock' ? (
                <>
                  <strong className="text-amber-400">Mock Mode Active:</strong> Uses local deterministic test stub that executes actual backend tools. No external LLM required.
                </>
              ) : (
                <>
                  <strong className="text-emerald-400">Live Mode Active:</strong> Proxies requests to external agent orchestration service via <code className="text-[10px] text-emerald-300">NEXT_PUBLIC_AGENT_API_URL</code>.
                </>
              )}
            </div>
          </div>

          {/* Demo Scenarios */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between pb-1">
              <label className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Demo Test Scenarios
              </label>
              <span className="text-[10px] text-[var(--muted)]">{scenarios.length} available</span>
            </div>

            {scenarios.map((scenario) => {
              const isSelected = selectedScenario?.id === scenario.id;
              const isOos = scenario.id === 'oos-replacement';
              return (
                <button
                  key={scenario.id}
                  onClick={() => onSelectScenario(scenario)}
                  className={`w-full text-left p-3 rounded-xl transition-all border text-xs ${
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-white shadow-sm ring-1 ring-[var(--primary)]/30'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--muted)] hover:bg-[var(--card-hover)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-white truncate">{scenario.name}</span>
                    {isOos && (
                      <span className="text-[9px] bg-red-950/60 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-mono shrink-0">
                        Mandatory
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                    {scenario.description}
                  </p>
                  <div className="mt-2 pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-[10px] text-[var(--muted)] font-mono">
                    <span>{scenario.customer_id}</span>
                    <span>{scenario.order_id}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Persistence & Reset Footer */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--card)] space-y-2">
            <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span>Persistence Store:</span>
              <span className="text-amber-400 font-medium">In-Memory Demo</span>
            </div>
            <button
              onClick={onReset}
              className="w-full px-3 py-2 bg-[var(--card-hover)] hover:bg-red-950/30 hover:border-red-500/40 text-[var(--muted)] hover:text-red-300 rounded-lg text-xs font-semibold transition-all border border-[var(--border)] flex items-center justify-center gap-1.5"
            >
              <span>🔄</span>
              <span>Reset World State</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
