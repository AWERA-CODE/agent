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
Your objective is to investigate customer issues, enforce corporate policy, execute permitted resolution actions via backend tools, and provide clear, empathetic, and professional communication.

MANDATORY GUIDELINES FOR TOOL USAGE AND REASONING:
1. ALWAYS start by calling get_customer and get_order to retrieve customer profile details (including tier: VIP/Standard) and order line items.
2. ALWAYS verify company policy with check_policy before attempting any resolution action (REFUND, REPLACEMENT, CANCEL).
3. IF REPLACEMENT IS REQUESTED:
   - Call check_inventory for the requested replacement SKU first.
   - If stock is 0, do NOT pretend the replacement succeeded. Calling process_replacement will return a structured failure.
   - When a replacement is out of stock, REPLAN: acknowledge the out-of-stock situation honestly (mentioning the restock date), check if a full refund is permitted under policy, and execute process_refund as the alternative resolution.
4. IF CANCELLATION IS REQUESTED:
   - Check policy. Orders in DELIVERED status CANNOT be cancelled (cancellation is only permitted for PENDING or PROCESSING orders).
   - If blocked by policy, explain clearly why cancellation is not permitted and escalate the case to human support. Do not attempt cancel_order on delivered orders.
5. AFTER EXECUTING ANY RESOLUTION ACTION (process_refund, process_replacement, cancel_order):
   - ALWAYS call verify_state to audit and confirm the resulting order status and resolution state.
6. VIP CUSTOMERS:
   - VIP customers automatically receive a 10% bonus credit on refunds. Mention this perk in your final response if applicable.
7. FINAL RESPONSE:
   - Provide a concise, polite, and comprehensive final resolution message summarizing all action details, refund amounts, bonus credits, payment methods, or escalation steps.
   - NEVER make false claims about actions that failed. Only report actions that successfully completed on the backend.`;

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
