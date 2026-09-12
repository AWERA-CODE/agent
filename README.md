# Autonomous Customer Resolution Agent

> **Track 3: Smart Automation — Problem Statement 5**
> Frontend Dashboard, Backend Enterprise Tools & Integration API for Autonomous Customer Resolution Agent.

---

## ⚠️ Important Deployment & Persistence Notice

- **Current Runtime Status:** This application is configured in **Demo Mode with In-Memory State**.
- **Persistence Behavior:** State mutations (refunds, cancellations, replacements) are held in-memory and will reset upon serverless container restarts on Vercel.
- **Repeatable Testing:** The `/api/tools/reset` endpoint and the "Reset World State" sidebar button restore initial seed data instantly.
- **Production Persistence Setup:** For persistent multi-tenant PostgreSQL/Supabase deployment, see the exact SQL schema and migration guide in [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md).

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Customer Resolution Dashboard               │
│   • Customer Support Chat (Preset Scenarios, Loading)    │
│   • Agent Execution Trace (Decision, Tools, Replanning)  │
│   • Case State Panel (Customer Tier, Order, Inventory)   │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│              Next.js 15 Backend API Routes               │
│   • /api/tools/customer       • /api/tools/order         │
│   • /api/tools/inventory      • /api/tools/policy        │
│   • /api/tools/refund         • /api/tools/replacement   │
│   • /api/tools/cancel         • /api/tools/verify        │
│   • /api/tools/reset          • /api/case                │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│            Enterprise Tools Simulation Engine            │
│   • Strict Policy Validation (30-day Window, Limits)     │
│   • Honest Failure Reporting (No Fake Successes)         │
│   • Duplicate Action Prevention                          │
│   • Audit Logging & State Verification                   │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│            Simulated Datasets (Deterministic)            │
│   • Customers (VIP, Standard)                            │
│   • Orders (ORD-5001 to ORD-5005)                        │
│   • Inventory (SKU-SMARTWATCH-PRO-SLV planted 0 stock)   │
│   • Company Policies (Return, Refund, Cancel, Escalate)  │
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Backend Tools

All tools are located in [`src/lib/tools.ts`](src/lib/tools.ts) and exposed via Next.js Route Handlers:

1. `get_customer(customer_id)` — Customer profile, contact, VIP tier, and past order IDs.
2. `get_order(order_id)` — Line items, amounts, shipping address, status, and event audit history.
3. `get_customer_orders(customer_id)` — Helper retrieving all orders for a customer.
4. `check_inventory(sku)` — Real-time SKU stock count and restock dates.
5. `check_policy(order_id, action)` — Business rules engine for `REFUND`, `REPLACEMENT`, and `CANCEL`.
6. `process_refund(order_id, amount)` — Processes refund with automatic 10% VIP bonus credit.
7. `process_replacement(order_id, sku)` — Deducts inventory and issues replacement. **Fails honestly if out of stock.**
8. `cancel_order(order_id)` — Cancels pre-shipment orders with automatic refund.
9. `verify_state(order_id)` — Verifies final order status, resolution state, and audit entries.
10. `reset_world()` — Deterministic seed-state reset.

---

## 🎯 Mandatory Failure Scenario

The mandatory out-of-stock replanning workflow uses:
- **Order ID:** `ORD-5004` (Delivered item: SmartWatch Pro Silver, $249.99)
- **SKU:** `SKU-SMARTWATCH-PRO-SLV`
- **Quantity in Stock:** `0`
- **Restock Date:** `2026-10-15T00:00:00Z`

