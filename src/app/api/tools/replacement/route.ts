import { NextRequest, NextResponse } from 'next/server';
import { processReplacement } from '@/lib/tools';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, sku } = body;

    if (!order_id || !sku) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: order_id, sku', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const result = processReplacement(order_id, sku);
    return NextResponse.json(
      { success: result.success, data: result.success ? result : undefined, error: result.error, timestamp: new Date().toISOString() },
      { status: result.success ? 200 : 400 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
}
