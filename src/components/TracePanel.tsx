'use client';

import { TraceEvent, AgentMode } from '@/lib/types';

interface TracePanelProps {
  events: TraceEvent[];
  mode?: AgentMode;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  decision: { icon: '🧠', color: 'var(--info)', label: 'Decision' },
  tool_called: { icon: '🔧', color: 'var(--primary)', label: 'Tool Called' },
  tool_result: { icon: '📋', color: 'var(--primary)', label: 'Tool Result' },
  action_completed: { icon: '✅', color: 'var(--success)', label: 'Action Completed' },
  action_failed: { icon: '❌', color: 'var(--error)', label: 'Action Failed (Blocked)' },
  replanning: { icon: '🔄', color: 'var(--warning)', label: 'Replanning Strategy' },
  state_verification: { icon: '🔍', color: 'var(--accent)', label: 'State Verification' },
  escalation: { icon: '⚠️', color: 'var(--warning)', label: 'Escalation' },
  final_resolution: { icon: '🎯', color: 'var(--success)', label: 'Final Resolution' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label?: string }> = {
  success: { bg: 'rgba(16,185,129,0.15)', text: 'var(--success)', label: 'SUCCESS' },
  failure: { bg: 'rgba(239,68,68,0.25)', text: '#f87171', label: 'FAILED / BLOCKED' },
  info: { bg: 'rgba(99,102,241,0.15)', text: 'var(--info)', label: 'INFO' },
  warning: { bg: 'rgba(245,158,11,0.20)', text: 'var(--warning)', label: 'WARNING' },
  pending: { bg: 'rgba(107,114,128,0.15)', text: 'var(--muted)', label: 'PENDING' },
};

export default function TracePanel({ events, mode = 'groq' }: TracePanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">🔍 Agent Execution Trace</h3>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                mode === 'groq'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : mode === 'mock'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              {mode === 'groq'
                ? '⚡ Groq AI (Live)'
                : mode === 'mock'
                ? '🧪 Mock Simulation'
                : '⚡ Live Agent'}
            </span>
          </div>
          {events.length > 0 && (
            <div className="text-xs px-2 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              Step {events[events.length - 1].step} of {events.length}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--muted)] mt-1">
          {mode === 'groq'
            ? 'Real-time decision and tool-calling events streamed from Groq AI executing backend enterprise tools.'
            : mode === 'mock'
            ? 'Chronological event trace produced by local deterministic test stub calling actual backend tools.'
            : 'Live stream of decision events delivered from external AI Agent service.'}
        </p>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-4xl mb-3">📊</div>
              <p className="text-sm text-[var(--muted)]">No agent trace events yet</p>
              <p className="text-xs text-[var(--muted)] mt-1">Select a scenario and send a message to observe the reasoning pipeline</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, idx) => {
              const config = TYPE_CONFIG[event.type] || { icon: '📌', color: 'var(--muted)', label: event.type };
              const badge = STATUS_BADGE[event.status] || STATUS_BADGE.info;
              const isFailure = event.status === 'failure' || event.type === 'action_failed';
              const isReplanning = event.type === 'replanning';

              return (
                <div
                  key={idx}
                  className={`animate-slide-in rounded-lg p-3 transition-colors border ${
                    isFailure
                      ? 'bg-red-950/20 border-red-500/40 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.1)]'
                      : isReplanning
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                      : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Step number */}
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isFailure ? 'bg-red-500/20 text-red-400' : ''
                      }`}
                      style={{
                        backgroundColor: isFailure ? undefined : `${config.color}22`,
                        color: isFailure ? undefined : config.color,
                      }}
                    >
                      {event.step}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Type label + status badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-semibold flex items-center gap-1"
                          style={{ color: isFailure ? '#f87171' : config.color }}
                        >
                          {config.icon} {config.label}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isFailure ? 'bg-red-900/40 text-red-300 border border-red-500/30' : ''
                          }`}
                          style={{
                            backgroundColor: isFailure ? undefined : badge.bg,
                            color: isFailure ? undefined : badge.text,
                          }}
                        >
                          {badge.label || event.status}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        className={`text-sm mt-1.5 leading-relaxed ${
                          isFailure ? 'text-red-200 font-medium' : 'text-[var(--foreground)]'
                        }`}
                      >
                        {event.description}
                      </p>

                      {/* Tool info */}
                      {event.tool_name && (
                        <div className="mt-2 text-xs flex items-center gap-1.5 flex-wrap">
                          <span className="text-[var(--muted)]">Tool Called:</span>
                          <code className="text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded font-mono text-[11px]">
                            {event.tool_name}
                          </code>
                          {isFailure && (
                            <span className="text-[10px] text-red-400 font-semibold italic">
                              (Returned failure — verified honestly)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tool output inspector (collapsed by default) */}
                      {event.tool_output && (
                        <details className="mt-2 text-xs">
                          <summary className="text-[var(--muted)] cursor-pointer hover:text-white transition-colors">
                            Inspect tool response payload
                          </summary>
                          <pre className="mt-1 text-[11px] text-[var(--muted)] bg-[var(--background)] p-2.5 rounded border border-[var(--border)] overflow-x-auto font-mono">
                            {JSON.stringify(event.tool_output, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Timestamp */}
                      <div className="text-[10px] text-[var(--muted)] mt-1.5 opacity-60">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
