'use client';

import { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import TracePanel from './TracePanel';
import StatePanel from './StatePanel';
import { ChatMessage, TraceEvent, Case, Customer, Order, InventoryItem, DemoScenario } from '@/lib/types';
import { callAgentService } from '@/lib/agentAdapter';
import { v4 as uuidv4 } from 'uuid';

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'refund',
    name: '✅ Successful Refund',
    description: 'VIP customer requests a refund for delivered earbuds within the 30-day return window.',
    customer_id: 'CUST-1001',
    order_id: 'ORD-5001',
    message: 'I received my wireless earbuds on order ORD-5001 but they are defective. I would like a full refund please.',
    expected_flow: 'Customer Lookup → Order Check → Policy Check → Refund Processed (+ VIP bonus) → State Verified',
  },
  {
    id: 'cancellation',
    name: '🚫 Successful Cancellation',
    description: 'Customer cancels an active order that is still in PENDING fulfillment status.',
    customer_id: 'CUST-1003',
    order_id: 'ORD-5003',
    message: 'I would like to cancel my gaming keyboard order ORD-5003 before it ships.',
    expected_flow: 'Customer Lookup → Order Check → Policy Check → Order Cancelled → State Verified',
  },
  {
    id: 'oos-replacement',
    name: '⚠️ Out-of-Stock Replacement (Mandatory Failure Scenario)',
    description: 'Customer requests replacement for SmartWatch Pro (Silver) on ORD-5004. SKU-SMARTWATCH-PRO-SLV has 0 inventory (restock: 2026-10-15). Replacement fails honestly; agent replans to refund alternative.',
    customer_id: 'CUST-1001',
    order_id: 'ORD-5004',
    message: 'My SmartWatch Pro (Silver) on order ORD-5004 has a display defect. Can I get a replacement unit sent to me?',
    expected_flow: 'Customer Lookup → Order Check (ORD-5004) → Eligibility Check → Inventory Check (SKU-SMARTWATCH-PRO-SLV = 0) → Replacement BLOCKED → Replanning → Alternative Refund Executed → State Verified',
  },
  {
    id: 'policy-blocked',
    name: '🔒 Policy-Blocked Escalation',
    description: 'Customer tries to cancel a DELIVERED order (ORD-5002) — policy blocks cancellation, case escalates to human.',
    customer_id: 'CUST-1002',
    order_id: 'ORD-5002',
    message: 'Please cancel my delivered USB-C cable order ORD-5002 immediately and give me a refund.',
    expected_flow: 'Customer Lookup → Order Check (ORD-5002) → Policy Check (Cancellation blocked for DELIVERED) → Escalation to Human Agent',
  },
];

