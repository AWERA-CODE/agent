import { NextRequest, NextResponse } from 'next/server';
import { getCustomer, getCustomerOrders } from '@/lib/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customer_id');

  if (!customerId) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: customer_id', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const result = getCustomer(customerId);
  return NextResponse.json(
    { success: result.success, data: result.success ? result : undefined, error: result.error, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 404 }
  );
}
