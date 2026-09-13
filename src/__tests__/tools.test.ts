// ============================================================
// Comprehensive Test Suite for Backend Enterprise Tools
// Tests all required tools, policy enforcement, duplicate guards,
// and the mandatory Out-of-Stock replacement failure scenario on
// order ORD-5004 with SKU-SMARTWATCH-PRO-SLV.
// ============================================================

import {
  resetWorld,
  getCustomer,
  getCustomerOrders,
  getOrder,
  checkInventory,
  checkPolicy,
  processRefund,
  processReplacement,
  cancelOrder,
  verifyState,
} from '@/lib/tools';

beforeEach(() => {
  resetWorld();
});

// ---- 1. Customer Lookup Tests ----

describe('get_customer', () => {
  it('should return valid customer profile for CUST-1001 (VIP tier)', () => {
    const res = getCustomer('CUST-1001');
    expect(res.success).toBe(true);
    expect(res.customer).toBeDefined();
    const cust = res.customer as { customer_id: string; name: string; tier: string; orders: string[] };
    expect(cust.customer_id).toBe('CUST-1001');
    expect(cust.name).toBe('Alice Smith');
    expect(cust.tier).toBe('VIP');
    expect(cust.orders).toContain('ORD-5004');
  });

  it('should return error for nonexistent customer ID', () => {
    const res = getCustomer('CUST-NONEXISTENT');
    expect(res.success).toBe(false);
    expect(res.error).toContain('not found');
  });
});

describe('get_customer_orders', () => {
  it('should return all orders for CUST-1001', () => {
    const res = getCustomerOrders('CUST-1001');
    expect(res.success).toBe(true);
    const orders = res.orders as Array<{ order_id: string }>;
    expect(orders.length).toBe(2);
    expect(orders.map((o) => o.order_id)).toEqual(expect.arrayContaining(['ORD-5001', 'ORD-5004']));
  });

  it('should return empty list for customer without orders', () => {
    const res = getCustomerOrders('CUST-UNKNOWN');
    expect(res.success).toBe(true);
    expect((res.orders as unknown[]).length).toBe(0);
  });
});

// ---- 2. Order Lookup Tests ----

describe('get_order', () => {
  it('should return order details for ORD-5004 (SmartWatch Pro Silver)', () => {
    const res = getOrder('ORD-5004');
    expect(res.success).toBe(true);
    const order = res.order as {
      order_id: string;
      customer_id: string;
      status: string;
      total_amount: number;
      items: Array<{ sku: string; item_name: string; unit_price: number }>;
    };
    expect(order.order_id).toBe('ORD-5004');
    expect(order.customer_id).toBe('CUST-1001');
    expect(order.status).toBe('DELIVERED');
    expect(order.total_amount).toBe(249.99);
    expect(order.items[0].sku).toBe('SKU-SMARTWATCH-PRO-SLV');
  });

  it('should return error for invalid order ID', () => {
    const res = getOrder('ORD-INVALID');
    expect(res.success).toBe(false);
    expect(res.error).toContain('not found');
  });
});

// ---- 3. Inventory Check Tests ----

describe('check_inventory', () => {
  it('should return in_stock=true for available items', () => {
    const res = checkInventory('SKU-WIRELESS-EARBUDS-BLK');
    expect(res.success).toBe(true);
    expect(res.in_stock).toBe(true);
    expect(res.quantity_available).toBe(45);
  });

  it('should report quantity 0 and restock date 2026-10-15 for SKU-SMARTWATCH-PRO-SLV (Mandatory OOS item)', () => {
    const res = checkInventory('SKU-SMARTWATCH-PRO-SLV');
    expect(res.success).toBe(true);
    expect(res.in_stock).toBe(false);
    expect(res.quantity_available).toBe(0);
    expect(res.restock_date).toBe('2026-10-15T00:00:00Z');
    expect(res.item_name).toBe('SmartWatch Pro (Silver)');
  });

  it('should return error for nonexistent SKU', () => {
    const res = checkInventory('SKU-NONEXISTENT');
    expect(res.success).toBe(false);
    expect(res.error).toContain('not found in inventory');
  });
});

// ---- 4. Policy Check Tests ----