export default function Dashboard() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(DEMO_SCENARIOS[2]); // Default to mandatory OOS
  const [agentMode, setAgentMode] = useState<'mock' | 'live'>('mock');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const resetState = useCallback(async () => {
    setMessages([]);
    setTraceEvents([]);
    setCurrentCase(null);
    setCustomer(null);
    setOrder(null);
    setInventoryItems([]);
    setIsProcessing(false);
    try {
      await fetch('/api/tools/reset', { method: 'POST' });
    } catch {
      // Ignored
    }
  }, []);

  const addMessage = useCallback((role: ChatMessage['role'], content: string) => {
    const msg: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const fetchState = useCallback(async (customerId: string, orderId: string) => {
    try {
      const [custRes, orderRes] = await Promise.all([
        fetch(`/api/tools/customer?customer_id=${customerId}`),
        fetch(`/api/tools/order?order_id=${orderId}`),
      ]);
      const custData = await custRes.json();
      const orderData = await orderRes.json();

      if (custData.success && custData.data?.customer) {
        setCustomer(custData.data.customer);
      }
      if (orderData.success && orderData.data?.order) {
        setOrder(orderData.data.order);

        // Fetch inventory for each item in the order
        const skus = orderData.data.order.items.map((i: { sku: string }) => i.sku);
        const invResults = await Promise.all(
          skus.map((sku: string) => fetch(`/api/tools/inventory?sku=${sku}`).then((r) => r.json()))
        );
        setInventoryItems(
          invResults
            .filter((r: { success: boolean }) => r.success)
            .map((r: { data: { item: InventoryItem } }) => r.data.item)
        );
      }
    } catch {
      console.error('Failed to fetch backend state');
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      addMessage('user', content);
      setIsProcessing(true);

      try {
        const scenario = selectedScenario || DEMO_SCENARIOS[2];
        const customerId = scenario.customer_id;
        const orderId = scenario.order_id;

        // 1. Create or register case on backend
        const caseRes = await fetch('/api/case', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            order_id: orderId,
            issue_description: content,
          }),
        });
        const caseData = await caseRes.json();
        const activeCaseId = caseData.data?.case_id;
        if (caseData.success) {
          setCurrentCase(caseData.data);
        }

        // 2. Call agent service via decoupled adapter (Mock or Live)
        const agentResult = await callAgentService(
          {
            scenario_id: scenario.id,
            case_id: activeCaseId,
            customer_id: customerId,
            order_id: orderId,
            message: content,
          },
          agentMode
        );

        if (agentResult.success) {
          setTraceEvents(agentResult.trace);
          if (agentResult.case) {
            setCurrentCase(agentResult.case);
          }
          addMessage('agent', agentResult.response);
        } else {
          addMessage('system', `Agent Processing Failure: ${agentResult.error || 'Unknown error'}`);
          if (agentResult.trace && agentResult.trace.length > 0) {
            setTraceEvents(agentResult.trace);
          }
        }

        // 3. Re-fetch confirmed live backend state
        await fetchState(customerId, orderId);
      } catch (err) {
        addMessage('system', `Error executing agent pipeline: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [addMessage, selectedScenario, agentMode, fetchState]
  );

  const handleSelectScenario = useCallback(
    async (scenario: DemoScenario) => {
      await resetState();
      setSelectedScenario(scenario);
      addMessage(
        'system',
        `Scenario Loaded: ${scenario.name}\n${scenario.description}\n\nExpected Flow:\n${scenario.expected_flow}`
      );
      // Preload the target customer and order state
      await fetchState(scenario.customer_id, scenario.order_id);
    },
    [resetState, addMessage, fetchState]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--background)]">
      {/* Top Demo Environment Notice Banner */}
      <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-[11px] text-amber-200 z-50">
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold uppercase tracking-wider text-amber-400">Demo Environment:</span>
          <span className="truncate">
            State is maintained in-memory for deterministic replay. Failed actions fail honestly without fake successes.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-amber-300 font-mono">
            Active Mode: <strong className="uppercase">{agentMode}</strong>
          </span>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] underline text-amber-400 hover:text-amber-200"
          >
            Health Check
          </a>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          scenarios={DEMO_SCENARIOS}
          selectedScenario={selectedScenario}
          onSelectScenario={handleSelectScenario}
          agentMode={agentMode}
          onSetAgentMode={setAgentMode}
          onReset={resetState}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              selectedScenario={selectedScenario}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              agentMode={agentMode}
            />
          </div>

          {/* Right Inspection Panels */}
          <div className="w-full lg:w-[540px] flex flex-col border-l border-[var(--border)] overflow-hidden">
            {/* Top: Agent Execution Trace Panel */}
            <div className="flex-1 overflow-hidden min-h-[300px]">
              <TracePanel events={traceEvents} mode={agentMode} />
            </div>
            {/* Bottom: Verified Case State Panel */}
            <div className="flex-1 overflow-hidden border-t border-[var(--border)] min-h-[300px]">
              <StatePanel
                customer={customer}
                order={order}
                inventory={inventoryItems}
                currentCase={currentCase}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
