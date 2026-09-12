import { NextRequest, NextResponse } from 'next/server';
import { checkInventory } from '@/lib/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');

  if (!sku) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: sku', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const result = checkInventory(sku);
  return NextResponse.json(
    { success: result.success, data: result.success ? result : undefined, error: result.error, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 404 }
  );
}
