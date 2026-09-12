import { NextRequest, NextResponse } from 'next/server';
import { checkPolicy } from '@/lib/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('order_id');
  const action = searchParams.get('action');

  if (!orderId || !action) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters: order_id, action', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const result = checkPolicy(orderId, action);
  return NextResponse.json(
    { success: result.success, data: result.success ? result : undefined, error: result.error, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 403 }
  );
}
