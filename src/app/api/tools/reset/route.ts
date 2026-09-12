import { NextResponse } from 'next/server';
import { resetWorld } from '@/lib/tools';

export async function POST() {
  const result = resetWorld();
  return NextResponse.json(
    { success: result.success, data: result, timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