describe('check_policy', () => {
  it('should allow REFUND for delivered order ORD-5001 within return window', () => {
    const res = checkPolicy('ORD-5001', 'REFUND');
    expect(res.success).toBe(true);
    expect(res.allowed).toBe(true);
    expect(res.eligible).toBe(true);
  });

  it('should allow CANCEL for pending order ORD-5003', () => {
    const res = checkPolicy('ORD-5003', 'CANCEL');
    expect(res.success).toBe(true);
    expect(res.allowed).toBe(true);
    expect(res.eligible).toBe(true);
  });

  it('should BLOCK cancellation for DELIVERED order ORD-5002', () => {
    const res = checkPolicy('ORD-5002', 'CANCEL');
    expect(res.success).toBe(false);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('Cancellation not allowed');
  });

  it('should allow REPLACEMENT policy for delivered order ORD-5004', () => {
    const res = checkPolicy('ORD-5004', 'REPLACEMENT');
    expect(res.success).toBe(true);
    expect(res.allowed).toBe(true);
    expect(res.requires_inventory_check).toBe(true);
  });

  it('should reject unknown policy action', () => {
    const res = checkPolicy('ORD-5001', 'FLY_TO_MARS');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unknown policy action');
  });
});

// ---- 5. Refund Tool Tests ----

describe('process_refund', () => {
  it('should process refund with 10% VIP bonus credit for CUST-1001 on ORD-5001', () => {
    const res = processRefund('ORD-5001');
    expect(res.success).toBe(true);
    expect(res.refund_amount).toBe(89.99);
    expect(res.new_resolution_state).toBe('REFUND_PROCESSED');
    expect(res.vip_bonus_credit).toBeCloseTo(8.999, 2);
    expect(res.total_credited).toBeCloseTo(98.989, 2);
  });

  it('should prevent duplicate refund on already resolved order', () => {
    processRefund('ORD-5001');
    const duplicate = processRefund('ORD-5001');
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already');
  });

  it('should reject invalid refund amounts', () => {
    const res = processRefund('ORD-5001', 9999.0);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid refund amount');
  });
});

// ---- 6. Cancellation Tool Tests ----

describe('cancel_order', () => {
  it('should successfully cancel PENDING order ORD-5003', () => {
    const res = cancelOrder('ORD-5003');
    expect(res.success).toBe(true);
    expect(res.new_status).toBe('CANCELLED');
    expect(res.new_resolution_state).toBe('CANCELLED');
    expect(res.refund_amount).toBe(129.99);
  });

  it('should block cancellation of DELIVERED order ORD-5002', () => {
    const res = cancelOrder('ORD-5002');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cancellation blocked by policy');
  });

  it('should prevent duplicate cancellation', () => {
    cancelOrder('ORD-5003');
    const duplicate = cancelOrder('ORD-5003');
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already');
  });
});

// ---- 7. Replacement Tool Tests ----

describe('process_replacement', () => {
  it('should successfully replace an item when inventory is in stock', () => {
    const res = processReplacement('ORD-5001', 'SKU-WIRELESS-EARBUDS-BLK');
    expect(res.success).toBe(true);
    expect(res.new_resolution_state).toBe('REPLACEMENT_PROCESSED');
    expect(res.replacement_sku).toBe('SKU-WIRELESS-EARBUDS-BLK');

    // Check inventory decreased from 45 to 44
    const inv = checkInventory('SKU-WIRELESS-EARBUDS-BLK');
    expect(inv.quantity_available).toBe(44);
  });

  it('should fail honestly when requested SKU is out of stock (SKU-SMARTWATCH-PRO-SLV on ORD-5004)', () => {
    const res = processReplacement('ORD-5004', 'SKU-SMARTWATCH-PRO-SLV');
    expect(res.success).toBe(false);
    expect(res.error).toContain('out of stock');
    expect(res.quantity_available).toBe(0);
    expect(res.restock_date).toBe('2026-10-15T00:00:00Z');
    expect(res.out_of_stock_sku).toBe('SKU-SMARTWATCH-PRO-SLV');
    expect(res.suggestion).toBeDefined();

    // Verify order was NOT modified to success
    const orderCheck = getOrder('ORD-5004');
    expect((orderCheck.order as { resolution_state: string }).resolution_state).toBe('NONE');
  });

  it('should prevent replacement if order is already resolved', () => {
    processReplacement('ORD-5001', 'SKU-WIRELESS-EARBUDS-BLK');
    const duplicate = processReplacement('ORD-5001', 'SKU-WIRELESS-EARBUDS-BLK');
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already has resolution state');
  });
});

