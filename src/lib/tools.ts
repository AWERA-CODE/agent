// ============================================================
// Simulated Enterprise Backend Tools Engine
// TypeScript implementation of the enterprise simulation engine
// Faithful to AWERA-CODE/Agentic-Ai with full state verification
// ============================================================

import { customersData } from '@/lib/data/customers';
import { ordersData } from '@/lib/data/orders';
import { inventoryData } from '@/lib/data/inventory';
import { policiesData } from '@/lib/data/policies';
import {
  Customer,
  Order,
  InventoryItem,
  ToolResult,
  OrderStatus,
} from '@/lib/types';

// ---- In-Memory State (reset-able for deterministic demos) ----
// Deep-clone seed data so mutations don't corrupt the initial dataset

let customers: Customer[] = structuredClone(customersData);
let orders: Order[] = structuredClone(ordersData);
let inventory: InventoryItem[] = structuredClone(inventoryData);

function now(): string {
  return new Date().toISOString();
}

// ---- Reset Tool ----

export function resetWorld(): ToolResult {
  customers = structuredClone(customersData);
  orders = structuredClone(ordersData);
  inventory = structuredClone(inventoryData);
  return {
    success: true,
    message: 'World data successfully reset to initial seed state.',
  };
}

// ---- Customer Tools ----

export function getCustomer(customerId: string): ToolResult {
  const cust = customers.find((c) => c.customer_id === customerId);
  if (!cust) {
    return { success: false, error: `Customer ID '${customerId}' not found.` };
  }
  return { success: true, customer: { ...cust } };
}

export function getCustomerOrders(customerId: string): ToolResult {
  const custOrders = orders.filter((o) => o.customer_id === customerId);
  return { success: true, customer_id: customerId, orders: custOrders.map((o) => ({ ...o })) };
}

// ---- Order Tools ----

export function getOrder(orderId: string): ToolResult {
  const order = orders.find((o) => o.order_id === orderId);
  if (!order) {
    return { success: false, error: `Order ID '${orderId}' not found.` };
  }
  return {
    success: true,
    order: {
      ...order,
      items: order.items.map((i) => ({ ...i })),
      history: order.history.map((h) => ({ ...h })),
    },
  };
}

// ---- Inventory Tools ----

export function checkInventory(sku: string): ToolResult {
  const item = inventory.find((i) => i.sku === sku);
  if (!item) {
    return { success: false, error: `SKU '${sku}' not found in inventory.` };
  }
  const inStock = item.quantity_in_stock > 0;
  return {
    success: true,
    item: { ...item },
    sku: item.sku,
    item_name: item.item_name,
    category: item.category,
    unit_price: item.unit_price,
    in_stock: inStock,
    quantity_available: item.quantity_in_stock,
    quantity_in_stock: item.quantity_in_stock,
    restock_date: item.restock_date,
  };
}

// ---- Policy Tools ----

