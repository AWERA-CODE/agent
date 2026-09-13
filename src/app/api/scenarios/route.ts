import { NextResponse } from 'next/server';

const DEMO_SCENARIOS = [
  {
    id: 'refund',
    name: 'Successful Refund',
    description: 'VIP customer requests a refund for delivered earbuds within the 30-day return window.',
    customer_id: 'CUST-1001',
    order_id: 'ORD-5001',
    message: 'I received my wireless earbuds on order ORD-5001 but they are defective. I would like a full refund please.',
    expected_flow: 'Customer Lookup → Order Check → Policy Check → Refund Processed (+ VIP bonus) → State Verified',
  },
  {
    id: 'cancellation',
    name: 'Successful Cancellation',
    description: 'Customer cancels an active order that is still in PENDING fulfillment status.',
    customer_id: 'CUST-1003',
    order_id: 'ORD-5003',
    message: 'I would like to cancel my gaming keyboard order ORD-5003 before it ships.',
    expected_flow: 'Customer Lookup → Order Check → Policy Check → Order Cancelled → State Verified',
  },
  {
    id: 'oos-replacement',
    name: 'Out-of-Stock Replacement (Mandatory Failure Scenario)',
    description: 'Customer requests replacement for SmartWatch Pro (Silver) on ORD-5004. SKU-SMARTWATCH-PRO-SLV has 0 inventory (restock: 2026-10-15). Replacement fails honestly; agent replans to refund alternative.',
    customer_id: 'CUST-1001',
    order_id: 'ORD-5004',
    target_sku: 'SKU-SMARTWATCH-PRO-SLV',
    message: 'My SmartWatch Pro (Silver) on order ORD-5004 has a display defect. Can I get a replacement unit sent to me?',
    expected_flow: 'Customer Lookup → Order Check (ORD-5004) → Eligibility Check → Inventory Check (SKU-SMARTWATCH-PRO-SLV = 0) → Replacement BLOCKED → Replanning → Alternative Refund Executed → State Verified',
  },
  {
    id: 'policy-blocked',
    name: 'Policy-Blocked Escalation',
    description: 'Customer tries to cancel a DELIVERED order (ORD-5002) — policy blocks cancellation of delivered orders, case escalates to human.',
    customer_id: 'CUST-1002',
    order_id: 'ORD-5002',
    message: 'Please cancel my delivered USB-C cable order ORD-5002 immediately and give me a refund.',
    expected_flow: 'Customer Lookup → Order Check (ORD-5002) → Policy Check (Cancellation blocked for DELIVERED) → Escalation to Human Agent',
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: { scenarios: DEMO_SCENARIOS },
    timestamp: new Date().toISOString(),
  });
}
