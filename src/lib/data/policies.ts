// Return window, refund, and cancellation policies
// Ported from the existing Python backend repository

import { PolicyConfig } from '@/lib/types';

export const policiesData: PolicyConfig = {
  return_policy: {
    return_window_days: 30,
    description: 'Products can be returned or replaced within 30 days of delivery date.',
    conditions: [
      'Item must be in original condition or reported defective/damaged upon receipt',
      'Refunds are processed back to the original payment method',
      'Replacements require available inventory stock',
    ],
  },
  cancellation_policy: {
    allowed_statuses: ['PENDING', 'PROCESSING'],
    disallowed_statuses: ['SHIPPED', 'DELIVERED', 'CANCELLED'],
    description: 'Orders can be cancelled only before they have been shipped.',
  },
  refund_policy: {
    eligible_statuses: ['DELIVERED'],
    max_refund_percent: 100,
    vip_bonus_percent: 10,
    description: 'Full refunds are available for delivered orders within the return window. VIP customers receive a 10% bonus credit.',
  },
  replacement_policy: {
    eligible_statuses: ['DELIVERED'],
    requires_inventory: true,
    description: 'Replacements are processed only if the replacement SKU is in stock.',
  },
  escalation_policy: {
    triggers: [
      'Customer explicitly requests human agent',
      'Policy check fails and no alternative resolution is available',
      'Order value exceeds $500',
      'Three or more failed resolution attempts',
    ],
    description: 'Cases are escalated to a human agent when automated resolution is not possible.',
  },
};