export function checkPolicy(orderId: string, action: string): ToolResult {
  const order = orders.find((o) => o.order_id === orderId);
  if (!order) {
    return { success: false, error: `Order ID '${orderId}' not found.` };
  }

  const normalizedAction = action.toUpperCase();
  const policies = policiesData;

  // Calculate days since delivery if delivered
  let daysSinceDelivery: number | null = null;
  if (order.delivery_date) {
    const delivDt = new Date(order.delivery_date);
    const msDiff = new Date().getTime() - delivDt.getTime();
    daysSinceDelivery = Math.floor(msDiff / (1000 * 60 * 60 * 24));
  }

  if (normalizedAction === 'REFUND') {
    const returnWindow = policies.return_policy.return_window_days;
    const maxRefund = 500.0;

    if (order.resolution_state !== 'NONE') {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Order '${orderId}' already has resolution state '${order.resolution_state}'. Cannot process refund.`,
        reason: `Order already resolved as ${order.resolution_state}.`,
      };
    }

    if (daysSinceDelivery !== null && daysSinceDelivery > returnWindow) {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Return window of ${returnWindow} days has expired. Order was delivered ${daysSinceDelivery} days ago.`,
        reason: `Delivery date was ${daysSinceDelivery} days ago, exceeding the ${returnWindow}-day window.`,
      };
    }

    if (order.total_amount > maxRefund) {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Order amount ($${order.total_amount.toFixed(2)}) exceeds max auto-refund limit of $${maxRefund.toFixed(2)}.`,
        reason: `Amount exceeds $${maxRefund.toFixed(2)} limit.`,
      };
    }

    // Customer tier VIP bonus check
    const cust = customers.find((c) => c.customer_id === order.customer_id);
    const vipBonus = cust?.tier === 'VIP' ? policies.refund_policy.vip_bonus_percent : 0;

    return {
      success: true,
      allowed: true,
      eligible: true,
      action: 'REFUND',
      order_id: orderId,
      refund_amount: order.total_amount,
      vip_bonus_percent: vipBonus,
      vip_bonus_amount: (order.total_amount * vipBonus) / 100,
      reason: 'Refund action is permitted under company policy.',
      policy: policies.refund_policy,
    };
  }

  if (normalizedAction === 'REPLACEMENT' || normalizedAction === 'REPLACE') {
    const returnWindow = policies.return_policy.return_window_days;

    if (order.resolution_state !== 'NONE') {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Order '${orderId}' already has resolution state '${order.resolution_state}'. Cannot process replacement.`,
        reason: `Order already resolved as ${order.resolution_state}.`,
      };
    }

    if (!policies.replacement_policy.eligible_statuses.includes(order.status)) {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Replacement not allowed for order status '${order.status}'. Eligible statuses: ${policies.replacement_policy.eligible_statuses.join(', ')}.`,
        reason: `Order status '${order.status}' is not eligible for replacement.`,
      };
    }

    if (daysSinceDelivery !== null && daysSinceDelivery > returnWindow) {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Return window of ${returnWindow} days has expired. Order was delivered ${daysSinceDelivery} days ago.`,
        reason: `Delivery date was ${daysSinceDelivery} days ago, exceeding the ${returnWindow}-day window.`,
      };
    }

    return {
      success: true,
      allowed: true,
      eligible: true,
      action: 'REPLACEMENT',
      order_id: orderId,
      requires_inventory_check: true,
      reason: 'Replacement action is permitted within the return window. Inventory availability check required.',
      policy: policies.replacement_policy,
    };
  }

  if (normalizedAction === 'CANCEL' || normalizedAction === 'CANCELLATION') {
    const allowed = policies.cancellation_policy.allowed_statuses;

    if (order.resolution_state !== 'NONE') {
      return {
        success: false,
        allowed: false,
        eligible: false,
        error: `Order '${orderId}' already has resolution state '${order.resolution_state}'.`,
        reason: `Order already resolved as ${order.resolution_state}.`,
      };
    }

    if (allowed.includes(order.status)) {
      return {
        success: true,
        allowed: true,
        eligible: true,
        action: 'CANCEL',
        order_id: orderId,
        refund_amount: order.total_amount,
        reason: `Order status '${order.status}' is eligible for cancellation.`,
        policy: policies.cancellation_policy,
      };
    }

    return {
      success: false,
      allowed: false,
      eligible: false,
      error: `Cancellation not allowed for order status '${order.status}'. Orders can only be cancelled before they enter SHIPPED or DELIVERED status. Allowed statuses: ${allowed.join(', ')}.`,
      reason: `Order status '${order.status}' cannot be cancelled. Only allowed for: ${allowed.join(', ')}.`,
      policy: policies.cancellation_policy,
      order_status: order.status,
    };
  }

  return {
    success: false,
    allowed: false,
    eligible: false,
    error: `Unknown policy action '${action}'. Valid actions are REFUND, REPLACEMENT, CANCEL.`,
  };
}

