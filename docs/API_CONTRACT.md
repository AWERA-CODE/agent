# API Contract — Autonomous Customer Resolution Agent

This document defines the complete API contract for the simulated enterprise backend tools, case management, and AI agent integration interface.

Your AI agent teammate should use this specification to integrate their orchestration engine.

---

## 1. System Overview

```
Frontend Support Dashboard
         │
         ▼
Next.js Backend API Routes (/api/tools/*, /api/case/*)
         │
         ▼
Enterprise Simulation Engine (TypeScript Tools Engine)
         │
         ▼
Simulated Enterprise State (In-Memory Demo / Optional PostgreSQL DB)
```

- **Local Base URL**: `http://localhost:3000`
- **Vercel Production Base URL**: `https://<your-deployment>.vercel.app`

All JSON responses follow this unified wrapper:

```json
{
  "success": true,
  "data": { ... },
  "error": "Error message if success is false",
  "timestamp": "2026-09-12T12:00:00.000Z"
}
```

---

## 2. Health Check

### `GET /api/health`

Confirms server availability and deployment health.

**Response (200 OK):**
```json
{
  "success": true,
  "status": "healthy",
  "version": "1.0.0",
  "service": "autonomous-customer-resolution-agent",
  "timestamp": "2026-09-12T17:00:00.000Z"
}
```

---

## 3. Demo Test Scenarios

### `GET /api/scenarios`

Returns preset scenarios designed for repeatable automated or live agent testing.

| Scenario ID | Order ID | Customer ID | Focus | Expected Result |
|---|---|---|---|---|
| `refund` | `ORD-5001` | `CUST-1001` (VIP) | 30-day Return Window Refund | Success (Full refund + 10% VIP bonus) |
| `cancellation` | `ORD-5003` | `CUST-1003` (Standard) | Pre-shipment Order Cancellation | Success (Order cancelled, refund queued) |
| `oos-replacement` | `ORD-5004` | `CUST-1001` (VIP) | **Mandatory Out-of-Stock Failure** | **Fails honestly** (`SKU-SMARTWATCH-PRO-SLV` = 0 stock, restock: 2026-10-15) → Agent replans → Executes refund alternative |
| `policy-blocked` | `ORD-5002` | `CUST-1002` (Standard) | Policy Boundary Enforcement | Cancellation blocked for DELIVERED order → Escalates to human |

---

## 4. Enterprise Tools API Specification

### 4.1. Customer Lookup: `GET /api/tools/customer?customer_id={id}`

Retrieves customer profile and order IDs.

**Query Parameters:**
- `customer_id` (string, required): e.g. `CUST-1001`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "customer": {
      "customer_id": "CUST-1001",
      "name": "Alice Smith",
      "email": "alice.smith@example.com",
      "phone": "+1-555-0192",
      "tier": "VIP",
      "created_at": "2024-01-15T08:30:00Z",
      "orders": ["ORD-5001", "ORD-5004"]
    }
  },
  "timestamp": "2026-09-12T17:00:00.000Z"
}
```

---

### 4.2. Order Lookup: `GET /api/tools/order?order_id={id}`

Retrieves full order state, item line items, delivery date, and audit trail.

**Query Parameters:**
- `order_id` (string, required): e.g. `ORD-5004`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "order": {
      "order_id": "ORD-5004",
      "customer_id": "CUST-1001",
      "order_date": "2026-09-04T12:00:00Z",
      "delivery_date": "2026-09-08T15:45:00Z",
      "status": "DELIVERED",
      "resolution_state": "NONE",
      "items": [
        {
          "sku": "SKU-SMARTWATCH-PRO-SLV",
          "item_name": "SmartWatch Pro (Silver)",
          "quantity": 1,
          "unit_price": 249.99
        }
      ],
      "total_amount": 249.99,
      "payment_method": "Credit Card ending in 4242",
      "shipping_address": "123 Main St, Tech City, CA 94016",
      "history": [
        { "timestamp": "2026-09-04T12:00:00Z", "action": "ORDER_PLACED", "details": "Order placed by customer" },
        { "timestamp": "2026-09-08T15:45:00Z", "action": "ORDER_DELIVERED", "details": "Delivered by carrier - reported screen issue" }
      ]
    }
  }
}
```

---

### 4.3. Inventory Check: `GET /api/tools/inventory?sku={sku}`

Checks current stock count and restock dates for an item SKU.

**Query Parameters:**
- `sku` (string, required): e.g. `SKU-SMARTWATCH-PRO-SLV`

**Out-of-Stock Item Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "sku": "SKU-SMARTWATCH-PRO-SLV",
    "item_name": "SmartWatch Pro (Silver)",
    "category": "Electronics",
    "unit_price": 249.99,
    "in_stock": false,
    "quantity_available": 0,
    "quantity_in_stock": 0,
    "restock_date": "2026-10-15T00:00:00Z"
  }
}
```

---

### 4.4. Policy Compliance Check: `GET /api/tools/policy?order_id={id}&action={action}`

Evaluates whether an action conforms to company policy.

**Query Parameters:**
- `order_id` (string, required): e.g. `ORD-5004`
- `action` (string, required): `REFUND`, `REPLACEMENT`, or `CANCEL`

**Permitted Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "allowed": true,
    "eligible": true,
    "action": "REPLACEMENT",
    "order_id": "ORD-5004",
    "requires_inventory_check": true,
    "reason": "Replacement action is permitted within the return window. Inventory availability check required."
  }
}
```

