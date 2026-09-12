// ============================================================
// Agent Integration Adapter
// Cleanly decouples the UI from the AI agent service.
// Switch between Mock Simulation Mode and Live Teammate Agent.
// Easily update this file when your teammate changes their API contract.
// ============================================================

import { TraceEvent, Case } from '@/lib/types';

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
  source: 'mock' | 'live';
  trace: TraceEvent[];
  response: string;
  case?: Case | null;
  error?: string;
}

/**
 * Call either the local Mock Agent simulator or the live external AI Agent service.
 */
export async function callAgentService(
  params: AgentResolveRequest,
  mode: 'mock' | 'live'
): Promise<AgentResolveResponse> {
  if (mode === 'mock') {
    // Call internal mock agent simulator
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
  } else {
    // Call teammate's live agent API
    const agentApiUrl = process.env.NEXT_PUBLIC_AGENT_API_URL;
    if (!agentApiUrl) {
      throw new Error(
        'Live Agent API URL is not configured. Please set NEXT_PUBLIC_AGENT_API_URL in .env.local or Vercel Environment Variables.'
      );
    }

    // Default teammate endpoint convention: POST {AGENT_URL}/resolve
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
}
