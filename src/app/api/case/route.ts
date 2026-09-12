import { NextRequest, NextResponse } from 'next/server';
import { createCase, getCase, listCases } from '@/lib/cases';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, order_id, issue_description } = body;

    if (!customer_id || !order_id || !issue_description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: customer_id, order_id, issue_description',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const newCase = createCase(customer_id, order_id, issue_description);
    return NextResponse.json({
      success: true,
      data: newCase,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get('case_id');

  if (caseId) {
    const caseData = getCase(caseId);
    if (!caseData) {
      return NextResponse.json(
        { success: false, error: `Case '${caseId}' not found.`, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: caseData,
      timestamp: new Date().toISOString(),
    });
  }

  // List all cases
  return NextResponse.json({
    success: true,
    data: { cases: listCases() },
    timestamp: new Date().toISOString(),
  });
}