### 9-Step Verification Flow:
1. **Retrieve Customer & Order:** Customer `CUST-1001` (Alice Smith, VIP) and order `ORD-5004` are retrieved.
2. **Check Replacement Eligibility:** `check_policy("ORD-5004", "REPLACEMENT")` confirms order is within 30-day window.
3. **Check Inventory:** `check_inventory("SKU-SMARTWATCH-PRO-SLV")` returns `in_stock: false`, `quantity_available: 0`, `restock_date: "2026-10-15"`.
4. **Attempt Replacement:** `process_replacement("ORD-5004", "SKU-SMARTWATCH-PRO-SLV")` is called.
5. **Honest Failure Returned:** System returns structured failure: `Replacement failed: SKU 'SKU-SMARTWATCH-PRO-SLV' (SmartWatch Pro (Silver)) is out of stock (quantity: 0).` Order state is **not** modified.
6. **Agent Inspects Failure:** UI and trace log show the failure distinctly in red with tool payload.
7. **Agent Replans Alternative:** Agent evaluates alternative resolution (full refund of $249.99 + 10% VIP bonus credit).
8. **Execute Permitted Alternative:** `process_refund("ORD-5004")` is executed successfully.
9. **State Verification:** `verify_state("ORD-5004")` confirms `resolution_state: REFUND_PROCESSED`.

---

## 🧪 Mock Mode vs. Live Agent Mode

The frontend includes an **Agent Execution Mode** toggle in the sidebar:

- **🧪 Mock Simulation Mode (Default):**
  - Uses an internal developer simulator ([`src/app/api/agent/mock/route.ts`](src/app/api/agent/mock/route.ts)).
  - Exercises actual backend tools and emits realistic chronological trace events for UI verification.
  - Clearly tagged with `[MOCK SIMULATION]` banners across all panels so it is never confused with a real LLM.
- **⚡ Live Agent Mode:**
  - Routes requests through the integration adapter ([`src/lib/agentAdapter.ts`](src/lib/agentAdapter.ts)) directly to your teammate's external agent orchestration service via `NEXT_PUBLIC_AGENT_API_URL`.
  - Displays live external trace events.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Run automated test suite
npm test

# 4. Run Next.js production build
npm run build

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## 🧪 Automated Testing

Run the full test suite with Jest:

```bash
npm test
```

### Verified Test Coverage:
- `get_customer`: Valid profiles, VIP tiers, invalid customer handling
- `get_order`: Order retrieval, item line items, invalid order IDs
- `check_inventory`: Available stock, out-of-stock reporting (`SKU-SMARTWATCH-PRO-SLV`), restock dates
- `check_policy`: 30-day refund window, cancellation status validation, replacement rules
- `process_refund`: Refund execution, VIP bonus credit, duplicate prevention
- `cancel_order`: Cancellation of pending orders, policy blocking of delivered orders, duplicate prevention
- `process_replacement`: In-stock replacement, **honest out-of-stock failure**, duplicate prevention
- `verify_state`: Pre-action vs. post-action state verification
- **Mandatory E2E Workflow:** Full 9-step failure → replanning → alternative refund → state verification on `ORD-5004`.

---

## 🔌 API Contract for Teammate

Refer to [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for the complete integration contract.

### What your teammate needs to provide:
1. An endpoint: `POST {AGENT_URL}/resolve`
2. Accepting: `{ case_id, customer_id, order_id, message }`
3. Returning: `{ trace: TraceEvent[], response: string }`
4. Set the URL in Vercel: `NEXT_PUBLIC_AGENT_API_URL`

---

## 🌐 GitHub Push & Vercel Deployment Instructions

### Push to a New GitHub Repository

```bash
cd c:\Users\Aritra\Documents\Agenticaihackathon

# Initialize git
git init
git add .
git commit -m "feat: autonomous customer resolution agent with frontend, backend tools & API"
git branch -M main

# Link to your new repository
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_NEW_REPO>.git
git push -u origin main
```

### Deploy to Vercel

1. Log in to [Vercel](https://vercel.com) and click **"Add New..."** → **"Project"**.
2. Import your newly pushed GitHub repository.
3. Framework Preset: **Next.js** (auto-detected).
4. Environment Variables (Optional):
   - `NEXT_PUBLIC_AGENT_API_URL`: URL of your teammate's agent backend (if ready).
5. Click **"Deploy"**.
6. Verify deployment:
   - Health check: `https://<your-app>.vercel.app/api/health` (returns `{"status": "healthy"}`)
   - Dashboard: `https://<your-app>.vercel.app/`