// ---- Action Tools ----

export function processRefund(orderId: string, amount?: number): ToolResult {
  const orderIdx = orders.findIndex((o) => o.order_id === orderId);
  if (orderIdx === -1) {
    return { success: false, error: `Order ID '${orderId}' not found.` };
  }
  const order = orders[orderIdx];

  // Verify policy check
  const policyCheck = checkPolicy(orderId, 'REFUND');
  if (!policyCheck.success) {
    return policyCheck;
  }

  const refundAmount = amount !== undefined ? amount : order.total_amount;
  if (refundAmount <= 0 || refundAmount > order.total_amount) {
    return {
      success: false,
      error: `Invalid refund amount $${refundAmount.toFixed(2)}. Order total is $${order.total_amount.toFixed(2)}.`,
    };
  }

  // Prevent duplicate refund
  if (order.resolution_state === 'REFUND_PROCESSED' || order.status === 'REFUNDED') {
    return {
      success: false,
      error: `Order '${orderId}' has already been refunded.`,
    };
  }

  // Apply state change
  const timestamp = now();
  orders[orderIdx] = {
    ...order,
    resolution_state: 'REFUND_PROCESSED',
    history: [
      ...order.history,
      {
        timestamp,
        action: 'PROCESS_REFUND',
        details: `Processed refund of $${refundAmount.toFixed(2)} to ${order.payment_method}.`,
      },
    ],
  };

  // Calculate VIP bonus credit
  const cust = customers.find((c) => c.customer_id === order.customer_id);
  const vipBonusPercent = cust?.tier === 'VIP' ? policiesData.refund_policy.vip_bonus_percent : 0;
  const vipBonus = (refundAmount * vipBonusPercent) / 100;

  return {
    success: true,
    order_id: orderId,
    refund_amount: refundAmount,
    vip_bonus_credit: vipBonus,
    total_credited: refundAmount + vipBonus,
    payment_method: order.payment_method,
    new_resolution_state: 'REFUND_PROCESSED',
    status: order.status,
    message: `Refund of $${refundAmount.toFixed(2)} successfully processed for order ${orderId}.${
      vipBonus > 0 ? ` VIP bonus credit of $${vipBonus.toFixed(2)} (10%) applied.` : ''
    }`,
  };
}

export function processReplacement(orderId: string, sku: string): ToolResult {
  const orderIdx = orders.findIndex((o) => o.order_id === orderId);
  if (orderIdx === -1) {
    return { success: false, error: `Order ID '${orderId}' not found.` };
  }
  const order = orders[orderIdx];

  // Prevent duplicate resolution
  if (order.resolution_state !== 'NONE') {
    return {
      success: false,
      error: `Order '${orderId}' already has resolution state '${order.resolution_state}'.`,
    };
  }

  // Verify policy
  const policyCheck = checkPolicy(orderId, 'REPLACEMENT');
  if (!policyCheck.success) {
    return policyCheck;
  }

  // Check inventory stock for requested SKU
  const inv = checkInventory(sku);
  if (!inv.success) {
    return inv;
  }

  // Mandatory honest failure check: If stock is 0, report clear failure
  const qty = typeof inv.quantity_available === 'number' ? inv.quantity_available : 0;
  const itemName = typeof inv.item_name === 'string' ? inv.item_name : sku;
  const restockDate = typeof inv.restock_date === 'string' ? inv.restock_date : null;

  if (!inv.in_stock || qty <= 0) {
    return {
      success: false,
      error: `Replacement failed: SKU '${sku}' (${itemName}) is out of stock (quantity: 0).`,
      out_of_stock_sku: sku,
      sku: sku,
      item_name: itemName,
      quantity_available: 0,
      restock_date: restockDate,
      suggestion: 'Consider offering a refund instead, or check alternative SKUs.',
    };
  }

  // Deduct 1 item from inventory
  const invIdx = inventory.findIndex((i) => i.sku === sku);
  if (invIdx !== -1) {
    inventory[invIdx] = {
      ...inventory[invIdx],
      quantity_in_stock: inventory[invIdx].quantity_in_stock - 1,
    };
  }

  // Update order state
  const timestamp = now();
  orders[orderIdx] = {
    ...order,
    resolution_state: 'REPLACEMENT_PROCESSED',
    history: [
      ...order.history,
      {
        timestamp,
        action: 'PROCESS_REPLACEMENT',
        details: `Replacement unit ordered for SKU '${sku}' (${itemName}). Shipping to ${order.shipping_address}.`,
      },
    ],
  };

  return {
    success: true,
    order_id: orderId,
    replacement_sku: sku,
    replacement_item: itemName,
    new_resolution_state: 'REPLACEMENT_PROCESSED',
    status: order.status,
    message: `Replacement for SKU '${sku}' (${itemName}) successfully created for order ${orderId}.`,
  };
}

