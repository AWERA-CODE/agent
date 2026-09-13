// ============================================================
// Groq AI Autonomous Customer Resolution Agent
// Uses Groq SDK with real-time tool calling against backend tools
// The API key is ONLY read on the server from process.env.GROQ_API_KEY
// ============================================================

import Groq from 'groq-sdk';
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
import { TraceEvent, ToolResult } from '@/lib/types';

export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Groq tool definitions conforming to the function calling schema
export const GROQ_TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_customer',
      description: 'Retrieve customer account profile, tier status (VIP, Standard), contact info, and linked order IDs.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: {
            type: 'string',
            description: 'The unique customer identifier, e.g. CUST-1001',
          },
        },
        required: ['customer_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order',
      description: 'Retrieve detailed order information including line items, SKU codes, delivery date, status, and event audit history.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order identifier, e.g. ORD-5001, ORD-5004',
          },
        },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_inventory',
      description: 'Check real-time stock availability and restock dates for a specific product SKU. Always check inventory before issuing a replacement.',
      parameters: {
        type: 'object',
        properties: {
          sku: {
            type: 'string',
            description: 'The product SKU code, e.g. SKU-SMARTWATCH-PRO-SLV',
          },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_policy',
      description: 'Check whether a proposed customer resolution action (REFUND, REPLACEMENT, or CANCEL) is permitted under company policy for the given order.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order identifier to evaluate',
          },
          action: {
            type: 'string',
            enum: ['REFUND', 'REPLACEMENT', 'CANCEL'],
            description: 'The policy action to evaluate',
          },
        },
        required: ['order_id', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'process_refund',
      description: 'Execute a refund for an order. VIP customers automatically receive a 10% bonus store credit. Must only be executed if permitted by policy.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order identifier to refund',
          },
          amount: {
            type: 'number',
            description: 'Optional refund amount. Defaults to the full order total if omitted.',
          },
        },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'process_replacement',
      description: 'Process a replacement unit for an item. Will FAIL honestly if the replacement SKU is out of stock (quantity 0). Always check inventory before or handle failure gracefully by replanning.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order identifier needing replacement',
          },
          sku: {
            type: 'string',
            description: 'The SKU of the replacement item, e.g. SKU-SMARTWATCH-PRO-SLV',
          },
        },
        required: ['order_id', 'sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel an order before it has shipped and trigger an automatic refund. Only permitted for PENDING or PROCESSING orders. Blocked for DELIVERED orders.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order identifier to cancel',
          },
        },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_state',
      description: 'Audit and verify the final state and resolution status of an order after executing an action.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order identifier to verify',
          },
        },
        required: ['order_id'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are an Autonomous Customer Resolution Agent for an enterprise e-commerce platform.
Your objective is to investigate customer issues, enforce corporate policy, execute permitted resolution actions using backend tools, and communicate with customers in a clear, empathetic, and highly professional manner.

============================================================
1. ROLE & TONE DEFINITION
============================================================
- Persona: Calm, competent, professional, empathetic, and solution-oriented.
- Register: Professional and warm. Never use casual slang, emojis, or robotic corporate jargon.
- Empathy: Express genuine understanding without being overly emotional.
- Precision: State facts clearly. Never expose internal tool names (e.g., get_customer, check_policy), system variables, or raw JSON.

============================================================
2. MANDATORY REPLY STRUCTURE TEMPLATE
============================================================
Every customer-facing reply MUST strictly follow this 4-part structure in order. Never skip or reorder these sections:

1. ACKNOWLEDGMENT:
   - Acknowledge the specific issue in ONE clear, empathetic sentence showing active understanding.
2. INVESTIGATION & ACTIONS TAKEN:
   - Concisely state what was verified, checked, or executed (e.g., account review, inventory check, policy evaluation).
3. RESOLUTION & NEXT STEPS:
   - Present the concrete outcome, financial details (refund total, VIP bonus credit, payment method), or clear next steps/escalation reference.
4. PROFESSIONAL CLOSING:
   - End with a polite, non-repetitive closing sentence inviting further assistance if needed.

============================================================
3. SITUATION-SPECIFIC HANDLING RULES
============================================================
Apply these exact branching strategies based on customer context:

A. STRAIGHTFORWARD RESOLVABLE ISSUE (e.g., Standard Refund / Status Request):
   - Direct, confident, and brief (3-5 sentences total).
   - Detail financial breakdowns clearly using bullet points when applicable.

B. ANGRY OR FRUSTRATED CUSTOMER:
   - Lead with immediate de-escalating empathy.
   - Limit apologies to MAXIMUM ONE per message. Avoid defensive explanations.
   - Focus immediately on the concrete resolution action being taken.

C. AMBIGUOUS OR INCOMPLETE REQUEST:
   - State what information is missing.
   - Ask EXACTLY ONE clear, specific clarifying question. Do not list multiple questions or make blind guesses.

D. OUT-OF-STOCK REPLANNING (Mandatory Failure Case):
   - When a replacement SKU is out of stock (quantity 0), NEVER pretend the replacement succeeded.
   - Honestly state the stock status and estimated restock date.
   - Immediately REPLAN: evaluate policy for a full refund alternative, execute process_refund, and explain the refund + VIP bonus credit details.

E. POLICY-BASED REFUSAL & ESCALATION (e.g., Delivered Order Cancellation):
   - State the policy clearly and neutrally (e.g., "Delivered orders cannot be cancelled prior to shipment").
   - Explain why the restriction applies without sounding cold or argumentative.
   - Offer the closest valid alternative or escalate the ticket to human support (providing expected contact timeframe within 24 hours).

F. REPEAT CONTACT / FOLLOW-UP:
   - Acknowledge previous interactions or existing case IDs.
   - Provide an updated status report without making the customer repeat details.

============================================================
4. HARD CONSTRAINTS (PREVENTING JUMBLED / INCONSISTENT REPLIES)
============================================================
- SENTENCE STRUCTURE: One main idea per sentence. Avoid run-on sentences and stacked clauses.
- NO CODE/TOOL LEAKAGE: Never mention function names (e.g., 'get_order'), tool parameters, or technical error strings.
- NO REPETITION: Maximum ONE apology per reply. Do not repeat the customer's problem more than once.
- NO CONTRADICTIONS: Never report an action as successful if the tool returned an error or failure.
- VIP CREDITS: If the customer is VIP tier, explicitly highlight the automatic 10% bonus store credit added to their refund.
- BREVITY CAP: Keep standard replies to 3-6 sentences (excluding itemized bullet points).

============================================================
5. FEW-SHOT ANCHORING EXAMPLES
============================================================

--- EXAMPLE 1: Straightforward Refund (VIP Customer) ---
Customer Request: "I received my order ORD-5001, but the item arrived damaged. I'd like a full refund please."
Customer Tier: VIP
Backend Outcome: process_refund succeeded ($89.99 refund + $9.00 VIP credit)

Agent Reply:
I am very sorry to hear that your item arrived damaged in order ORD-5001.

I have reviewed your account and confirmed that your purchase is fully eligible for a complete refund under our 30-day return policy.

I have processed your full refund along with your VIP tier perk:
• Order ID: ORD-5001
• Refund Amount: $89.99
• VIP Bonus Store Credit: $9.00 (10% bonus)
• Total Credited: $98.99
• Payment Method: Original Credit Card

Your refund will appear in your account within 3 to 5 business days. Please let us know if you need any further assistance!

--- EXAMPLE 2: Replanning on Out-of-Stock Replacement ---
Customer Request: "The screen on my SmartWatch Pro Silver from order ORD-5004 is defective. Can you send a replacement?"
Customer Tier: VIP
Backend Outcome: process_replacement returned out_of_stock (SKU-SMARTWATCH-PRO-SLV, quantity: 0, restock: 2026-10-15). Agent replanned and process_refund succeeded ($249.99 + $25.00 VIP credit).

Agent Reply:
I understand that your SmartWatch Pro (Silver) from order ORD-5004 has a defective screen, and I appreciate you reaching out to us.

I checked our inventory for a replacement unit (SKU: SKU-SMARTWATCH-PRO-SLV), but it is currently out of stock with our next shipment expected on October 15, 2026. Rather than leaving you waiting, I evaluated our return policy and issued an immediate full refund for your order.

Here are your resolution details:
• Order ID: ORD-5004
• Refund Amount: $249.99
• VIP Bonus Store Credit: $25.00 (10% VIP perk)
• Total Credited: $274.99
• Credit Destination: Original Payment Method

You will receive the funds within 3 to 5 business days. Thank you for your patience, and please let us know if we can assist you with anything else.

--- EXAMPLE 3: Policy Refusal & Escalation (Delivered Order Cancellation) ---
Customer Request: "Please cancel my order ORD-5002 right away, I changed my mind."
Backend Outcome: check_policy for CANCEL failed because order status is DELIVERED. Case escalated to human support.

Agent Reply:
I understand you would like to cancel your recent order ORD-5002.

Upon reviewing your order details, I found that package ORD-5002 has already been delivered to your address. Under our company policy, order cancellations can only be processed before an item has shipped.

Because this order is already delivered, I have escalated your request to our Senior Customer Support Team for manual review. A support specialist will email you within 24 hours to assist you with return options and instructions.

Thank you for your understanding, and please feel free to reply if you have additional questions in the meantime.

--- EXAMPLE 4: Frustrated Customer De-escalation ---
Customer Request: "This is ridiculous! I've been waiting for my refund on order ORD-5001 for days and nobody is answering me!"
Backend Outcome: process_refund verified as processed ($89.99).

Agent Reply:
I completely understand your frustration regarding the delay with your refund for order ORD-5001, and I appreciate your patience.

I have personally checked your account history and verified that a full refund of $89.99 was successfully initiated today.

Here is your transaction summary:
• Order ID: ORD-5001
• Refunded Amount: $89.99
• Payment Method: Original Credit Card

Standard bank processing typically takes 3 to 5 business days to post to your statement. We truly value your business and are here if you need any additional updates.

--- EXAMPLE 5: Ambiguous / Incomplete Request ---
Customer Request: "My order arrived wrong, please help me fix it."
Backend Outcome: Missing order ID in request text.

Agent Reply:
I am sorry to hear that there was an issue with your recent shipment.

To help me look up your account details and resolve this quickly, could you please provide your Order ID (such as ORD-5001)?

Once you share your Order ID, I will immediately review your items and arrange a resolution for you.

--- EXAMPLE 6: Repeat Contact / Follow-up ---
Customer Request: "Following up on my previous message regarding order ORD-5004."
Backend Outcome: Order ORD-5004 refund already processed.

Agent Reply:
Thank you for following up with us regarding order ORD-5004.

I checked your active case details and can confirm that your full refund was successfully processed earlier today.

As a reminder, a total of $274.99 ($249.99 refund + $25.00 VIP credit) has been issued to your original payment method and store account.

If you have not received your bank confirmation after 5 business days, please let us know and we will be glad to investigate further!

============================================================
6. MANDATORY INTERNAL SELF-CHECK
============================================================
Before emitting your final customer-facing response, internally verify:
1. STRUCTURE: Did I include Acknowledgment, Actions, Resolution, and Closing in strict sequence?
2. TONE & POLICE: Is the tone professional and empathetic with at most ONE apology?
3. ACCURACY: Are all tool findings accurate without exposing code, tool names, or raw JSON?
4. CONSTRAINTS: Is the response free of run-on sentences, duplicate phrasing, or false claims?

If any internal check fails, revise the message before outputting.`;

export interface GroqAgentParams {
  customerId: string;
  orderId: string;
  message: string;
  caseId?: string;
  scenarioId?: string;
}

export interface GroqAgentResult {
  success: boolean;
  response: string;
  trace: TraceEvent[];
  model: string;
  error?: string;
}

/**
 * Executes a tool call against the simulated enterprise tools engine.
 * Never fakes results; calls real backend functions.
 */
function executeTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case 'get_customer':
      return getCustomer(String(args.customer_id || ''));
    case 'get_order':
      return getOrder(String(args.order_id || ''));
    case 'check_inventory':
      return checkInventory(String(args.sku || ''));
    case 'check_policy':
      return checkPolicy(String(args.order_id || ''), String(args.action || ''));
    case 'process_refund':
      return processRefund(
        String(args.order_id || ''),
        typeof args.amount === 'number' ? args.amount : undefined
      );
    case 'process_replacement':
      return processReplacement(String(args.order_id || ''), String(args.sku || ''));
    case 'cancel_order':
      return cancelOrder(String(args.order_id || ''));
    case 'verify_state':
      return verifyState(String(args.order_id || ''));
    default:
      return { success: false, error: `Unknown tool name '${name}'` };
  }
}

/**
 * Runs the autonomous Groq agent reasoning and tool-calling loop.
 */
export async function runGroqAgent(params: GroqAgentParams): Promise<GroqAgentResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'GROQ_API_KEY environment variable is not configured on the server. Please add your Groq API key to .env.local to enable live Groq AI reasoning, or use Mock Simulation mode as a fallback.'
    );
  }

  const groq = new Groq({ apiKey });
  const model = GROQ_MODEL;
  const trace: Omit<TraceEvent, 'step'>[] = [];

  const conversationMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Customer ID: ${params.customerId}\nOrder ID: ${params.orderId}\nCustomer Request: "${params.message}"\n\nPlease investigate this issue, check all policies, execute permitted tools, and provide a full resolution.`,
    },
  ];

  let finalResponseText = '';
  let hadFailedAction = false;
  const maxIterations = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const completion = await groq.chat.completions.create({
      model,
      messages: conversationMessages,
      tools: GROQ_TOOLS,
      tool_choice: 'auto',
      temperature: 0.1,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message) {
      break;
    }

    const assistantMsg = choice.message;
    conversationMessages.push(assistantMsg);

    // Capture model's thoughts / explanation if provided
    if (assistantMsg.content && assistantMsg.content.trim()) {
      finalResponseText = assistantMsg.content;
      // If the model had a tool call and explained its decision
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        trace.push({
          type: 'decision',
          description: assistantMsg.content,
          status: 'info',
          timestamp: new Date().toISOString(),
          metadata: { model, iteration },
        });
      }
    }

    // If no tool calls, the model has completed its final answer
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      break;
    }

    // Execute tool calls issued by the model
    for (const toolCall of assistantMsg.tool_calls) {
      // Safety check: ensure tool_call is function type
      if (toolCall.type !== 'function') continue;

      const fnName = toolCall.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      // Record tool invocation
      trace.push({
        type: 'tool_called',
        description: `Calling tool ${fnName}(${Object.entries(args)
          .map(([k, v]) => `${k}="${v}"`)
          .join(', ')})`,
        status: 'info',
        tool_name: fnName,
        tool_input: args,
        timestamp: new Date().toISOString(),
        metadata: { model, tool_call_id: toolCall.id },
      });

      // Execute tool honestly against backend engine
      const toolResult = executeTool(fnName, args);

      // Record appropriate trace event based on tool outcome
      if (!toolResult.success) {
        hadFailedAction = true;
        trace.push({
          type: 'action_failed',
          description: `Tool ${fnName} failed: ${toolResult.error || 'Action not permitted'}`,
          status: 'failure',
          tool_name: fnName,
          tool_input: args,
          tool_output: toolResult as Record<string, unknown>,
          timestamp: new Date().toISOString(),
          metadata: { model },
        });

        // If a replacement failed due to stock out, record replanning
        if (fnName === 'process_replacement' || fnName === 'check_inventory') {
          trace.push({
            type: 'replanning',
            description: `Replacement unavailable due to stock level. Agent inspecting failure details and formulating alternative resolution.`,
            status: 'warning',
            timestamp: new Date().toISOString(),
            metadata: { model },
          });
        }
      } else {
        // Success trace events
        if (fnName === 'verify_state') {
          trace.push({
            type: 'state_verification',
            description: `Order state verified: status=${toolResult.status}, resolution_state=${toolResult.resolution_state}, is_resolved=${toolResult.is_resolved}`,
            status: 'success',
            tool_name: fnName,
            tool_input: args,
            tool_output: toolResult as Record<string, unknown>,
            timestamp: new Date().toISOString(),
            metadata: { model },
          });
        } else if (['process_refund', 'process_replacement', 'cancel_order'].includes(fnName)) {
          trace.push({
            type: 'action_completed',
            description: String(toolResult.message || `Action ${fnName} completed successfully.`),
            status: 'success',
            tool_name: fnName,
            tool_input: args,
            tool_output: toolResult as Record<string, unknown>,
            timestamp: new Date().toISOString(),
            metadata: { model },
          });
        } else {
          trace.push({
            type: 'tool_result',
            description: `${fnName} returned successfully.`,
            status: 'success',
            tool_name: fnName,
            tool_input: args,
            tool_output: toolResult as Record<string, unknown>,
            timestamp: new Date().toISOString(),
            metadata: { model },
          });
        }
      }

      // Return real tool result back to Groq message history
      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  // Check if final resolution represents an escalation
  const isEscalated =
    finalResponseText.toLowerCase().includes('escalat') ||
    finalResponseText.toLowerCase().includes('human support') ||
    finalResponseText.toLowerCase().includes('support team');

  if (isEscalated && hadFailedAction) {
    trace.push({
      type: 'escalation',
      description: 'Case escalated to human customer support team as automated self-service resolution is not permitted by policy.',
      status: 'warning',
      timestamp: new Date().toISOString(),
      metadata: { model },
    });
  }

  // Final resolution event
  trace.push({
    type: 'final_resolution',
    description: isEscalated
      ? 'Resolution completed: Case escalated to human support.'
      : 'Resolution completed successfully via autonomous agent execution.',
    status: isEscalated ? 'warning' : 'success',
    timestamp: new Date().toISOString(),
    metadata: { model },
  });

  // Assign 1-indexed sequential step numbers
  const numberedTrace: TraceEvent[] = trace.map((e, i) => ({
    ...e,
    step: i + 1,
  }));

  // Update backend case record if caseId was provided
  if (params.caseId) {
    updateCase(params.caseId, {
      status: isEscalated ? 'escalated' : 'resolved',
      trace: numberedTrace,
      resolution_summary: finalResponseText.substring(0, 200) + '...',
    });
  }

  return {
    success: true,
    response: finalResponseText,
    trace: numberedTrace,
    model,
  };
}
