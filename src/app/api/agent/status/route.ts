// ============================================================
// Agent Configuration Status Route
// Informs frontend whether Groq API key is present on server
// Never exposes or logs the actual secret key value
// ============================================================

import { NextResponse } from 'next/server';
import { GROQ_MODEL } from '@/lib/groqAgent';

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 0);

  return NextResponse.json({
    success: true,
    groq_configured: isConfigured,
    model: GROQ_MODEL,
    default_mode: isConfigured ? 'groq' : 'mock',
    timestamp: new Date().toISOString(),
  });
}
