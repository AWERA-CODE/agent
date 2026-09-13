// ============================================================
// Agent Integration Adapter
// Decouples the UI from the AI agent execution engine.
// Supports:
// 1. 'groq' - Live Groq AI Agent (Llama 3.3 with tool calling)
// 2. 'mock' - Deterministic Mock Simulation fallback
// 3. 'live' - External custom agent endpoint (teammate service)
// ============================================================

import { TraceEvent, Case, AgentMode } from '@/lib/types';

export interface AgentResolveRequest {
  case_id?: string;
  customer_id: string;
  order_id: string;
  message: string;
  scenario_id?: string;
  target_sku?: string;
}

export interface AgentResolveResponse {
  success: boolean;
  source: 'groq' | 'mock' | 'live';
  trace: TraceEvent[];
  response: string;
  case?: Case | null;
  error?: string;
}

/**
 * Call the selected agent service (Groq AI, Mock Simulation, or External Agent).
 */
export async function callAgentService(
  params: AgentResolveRequest,
  mode: AgentMode
): Promise<AgentResolveResponse> {
  // 1. Groq AI Mode (Primary live agent)
  if (mode === 'groq') {
    try {
      const res = await fetch('/api/agent/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          source: 'groq',
          trace: data.data?.trace || [],
          response: data.error || 'Groq agent failed to process request.',
          error: data.error || 'Failed to complete Groq request.',
        };
      }

      return {
        success: true,
        source: 'groq',
        trace: data.data.trace || [],
        response: data.data.response || '',
        case: data.data.case || null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error reaching Groq endpoint';
      return {
        success: false,
        source: 'groq',
        trace: [],
        response: `Groq Agent Communication Error: ${msg}`,
        error: msg,
      };
    }
  }

  // 2. Mock Simulation Mode (Deterministic offline fallback)
  if (mode === 'mock') {
    const res = await fetch('/api/agent/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        source: 'mock',
        trace: data.data?.trace || [],
        response: data.error || 'Mock agent failed to process request.',
        error: data.error,
      };
    }

    return {
      success: true,
      source: 'mock',
      trace: data.data.trace,
      response: data.data.response,
      case: data.data.case,
    };
  }

  // 3. External Teammate Live Mode
  const agentApiUrl = process.env.NEXT_PUBLIC_AGENT_API_URL;
  if (!agentApiUrl) {
    throw new Error(
      'Live Agent API URL is not configured. Please set NEXT_PUBLIC_AGENT_API_URL in .env.local or Vercel Environment Variables.'
    );
  }

  const targetUrl = agentApiUrl.endsWith('/')
    ? `${agentApiUrl}resolve`
    : `${agentApiUrl}/resolve`;

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      case_id: params.case_id,
      customer_id: params.customer_id,
      order_id: params.order_id,
      message: params.message,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Live Agent returned HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    success: true,
    source: 'live',
    trace: data.trace || [],
    response: data.response || 'Agent completed processing.',
    case: data.case || null,
  };
}
