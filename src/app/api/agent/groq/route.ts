// ============================================================
// Groq AI Agent API Route
// Executes the Groq autonomous resolution agent on the server.
// The API key is securely accessed from process.env.GROQ_API_KEY.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { runGroqAgent } from '@/lib/groqAgent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, order_id, message, case_id, scenario_id } = body;

    if (!customer_id || !order_id || !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: customer_id, order_id, and message are required.',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check for API key presence
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          source: 'groq',
          error:
            'GROQ_API_KEY is not configured on the server. Please set GROQ_API_KEY in .env.local to enable real Groq AI reasoning, or switch to Mock mode as a fallback.',
          can_fallback: true,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Run the autonomous agent
    const result = await runGroqAgent({
      customerId: customer_id,
      orderId: order_id,
      message,
      caseId: case_id,
      scenarioId: scenario_id,
    });

    return NextResponse.json({
      success: true,
      source: 'groq',
      data: {
        trace: result.trace,
        response: result.response,
        model: result.model,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown Groq agent failure';
    // Ensure the raw API key is never exposed even if an SDK error includes it
    const sanitizedError = errorMessage.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');

    return NextResponse.json(
      {
        success: false,
        source: 'groq',
        error: `Groq Agent Execution Error: ${sanitizedError}`,
        can_fallback: true,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