export function cancelOrder(orderId: string): ToolResult {
  const orderIdx = orders.findIndex((o) => o.order_id === orderId);
  if (orderIdx === -1) {
    return { success: false, error: `Order ID '${orderId}' not found.` };
  }
  const order = orders[orderIdx];

  // Prevent duplicate cancellation
  if (order.status === 'CANCELLED' || order.resolution_state === 'CANCELLED') {
    return {
      success: false,
      error: `Order '${orderId}' has already been cancelled.`,
    };
  }

  // Check policy for cancellation
  const polCheck = checkPolicy(orderId, 'CANCEL');
  if (!polCheck.allowed) {
    return {
      success: false,
      error: `Cancellation blocked by policy: ${polCheck.error || polCheck.reason}`,
    };
  }

  // Execute cancellation
  const timestamp = now();
  orders[orderIdx] = {
    ...order,
    status: 'CANCELLED' as OrderStatus,
    resolution_state: 'CANCELLED',
    history: [
      ...order.history,
      {
        timestamp,
        action: 'CANCEL_ORDER',
        details: 'Order cancelled successfully prior to shipping.',
      },
    ],
  };

  return {
    success: true,
    order_id: orderId,
    refund_amount: order.total_amount,
    payment_method: order.payment_method,
    new_status: 'CANCELLED',
    new_resolution_state: 'CANCELLED',
    status: 'CANCELLED',
    message: `Order ${orderId} has been successfully cancelled. Refund of $${order.total_amount.toFixed(2)} processed.`,
  };
}

// ---- Verification Tool ----

export function verifyState(orderId: string): ToolResult {
  const order = orders.find((o) => o.order_id === orderId);
  if (!order) {
    return { success: false, error: `Order ID '${orderId}' not found.` };
  }
  const isResolved = ['REFUND_PROCESSED', 'REPLACEMENT_PROCESSED', 'CANCELLED', 'REFUNDED', 'REPLACED'].includes(
    order.resolution_state
  );

  return {
    success: true,
    order_id: orderId,
    status: order.status,
    current_status: order.status,
    resolution_state: order.resolution_state,
    is_resolved: isResolved,
    items: order.items.map((i) => ({ ...i })),
    total_amount: order.total_amount,
    last_action: order.history.length > 0 ? order.history[order.history.length - 1] : null,
    history_count: order.history.length,
    history: order.history.map((h) => ({ ...h })),
  };
}

// ---- Utility: Get complete data for state panel ----

export function getFullState(customerId: string, orderId: string) {
  const cust = customers.find((c) => c.customer_id === customerId);
  const order = orders.find((o) => o.order_id === orderId);
  const relevantSkus = order ? order.items.map((i) => i.sku) : [];
  const relevantInventory = inventory.filter((i) => relevantSkus.includes(i.sku));
  return { customer: cust ? { ...cust } : null, order: order ? { ...order } : null, inventory: relevantInventory.map((i) => ({ ...i })) };
}