**Blocked Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "Cancellation not allowed for order status 'DELIVERED'. Orders can only be cancelled before they enter SHIPPED or DELIVERED status. Allowed statuses: PENDING, PROCESSING."
}
```

---

### 4.5. Process Replacement: `POST /api/tools/replacement`

Attempts to process an item replacement. **Fails honestly** when stock is 0.

**Request Body:**
```json
{
  "order_id": "ORD-5004",
  "sku": "SKU-SMARTWATCH-PRO-SLV"
}
```

**Mandatory Failure Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Replacement failed: SKU 'SKU-SMARTWATCH-PRO-SLV' (SmartWatch Pro (Silver)) is out of stock (quantity: 0).",
  "data": {
    "success": false,
    "out_of_stock_sku": "SKU-SMARTWATCH-PRO-SLV",
    "sku": "SKU-SMARTWATCH-PRO-SLV",
    "item_name": "SmartWatch Pro (Silver)",
    "quantity_available": 0,
    "restock_date": "2026-10-15T00:00:00Z",
    "suggestion": "Consider offering a refund instead, or check alternative SKUs."
  }
}
```

---

### 4.6. Process Refund: `POST /api/tools/refund`

Executes a refund back to the customer payment method. Automatically computes VIP bonus credits.

**Request Body:**
```json
{
  "order_id": "ORD-5004",
  "amount": 249.99
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "order_id": "ORD-5004",
    "refund_amount": 249.99,
    "vip_bonus_credit": 25.00,
    "total_credited": 274.99,
    "payment_method": "Credit Card ending in 4242",
    "new_resolution_state": "REFUND_PROCESSED",
    "status": "DELIVERED",
    "message": "Refund of $249.99 successfully processed for order ORD-5004. VIP bonus credit of $25.00 (10%) applied."
  }
}
```

---

### 4.7. Cancel Order: `POST /api/tools/cancel`

Cancels an order prior to shipment.

**Request Body:**
```json
{
  "order_id": "ORD-5003"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "order_id": "ORD-5003",
    "refund_amount": 129.99,
    "payment_method": "Credit Card ending in 1099",
    "new_status": "CANCELLED",
    "new_resolution_state": "CANCELLED",
    "message": "Order ORD-5003 has been successfully cancelled. Refund of $129.99 processed."
  }
}
```

---

### 4.8. Verify Order State: `GET /api/tools/verify?order_id={id}`

Audits and verifies the post-action state of an order.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "order_id": "ORD-5004",
    "status": "DELIVERED",
    "current_status": "DELIVERED",
    "resolution_state": "REFUND_PROCESSED",
    "is_resolved": true,
    "last_action": {
      "timestamp": "2026-09-12T17:15:00.000Z",
      "action": "PROCESS_REFUND",
      "details": "Processed refund of $249.99 to Credit Card ending in 4242."
    },
    "history_count": 3
  }
}
```

---

### 4.9. Reset World State: `POST /api/tools/reset`

Restores all customer, order, and inventory records back to initial seed data.

---

## 5. Agent Integration Contract

When connecting your AI agent service:

1. Deploy your agent service (Python, FastAPI, LangGraph, etc.) to a publicly accessible URL.
2. In `.env.local` or Vercel Environment Variables, set:
   ```env
   NEXT_PUBLIC_AGENT_API_URL=https://your-agent-service.com
   ```
3. Your agent service must expose an endpoint: `POST /resolve`
   **Request Sent by Frontend:**
   ```json
   {
     "case_id": "CASE-1001",
     "customer_id": "CUST-1001",
     "order_id": "ORD-5004",
     "message": "My SmartWatch Pro (Silver) on order ORD-5004 has a display defect. Can I get a replacement unit sent to me?"
   }
   ```
   **Response Expected by Frontend:**
   ```json
   {
     "trace": [
       {
         "step": 1,
         "type": "decision",
         "description": "Inspecting customer issue and looking up order history",
         "status": "info",
         "timestamp": "2026-09-12T17:15:00.000Z"
       },
       {
         "step": 2,
         "type": "tool_called",
         "description": "Calling get_order(ORD-5004)",
         "status": "success",
         "timestamp": "2026-09-12T17:15:01.000Z",
         "tool_name": "get_order"
       }
     ],
     "response": "Natural language resolution response delivered to customer"
   }
   ```
4. The frontend integration adapter is located at [`src/lib/agentAdapter.ts`](file:///c:/Users/Aritra/Documents/Agenticaihackathon/src/lib/agentAdapter.ts). If your agent API contract changes, update only that file.
