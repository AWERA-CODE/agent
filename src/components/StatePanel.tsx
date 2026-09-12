'use client';

import { Customer, Order, InventoryItem, Case } from '@/lib/types';

interface StatePanelProps {
  customer: Customer | null;
  order: Order | null;
  inventory: InventoryItem[];
  currentCase: Case | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'rgba(245,158,11,0.15)', text: 'var(--warning)' },
  PROCESSING: { bg: 'rgba(59,130,246,0.15)', text: 'var(--primary)' },
  SHIPPED: { bg: 'rgba(99,102,241,0.15)', text: 'var(--info)' },
  DELIVERED: { bg: 'rgba(16,185,129,0.15)', text: 'var(--success)' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', text: 'var(--error)' },
};

const RESOLUTION_COLORS: Record<string, { bg: string; text: string }> = {
  NONE: { bg: 'rgba(107,114,128,0.15)', text: 'var(--muted)' },
  REFUND_PROCESSED: { bg: 'rgba(16,185,129,0.15)', text: 'var(--success)' },
  REPLACEMENT_PROCESSED: { bg: 'rgba(59,130,246,0.15)', text: 'var(--primary)' },
  CANCELLED: { bg: 'rgba(245,158,11,0.15)', text: 'var(--warning)' },
  ESCALATED: { bg: 'rgba(239,68,68,0.15)', text: 'var(--error)' },
};

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  VIP: { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  Premium: { bg: 'rgba(139,92,246,0.2)', text: '#a78bfa' },
  Standard: { bg: 'rgba(107,114,128,0.2)', text: '#9ca3af' },
};

export default function StatePanel({ customer, order, inventory, currentCase }: StatePanelProps) {
  const hasData = customer || order;

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">📋 Live Enterprise State</h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
              Synchronized
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Verified backend data from Next.js Route Handlers
          </p>
        </div>
        {currentCase && (
          <span className="text-xs font-mono bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--foreground)]">
            {currentCase.case_id}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-4xl mb-3">📦</div>
              <p className="text-sm text-[var(--muted)]">No active case state loaded</p>
              <p className="text-xs text-[var(--muted)] mt-1">Select a demo scenario to inspect customer and order records</p>
            </div>
          </div>
        ) : (
          <>
            {/* Customer Info */}
            {customer && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    Customer Profile
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      backgroundColor: (TIER_COLORS[customer.tier] || TIER_COLORS.Standard).bg,
                      color: (TIER_COLORS[customer.tier] || TIER_COLORS.Standard).text,
                    }}
                  >
                    {customer.tier} TIER
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{customer.name}</div>
                <div className="text-xs text-[var(--muted)] font-mono mt-0.5">{customer.customer_id}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{customer.email} • {customer.phone}</div>
              </div>
            )}

            {/* Order Info */}
            {order && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    Order Details
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: (STATUS_COLORS[order.status] || STATUS_COLORS.PENDING).bg,
                      color: (STATUS_COLORS[order.status] || STATUS_COLORS.PENDING).text,
                    }}
                  >
                    STATUS: {order.status}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-mono font-bold text-white">{order.order_id}</span>
                  <span className="text-xs font-semibold text-white">
                    Total: ${order.total_amount.toFixed(2)}
                  </span>
                </div>

                {/* Items */}
                <div className="pt-1 border-t border-[var(--border)]/50 space-y-1.5">
                  <span className="text-[10px] font-semibold text-[var(--muted)] uppercase">Order Line Items:</span>
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-[var(--background)]/60 p-2 rounded-lg border border-[var(--border)]/40">
                      <div className="truncate pr-2">
                        <div className="text-[var(--foreground)] font-medium truncate">{item.item_name}</div>
                        <div className="text-[10px] text-[var(--muted)] font-mono">{item.sku}</div>
                      </div>
                      <span className="text-[var(--foreground)] font-mono shrink-0">
                        {item.quantity} × ${item.unit_price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Resolution State */}
                <div className="pt-2 border-t border-[var(--border)]/50 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)] font-medium">Backend Resolution:</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: (RESOLUTION_COLORS[order.resolution_state] || RESOLUTION_COLORS.NONE).bg,
                      color: (RESOLUTION_COLORS[order.resolution_state] || RESOLUTION_COLORS.NONE).text,
                    }}
                  >
                    {order.resolution_state}
                  </span>
                </div>
              </div>
            )}

            {/* Inventory Inspection */}
            {inventory.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    SKU Inventory Availability
                  </span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">Live Tool Check</span>
                </div>
                <div className="space-y-1.5">
                  {inventory.map((item) => {
                    const isOos = item.quantity_in_stock <= 0;
                    return (
                      <div
                        key={item.sku}
                        className={`p-2 rounded-lg border flex flex-col gap-1 text-xs ${
                          isOos
                            ? 'bg-red-950/20 border-red-500/40 text-red-200'
                            : 'bg-[var(--background)]/60 border-[var(--border)]/40 text-[var(--foreground)]'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium truncate pr-2">{item.item_name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              isOos
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}
                          >
                            {isOos ? '0 IN STOCK (OUT OF STOCK)' : `${item.quantity_in_stock} in stock`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-[var(--muted)] font-mono">
                          <span>{item.sku}</span>
                          {item.restock_date && (
                            <span className="text-amber-400 font-semibold">
                              Restock: {new Date(item.restock_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Case Status */}
            {currentCase && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    Case Lifecycle
                  </span>
                  <span className="text-xs font-bold text-white capitalize bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)]">
                    {currentCase.status}
                  </span>
                </div>
                {currentCase.resolution_summary && (
                  <p className="text-xs text-[var(--foreground)] leading-relaxed pt-1">
                    {currentCase.resolution_summary}
                  </p>
                )}
              </div>
            )}

            {/* Order Event Audit Trail */}
            {order && order.history && order.history.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 shadow-xs space-y-2">
                <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  Order Event History Audit
                </span>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {order.history.map((entry, idx) => (
                    <div key={idx} className="text-xs bg-[var(--background)]/60 p-2 rounded border border-[var(--border)]/40 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-[var(--primary)] font-mono">{entry.action}</span>
                        <span className="text-[var(--muted)]">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <span className="text-[var(--foreground)] text-[11px]">{entry.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
