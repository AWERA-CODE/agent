// ============================================================
// Unit Tests for Groq Agent Tool Schema and Safety Guards
// ============================================================

import { GROQ_TOOLS, runGroqAgent } from '@/lib/groqAgent';

describe('Groq Agent Tool Definitions', () => {
  it('should define all 8 required backend tools for function calling', () => {
    const toolNames = GROQ_TOOLS.map((t) => t.function.name);
    expect(toolNames).toContain('get_customer');
    expect(toolNames).toContain('get_order');
    expect(toolNames).toContain('check_inventory');
    expect(toolNames).toContain('check_policy');
    expect(toolNames).toContain('process_refund');
    expect(toolNames).toContain('process_replacement');
    expect(toolNames).toContain('cancel_order');
    expect(toolNames).toContain('verify_state');
  });

  it('should require customer_id for get_customer', () => {
    const tool = GROQ_TOOLS.find((t) => t.function.name === 'get_customer');
    expect(tool).toBeDefined();
    expect(tool?.function.parameters?.required).toContain('customer_id');
  });

  it('should require order_id and action for check_policy', () => {
    const tool = GROQ_TOOLS.find((t) => t.function.name === 'check_policy');
    expect(tool).toBeDefined();
    expect(tool?.function.parameters?.required).toEqual(
      expect.arrayContaining(['order_id', 'action'])
    );
  });

  it('should fail cleanly with helpful message when GROQ_API_KEY is not set', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    await expect(
      runGroqAgent({
        customerId: 'CUST-1001',
        orderId: 'ORD-5001',
        message: 'I want a refund',
      })
    ).rejects.toThrow('GROQ_API_KEY environment variable is not configured');

    process.env.GROQ_API_KEY = originalKey;
  });
});

describe('Groq Agent System Prompt Optimization', () => {
  it('should include all required prompt sections: Role, Reply Structure, Situations, Constraints, Few-Shot Examples, Self-Check', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/groqAgent.ts'),
      'utf-8'
    );

    expect(fileContent).toContain('ROLE & TONE DEFINITION');
    expect(fileContent).toContain('MANDATORY REPLY STRUCTURE TEMPLATE');
    expect(fileContent).toContain('ACKNOWLEDGMENT');
    expect(fileContent).toContain('INVESTIGATION & ACTIONS TAKEN');
    expect(fileContent).toContain('RESOLUTION & NEXT STEPS');
    expect(fileContent).toContain('PROFESSIONAL CLOSING');
    expect(fileContent).toContain('SITUATION-SPECIFIC HANDLING RULES');
    expect(fileContent).toContain('HARD CONSTRAINTS');
    expect(fileContent).toContain('FEW-SHOT ANCHORING EXAMPLES');
    expect(fileContent).toContain('MANDATORY INTERNAL SELF-CHECK');
  });

  it('should include at least 6 few-shot anchoring examples covering key customer scenarios', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/groqAgent.ts'),
      'utf-8'
    );

    expect(fileContent).toContain('--- EXAMPLE 1: Straightforward Refund');
    expect(fileContent).toContain('--- EXAMPLE 2: Replanning on Out-of-Stock Replacement');
    expect(fileContent).toContain('--- EXAMPLE 3: Policy Refusal & Escalation');
    expect(fileContent).toContain('--- EXAMPLE 4: Frustrated Customer De-escalation');
    expect(fileContent).toContain('--- EXAMPLE 5: Ambiguous / Incomplete Request');
    expect(fileContent).toContain('--- EXAMPLE 6: Repeat Contact / Follow-up');
  });
});

