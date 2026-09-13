import { NextRequest, NextResponse } from 'next/server';
import { processRefund } from '@/lib/tools';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, amount } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: order_id', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const result = processRefund(order_id, amount);
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
