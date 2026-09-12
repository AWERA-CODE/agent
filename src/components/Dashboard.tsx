'use client';

import { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import TracePanel from './TracePanel';
import StatePanel from './StatePanel';
import {
  ChatMessage,
  TraceEvent,
  Case,
  Customer,
  Order,
  InventoryItem,
  DemoScenario,
  AgentMode,
} from '@/lib/types';
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
  const [agentMode, setAgentMode] = useState<AgentMode>('groq');
  const [groqConfigured, setGroqConfigured] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check server configuration for Groq API key on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/agent/status');
        const data = await res.json();
        if (data.success) {
          setGroqConfigured(Boolean(data.groq_configured));
          if (data.groq_configured) {
            setAgentMode('groq');
          } else {
            setAgentMode('mock');
            setMessages([
              {
                id: uuidv4(),
                role: 'system',
                content:
                  'ℹ️ Note: GROQ_API_KEY is not set in .env.local on the server.\n\nThe application is running in Mock Mode (offline fallback). To enable live Groq AI reasoning, add GROQ_API_KEY to your .env.local file.',
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch {
        setAgentMode('mock');
      }
    }
    checkStatus();
  }, []);

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

        // 2. Call agent service via decoupled adapter (Groq AI or Mock Fallback)
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
          // Explicitly show error without hiding it behind fake successes
          addMessage(
            'system',
            `⚠️ Agent Error (${agentMode.toUpperCase()} mode):\n${
              agentResult.error || 'Request could not be completed.'
            }\n\n👉 You can switch to Mock Mode using the button below or in the sidebar.`
          );
          if (agentResult.trace && agentResult.trace.length > 0) {
            setTraceEvents(agentResult.trace);
          }
        }

        // 3. Re-fetch confirmed live backend state
        await fetchState(customerId, orderId);
      } catch (err) {
        addMessage(
          'system',
          `Error executing agent pipeline: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
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

  const handleFallbackToMock = useCallback(() => {
    setAgentMode('mock');
    addMessage('system', 'Switched to Mock Fallback Mode. You can re-run scenarios offline.');
  }, [addMessage]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--background)]">
      {/* Top Demo Environment & Mode Notice Banner */}
      <div
        className={`px-4 py-1.5 flex items-center justify-between text-[11px] z-50 border-b ${
          agentMode === 'groq'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`font-bold uppercase tracking-wider ${
              agentMode === 'groq' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {agentMode === 'groq' ? '⚡ Groq AI Active:' : '🧪 Mock Mode:'}
          </span>
          <span className="truncate">
            {agentMode === 'groq'
              ? 'Llama 3.3 model reasoning with native tool calling against real backend tools. Verified state updates.'
              : 'Deterministic test stub running with in-memory state. No external API key required.'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              groqConfigured
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {groqConfigured ? 'Groq Key: Detected' : 'Groq Key: Missing'}
          </span>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] underline hover:opacity-80"
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
          groqConfigured={groqConfigured}
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
              onFallbackToMock={handleFallbackToMock}
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
