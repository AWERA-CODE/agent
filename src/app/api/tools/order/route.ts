import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: order_id', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const result = getOrder(orderId);
  return NextResponse.json(
    { success: result.success, data: result.success ? result : undefined, error: result.error, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 404 }
  );
}
