// ============================================================
// Mock Agent Endpoint (Developer Simulation Stub)
// Simulates the AI agent's reasoning, tool calling, and replanning
// for development and hackathon demonstration.
//
// NOTE: This is clearly labeled as MOCK MODE. When the teammate's
// live AI agent is connected, the frontend switches to LIVE MODE
// and routes through `src/lib/agentAdapter.ts`.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomer,
  getOrder,
  checkInventory,
  checkPolicy,
  processRefund,
  processReplacement,
  cancelOrder,
  verifyState,
} from '@/lib/tools';
import { updateCase } from '@/lib/cases';
import { TraceEvent, Case } from '@/lib/types';

function ts(): string {
  return new Date().toISOString();
}

function buildTrace(events: Omit<TraceEvent, 'step'>[]): TraceEvent[] {
  return events.map((e, i) => ({
    ...e,
    step: i + 1,
    metadata: {
      ...e.metadata,
      is_mock: true,
      mode: 'mock_simulation',
      note: 'Simulated developer trace event for frontend verification',
    },
  }));
}

// ---- Scenario Handlers ----

function handleRefundScenario(customerId: string, orderId: string) {
  const trace: Omit<TraceEvent, 'step'>[] = [];

  // Step 1: Decision
  trace.push({
    type: 'decision',
    description: '[MOCK AGENT] Customer requests a refund for their delivered order. Step 1: Look up customer profile and order details.',
    status: 'info',
    timestamp: ts(),
  });

  // Step 2: Get customer
  const custResult = getCustomer(customerId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_customer("${customerId}")`,
    status: custResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_customer',
    tool_input: { customer_id: customerId },
    tool_output: custResult as Record<string, unknown>,
  });

  // Step 3: Get order
  const orderResult = getOrder(orderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_order("${orderId}")`,
    status: orderResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_order',
    tool_input: { order_id: orderId },
    tool_output: orderResult as Record<string, unknown>,
  });

  // Step 4: Check refund policy
  const policyResult = checkPolicy(orderId, 'REFUND');
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling check_policy("${orderId}", "REFUND")`,
    status: policyResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'check_policy',
    tool_input: { order_id: orderId, action: 'REFUND' },
    tool_output: policyResult as Record<string, unknown>,
  });

  if (!policyResult.success) {
    trace.push({
      type: 'action_failed',
      description: `[MOCK AGENT] Refund blocked by policy: ${policyResult.error}`,
      status: 'failure',
      timestamp: ts(),
    });
    return {
      trace: buildTrace(trace),
      response: `I'm sorry, but your refund cannot be processed under company policy: ${policyResult.error}`,
      status: 'failed' as const,
    };
  }

  // Step 5: Process refund
  const refundResult = processRefund(orderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling process_refund("${orderId}")`,
    status: refundResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'process_refund',
    tool_input: { order_id: orderId },
    tool_output: refundResult as Record<string, unknown>,
  });

  trace.push({
    type: 'action_completed',
    description: `[MOCK AGENT] Refund completed: ${refundResult.message}`,
    status: 'success',
    timestamp: ts(),
  });

  // Step 6: Verify final state
  const verifyResult = verifyState(orderId);
  trace.push({
    type: 'state_verification',
    description: `[MOCK AGENT] Calling verify_state("${orderId}") -> resolution_state: ${verifyResult.resolution_state}, is_resolved: ${verifyResult.is_resolved}`,
    status: 'success',
    timestamp: ts(),
    tool_name: 'verify_state',
    tool_input: { order_id: orderId },
    tool_output: verifyResult as Record<string, unknown>,
  });

  // Step 7: Final resolution
  trace.push({
    type: 'final_resolution',
    description: `[MOCK AGENT] Full refund of $${refundResult.refund_amount} successfully processed.${
      refundResult.vip_bonus_credit ? ` VIP bonus credit: $${refundResult.vip_bonus_credit}.` : ''
    }`,
    status: 'success',
    timestamp: ts(),
  });

  return {
    trace: buildTrace(trace),
    response: `Your refund has been successfully processed!\n\n• Order ID: ${orderId}\n• Refund Amount: $${refundResult.refund_amount}\n${
      refundResult.vip_bonus_credit ? `• VIP Bonus Credit: $${refundResult.vip_bonus_credit} (10% VIP perk)\n• Total Credited: $${refundResult.total_credited}\n` : ''
    }• Payment Method: ${refundResult.payment_method}\n\nPlease allow 3-5 business days for the funds to reflect in your account.`,
    status: 'resolved' as const,
  };
}

function handleCancellationScenario(customerId: string, orderId: string) {
  const trace: Omit<TraceEvent, 'step'>[] = [];

  trace.push({
    type: 'decision',
    description: '[MOCK AGENT] Customer requested order cancellation. Step 1: Verify customer profile and order status.',
    status: 'info',
    timestamp: ts(),
  });

  const custResult = getCustomer(customerId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_customer("${customerId}")`,
    status: custResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_customer',
    tool_input: { customer_id: customerId },
    tool_output: custResult as Record<string, unknown>,
  });

  const orderResult = getOrder(orderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_order("${orderId}")`,
    status: orderResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_order',
    tool_input: { order_id: orderId },
    tool_output: orderResult as Record<string, unknown>,
  });

  const policyResult = checkPolicy(orderId, 'CANCEL');
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling check_policy("${orderId}", "CANCEL")`,
    status: policyResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'check_policy',
    tool_input: { order_id: orderId, action: 'CANCEL' },
    tool_output: policyResult as Record<string, unknown>,
  });

  if (!policyResult.success) {
    trace.push({
      type: 'action_failed',
      description: `[MOCK AGENT] Cancellation blocked: ${policyResult.error}`,
      status: 'failure',
      timestamp: ts(),
    });
    return {
      trace: buildTrace(trace),
      response: `I cannot cancel this order: ${policyResult.error}`,
      status: 'failed' as const,
    };
  }

  const cancelResult = cancelOrder(orderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling cancel_order("${orderId}")`,
    status: cancelResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'cancel_order',
    tool_input: { order_id: orderId },
    tool_output: cancelResult as Record<string, unknown>,
  });

  trace.push({
    type: 'action_completed',
    description: `[MOCK AGENT] Cancellation completed: ${cancelResult.message}`,
    status: 'success',
    timestamp: ts(),
  });

  const verifyResult = verifyState(orderId);
  trace.push({
    type: 'state_verification',
    description: `[MOCK AGENT] Calling verify_state("${orderId}") -> status: ${verifyResult.status}, resolution_state: ${verifyResult.resolution_state}`,
    status: 'success',
    timestamp: ts(),
    tool_name: 'verify_state',
    tool_input: { order_id: orderId },
    tool_output: verifyResult as Record<string, unknown>,
  });

  trace.push({
    type: 'final_resolution',
    description: `[MOCK AGENT] Order ${orderId} cancelled before shipment. Full refund of $${cancelResult.refund_amount} processed.`,
    status: 'success',
    timestamp: ts(),
  });

  return {
    trace: buildTrace(trace),
    response: `Your order ${orderId} has been successfully cancelled!\n\n• Order ID: ${orderId}\n• Status: CANCELLED\n• Refund Amount: $${cancelResult.refund_amount}\n• Credited to: ${cancelResult.payment_method}\n\nYour refund will be returned to your original payment method.`,
    status: 'resolved' as const,
  };
}

/**
 * Mandatory Failure Scenario:
 * Uses order `ORD-5004` and SKU `SKU-SMARTWATCH-PRO-SLV`, quantity `0`, restock `2026-10-15`.
 * Sequence:
 * 1. Retrieve customer and order.
 * 2. Check replacement eligibility.
 * 3. Check inventory (stock is 0).
 * 4. Attempt replacement.
 * 5. Return structured failure when unavailable (FAIL HONESTLY).
 * 6. Allow agent to inspect failure.
 * 7. Allow agent to select alternative resolution.
 * 8. Execute permitted alternative (refund).
 * 9. Verify resulting order state.
 */
function handleOosReplacementScenario(customerId: string, orderId: string) {
  const trace: Omit<TraceEvent, 'step'>[] = [];
  // Mandatory specified order and SKU:
  const targetOrderId = orderId || 'ORD-5004';
  const targetCustomerId = customerId || 'CUST-1001';
  const targetSku = 'SKU-SMARTWATCH-PRO-SLV';

  // 1. Retrieve customer and order
  trace.push({
    type: 'decision',
    description: `[MOCK AGENT] Customer reports screen issue with SmartWatch Pro (Silver) on order ${targetOrderId} and requests a replacement. Step 1: Look up customer and order details.`,
    status: 'info',
    timestamp: ts(),
  });

  const custResult = getCustomer(targetCustomerId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_customer("${targetCustomerId}")`,
    status: custResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_customer',
    tool_input: { customer_id: targetCustomerId },
    tool_output: custResult as Record<string, unknown>,
  });

  const orderResult = getOrder(targetOrderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_order("${targetOrderId}")`,
    status: orderResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_order',
    tool_input: { order_id: targetOrderId },
    tool_output: orderResult as Record<string, unknown>,
  });

  // 2. Check replacement eligibility
  const policyResult = checkPolicy(targetOrderId, 'REPLACEMENT');
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling check_policy("${targetOrderId}", "REPLACEMENT") -> ${policyResult.reason || 'Checking window'}`,
    status: policyResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'check_policy',
    tool_input: { order_id: targetOrderId, action: 'REPLACEMENT' },
    tool_output: policyResult as Record<string, unknown>,
  });

  // 3. Check inventory
  const invResult = checkInventory(targetSku);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling check_inventory("${targetSku}") -> in_stock: ${invResult.in_stock} (quantity: ${invResult.quantity_available}, restock: ${invResult.restock_date})`,
    status: 'warning',
    timestamp: ts(),
    tool_name: 'check_inventory',
    tool_input: { sku: targetSku },
    tool_output: invResult as Record<string, unknown>,
  });

  // 4. Attempt the replacement
  const replaceResult = processReplacement(targetOrderId, targetSku);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling process_replacement("${targetOrderId}", "${targetSku}")`,
    status: 'failure',
    timestamp: ts(),
    tool_name: 'process_replacement',
    tool_input: { order_id: targetOrderId, sku: targetSku },
    tool_output: replaceResult as Record<string, unknown>,
  });

  // 5. Structured failure logged honestly (NEVER reported as success)
  trace.push({
    type: 'action_failed',
    description: `[MOCK AGENT] Replacement blocked: ${replaceResult.error} Restock scheduled for ${replaceResult.restock_date}.`,
    status: 'failure',
    timestamp: ts(),
  });

  // 6 & 7. Allow agent to inspect failure and replan
  trace.push({
    type: 'replanning',
    description: `[MOCK AGENT] REPLANNING TRIGGERED: Requested SKU '${targetSku}' is out of stock until 2026-10-15. Inspecting alternative resolution: policy allows a full refund ($249.99). Formulating new plan.`,
    status: 'warning',
    timestamp: ts(),
  });

  trace.push({
    type: 'decision',
    description: `[MOCK AGENT] Alternative plan selected: Process a full refund for ${targetOrderId} under the 30-day return policy, with VIP bonus credit.`,
    status: 'info',
    timestamp: ts(),
  });

  // 8. Execute the permitted alternative (refund)
  const refundPolicyResult = checkPolicy(targetOrderId, 'REFUND');
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Verifying policy for alternative: check_policy("${targetOrderId}", "REFUND")`,
    status: refundPolicyResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'check_policy',
    tool_input: { order_id: targetOrderId, action: 'REFUND' },
    tool_output: refundPolicyResult as Record<string, unknown>,
  });

  const refundResult = processRefund(targetOrderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling process_refund("${targetOrderId}") as alternative resolution`,
    status: refundResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'process_refund',
    tool_input: { order_id: targetOrderId },
    tool_output: refundResult as Record<string, unknown>,
  });

  trace.push({
    type: 'action_completed',
    description: `[MOCK AGENT] Alternative resolution executed: ${refundResult.message}`,
    status: 'success',
    timestamp: ts(),
  });

  // 9. Verify resulting order state
  const verifyResult = verifyState(targetOrderId);
  trace.push({
    type: 'state_verification',
    description: `[MOCK AGENT] Calling verify_state("${targetOrderId}") -> status: ${verifyResult.status}, resolution_state: ${verifyResult.resolution_state}, is_resolved: ${verifyResult.is_resolved}`,
    status: 'success',
    timestamp: ts(),
    tool_name: 'verify_state',
    tool_input: { order_id: targetOrderId },
    tool_output: verifyResult as Record<string, unknown>,
  });

  // Final resolution
  trace.push({
    type: 'final_resolution',
    description: `[MOCK AGENT] Resolved: Replacement could not be fulfilled due to zero inventory (restock: 2026-10-15). Alternative full refund of $${refundResult.refund_amount} successfully processed with VIP bonus credit of $${refundResult.vip_bonus_credit}.`,
    status: 'success',
    timestamp: ts(),
  });

  return {
    trace: buildTrace(trace),
    response: `I checked on your replacement request for the SmartWatch Pro (Silver) on order ${targetOrderId}.\n\nUnfortunately, SKU ${targetSku} is currently completely out of stock (0 units available), with our next restock date estimated for October 15, 2026.\n\nRather than keeping you waiting, I have automatically processed a full refund for your purchase:\n\n• Order ID: ${targetOrderId}\n• Refunded Amount: $${refundResult.refund_amount}\n${
      refundResult.vip_bonus_credit ? `• VIP Bonus Credit: $${refundResult.vip_bonus_credit} (10% VIP bonus)\n• Total Credited: $${refundResult.total_credited}\n` : ''
    }• Payment Method: ${refundResult.payment_method}\n\nYou will see this refund in your account within 3-5 business days. Once the item is back in stock in October, we welcome you to place a new order!`,
    status: 'resolved' as const,
  };
}

