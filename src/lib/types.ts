// ============================================================
// Core TypeScript type definitions for the entire application
// ============================================================

// ---- Data Models ----

export interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  tier: 'VIP' | 'Premium' | 'Standard';
  created_at: string;
  orders: string[];
}

export interface OrderItem {
  sku: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderHistoryEntry {
  timestamp: string;
  action: string;
  details: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'REPLACED';

export type ResolutionState =
  | 'NONE'
  | 'REFUND_PROCESSED'
  | 'REPLACEMENT_PROCESSED'
  | 'CANCELLED'
  | 'ESCALATED'
  | 'REFUNDED'
  | 'REPLACED';

export interface Order {
  order_id: string;
  customer_id: string;
  order_date: string;
  delivery_date: string | null;
  status: OrderStatus;
  resolution_state: ResolutionState;
  items: OrderItem[];
  total_amount: number;
  payment_method: string;
  shipping_address: string;
  history: OrderHistoryEntry[];
}

export interface InventoryItem {
  sku: string;
  item_name: string;
  category: string;
  unit_price: number;
  quantity_in_stock: number;
  restock_date: string | null;
}

// ---- Policies ----

export interface ReturnPolicy {
  return_window_days: number;
  description: string;
  conditions: string[];
}

export interface CancellationPolicy {
  allowed_statuses: string[];
  disallowed_statuses: string[];
  description: string;
}

export interface RefundPolicy {
  eligible_statuses: string[];
  max_refund_percent: number;
  vip_bonus_percent: number;
  description: string;
}

export interface ReplacementPolicy {
  eligible_statuses: string[];
  requires_inventory: boolean;
  description: string;
}

export interface EscalationPolicy {
  triggers: string[];
  description: string;
}

export interface PolicyConfig {
  return_policy: ReturnPolicy;
  cancellation_policy: CancellationPolicy;
  refund_policy: RefundPolicy;
  replacement_policy: ReplacementPolicy;
  escalation_policy: EscalationPolicy;
}

// ---- Tool Results ----

export interface ToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

// ---- Agent Trace Events ----

export type TraceEventType =
  | 'decision'
  | 'tool_called'
  | 'tool_result'
  | 'action_completed'
  | 'action_failed'
  | 'replanning'
  | 'state_verification'
  | 'escalation'
  | 'final_resolution';

export interface TraceEvent {
  step: number;
  type: TraceEventType;
  description: string;
  status: 'success' | 'failure' | 'info' | 'warning' | 'pending';
  timestamp: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ---- Cases ----

export type CaseStatus = 'open' | 'in_progress' | 'resolved' | 'escalated' | 'failed';

export interface Case {
  case_id: string;
  customer_id: string;
  order_id: string;
  issue_description: string;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
  trace: TraceEvent[];
  resolution_summary?: string;
}

// ---- Chat Messages ----

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

// ---- Demo Scenarios ----

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  customer_id: string;
  order_id: string;
  message: string;
  expected_flow: string;
}

// ---- API Response Wrappers ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