// ---- 8. State Verification Tests ----

describe('verify_state', () => {
  it('should return accurate unfulfilled state before action', () => {
    const res = verifyState('ORD-5004');
    expect(res.success).toBe(true);
    expect(res.status).toBe('DELIVERED');
    expect(res.resolution_state).toBe('NONE');
    expect(res.is_resolved).toBe(false);
  });

  it('should return verified state after action is performed', () => {
    processRefund('ORD-5004');
    const res = verifyState('ORD-5004');
    expect(res.success).toBe(true);
    expect(res.resolution_state).toBe('REFUND_PROCESSED');
    expect(res.is_resolved).toBe(true);
  });
});

// ---- 9. Mandatory Out-of-Stock End-to-End Workflow Test ----

describe('Mandatory Failure Scenario E2E Workflow (ORD-5004 & SKU-SMARTWATCH-PRO-SLV)', () => {
  it('should execute the full 9-step sequence: lookup -> eligibility -> inventory check (0) -> honest failure -> replan -> alternative refund -> state verification', () => {
    // 1. Retrieve customer and order
    const custRes = getCustomer('CUST-1001');
    expect(custRes.success).toBe(true);
    const orderRes = getOrder('ORD-5004');
    expect(orderRes.success).toBe(true);
    const order = orderRes.order as { status: string; total_amount: number; resolution_state: string };
    expect(order.status).toBe('DELIVERED');
    expect(order.resolution_state).toBe('NONE');
    expect(order.total_amount).toBe(249.99);

    // 2. Check replacement eligibility
    const policyRes = checkPolicy('ORD-5004', 'REPLACEMENT');
    expect(policyRes.success).toBe(true);
    expect(policyRes.allowed).toBe(true);

    // 3. Check inventory for SKU-SMARTWATCH-PRO-SLV
    const invRes = checkInventory('SKU-SMARTWATCH-PRO-SLV');
    expect(invRes.success).toBe(true);
    expect(invRes.in_stock).toBe(false);
    expect(invRes.quantity_available).toBe(0);
    expect(invRes.restock_date).toBe('2026-10-15T00:00:00Z');

    // 4. Attempt the replacement
    const replaceRes = processReplacement('ORD-5004', 'SKU-SMARTWATCH-PRO-SLV');

    // 5. Return structured failure when unavailable (Honest failure check)
    expect(replaceRes.success).toBe(false);
    expect(replaceRes.error).toContain('out of stock (quantity: 0)');
    expect(replaceRes.out_of_stock_sku).toBe('SKU-SMARTWATCH-PRO-SLV');
    expect(replaceRes.restock_date).toBe('2026-10-15T00:00:00Z');

    // 6. Inspect failure & verify order was not marked resolved
    const midState = verifyState('ORD-5004');
    expect(midState.resolution_state).toBe('NONE');
    expect(midState.is_resolved).toBe(false);

    // 7. Select permitted alternative (Refund)
    const refundPolicyCheck = checkPolicy('ORD-5004', 'REFUND');
    expect(refundPolicyCheck.success).toBe(true);
    expect(refundPolicyCheck.allowed).toBe(true);

    // 8. Execute permitted alternative (Refund of $249.99)
    const refundRes = processRefund('ORD-5004');
    expect(refundRes.success).toBe(true);
    expect(refundRes.refund_amount).toBe(249.99);
    expect(refundRes.new_resolution_state).toBe('REFUND_PROCESSED');
    // VIP customer bonus
    expect(refundRes.vip_bonus_credit).toBeCloseTo(24.999, 2);

    // 9. Verify resulting order state
    const finalState = verifyState('ORD-5004');
    expect(finalState.success).toBe(true);
    expect(finalState.status).toBe('DELIVERED');
    expect(finalState.resolution_state).toBe('REFUND_PROCESSED');
    expect(finalState.is_resolved).toBe(true);
    expect(finalState.last_action).toBeDefined();
    expect((finalState.last_action as { action: string }).action).toBe('PROCESS_REFUND');
  });
});