function handlePolicyBlockedScenario(customerId: string, orderId: string) {
  const trace: Omit<TraceEvent, 'step'>[] = [];
  const targetOrderId = orderId || 'ORD-5002';
  const targetCustomerId = customerId || 'CUST-1002';

  trace.push({
    type: 'decision',
    description: `[MOCK AGENT] Customer requests cancellation for order ${targetOrderId}. Step 1: Look up order and evaluate cancellation policy.`,
    status: 'info',
    timestamp: ts(),
  });

  const custResult = getCustomer(targetCustomerId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_customer("${targetCustomerId}")`,
    status: custResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_customer',
    tool_input: { customer_id: targetCustomerId },
    tool_output: custResult as Record<string, unknown>,
  });

  const orderResult = getOrder(targetOrderId);
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling get_order("${targetOrderId}") -> status: ${(orderResult.order as { status: string })?.status}`,
    status: orderResult.success ? 'success' : 'failure',
    timestamp: ts(),
    tool_name: 'get_order',
    tool_input: { order_id: targetOrderId },
    tool_output: orderResult as Record<string, unknown>,
  });

  // Check policy - will fail because ORD-5002 is DELIVERED
  const policyResult = checkPolicy(targetOrderId, 'CANCEL');
  trace.push({
    type: 'tool_called',
    description: `[MOCK AGENT] Calling check_policy("${targetOrderId}", "CANCEL")`,
    status: 'failure',
    timestamp: ts(),
    tool_name: 'check_policy',
    tool_input: { order_id: targetOrderId, action: 'CANCEL' },
    tool_output: policyResult as Record<string, unknown>,
  });

  trace.push({
    type: 'action_failed',
    description: `[MOCK AGENT] Cancellation BLOCKED by policy: ${policyResult.error}`,
    status: 'failure',
    timestamp: ts(),
  });

  // Escalation event
  trace.push({
    type: 'escalation',
    description: `[MOCK AGENT] Action is blocked by enterprise policy and no automated self-service alternative is available. Escalating case to Tier 2 Human Support.`,
    status: 'warning',
    timestamp: ts(),
    metadata: {
      escalation_reason: 'Cancellation requested on delivered item exceeding automated policy rules',
      order_id: targetOrderId,
      customer_id: targetCustomerId,
    },
  });

  trace.push({
    type: 'final_resolution',
    description: `[MOCK AGENT] Case escalated to human support team. A customer service specialist will review within 24 hours.`,
    status: 'warning',
    timestamp: ts(),
  });

  return {
    trace: buildTrace(trace),
    response: `I understand you would like to cancel order ${targetOrderId}. However, because this package has already been DELIVERED, our automated system cannot cancel it.\n\nAccording to company policy, order cancellations can only be processed before an order has shipped.\n\nI have escalated your case to our Senior Customer Support Team for manual review. A representative will contact you via email (${
      (custResult.customer as { email: string })?.email || 'your registered email'
    }) within 24 hours to assist with options like a return authorization.\n\nCase ID reference: ESC-${targetOrderId}`,
    status: 'escalated' as const,
  };
}

