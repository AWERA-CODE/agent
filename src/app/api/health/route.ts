import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'autonomous-customer-resolution-agent',
  });
}
