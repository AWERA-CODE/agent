// Case management - in-memory store for demo
// In production, this would use a database

import { Case } from '@/lib/types';

const cases: Map<string, Case> = new Map();
let caseCounter = 1000;

export function createCase(customerId: string, orderId: string, issueDescription: string): Case {
  const caseId = `CASE-${++caseCounter}`;
  const now = new Date().toISOString();
  const newCase: Case = {
    case_id: caseId,
    customer_id: customerId,
    order_id: orderId,
    issue_description: issueDescription,
    status: 'open',
    created_at: now,
    updated_at: now,
    trace: [],
  };
  cases.set(caseId, newCase);
  return newCase;
}

export function getCase(caseId: string): Case | null {
  return cases.get(caseId) || null;
}

export function updateCase(caseId: string, updates: Partial<Case>): Case | null {
  const existing = cases.get(caseId);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  cases.set(caseId, updated);
  return updated;
}

export function listCases(): Case[] {
  return Array.from(cases.values());
}

export function resetCases(): void {
  cases.clear();
  caseCounter = 1000;
}