// ---- Main POST Handler ----

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenario_id, case_id, customer_id, order_id } = body;

    if (!customer_id || !order_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: customer_id, order_id',
          timestamp: ts(),
        },
        { status: 400 }
      );
    }

    let result: { trace: TraceEvent[]; response: string; status: string };

    switch (scenario_id) {
      case 'oos-replacement':
        result = handleOosReplacementScenario(customer_id, order_id);
        break;
      case 'cancellation':
        result = handleCancellationScenario(customer_id, order_id);
        break;
      case 'policy-blocked':
        result = handlePolicyBlockedScenario(customer_id, order_id);
        break;
      case 'refund':
      default:
        result = handleRefundScenario(customer_id, order_id);
        break;
    }

    // Update case if provided
    let updatedCase: Case | null = null;
    if (case_id) {
      updatedCase = updateCase(case_id, {
        status: result.status as Case['status'],
        trace: result.trace,
        resolution_summary: result.trace[result.trace.length - 1]?.description,
      });
    }

    return NextResponse.json({
      success: true,
      source: 'mock_simulation',
      data: {
        trace: result.trace,
        response: result.response,
        case: updatedCase,
      },
      timestamp: ts(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        source: 'mock_simulation',
        error: `Mock agent error: ${err instanceof Error ? err.message : 'Unknown'}`,
        timestamp: ts(),
      },
      { status: 500 }
    );
  }
}
