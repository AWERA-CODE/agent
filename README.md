# Autonomous Customer Resolution Agent — Backend & Tools (Person 1)

This repository contains the backend simulation engine and plain Python toolset for **Track 3: Smart Automation — Problem Statement 5 (Autonomous Customer Resolution Agent)**.

---

## 📁 Repository Architecture

```
.
├── data/
│   ├── customers.json     # Simulated customer profiles & tier metadata
│   ├── orders.json        # Orders data with line items, statuses & history logs
│   ├── inventory.json     # Inventory stock per SKU (includes planted stock-out)
│   └── policy.json        # Return window, refund, and cancellation policies
├── tools.py               # Core Python tools engine for Agent consumption
├── test_tools.py          # Unit test suite verifying tools & failure cases
└── README.md              # Developer documentation & function signatures
```

---

## 🛠️ Function Signatures & Tool Schemas

Every tool in `tools.py` returns a clean Python dictionary (`{"success": True/False, ...}`).
Each function includes a **3-4 word docstring** formatted specifically for automatic LLM tool schema generators (e.g. LangChain, LlamaIndex, OpenAI/Gemini Function Calling).

### 1. `get_customer(customer_id: str) -> dict`
- **Docstring**: `"""Get customer profile details."""`
- **Description**: Retrieves customer info (name, email, phone, VIP tier, past order IDs).
- **Example Call**:
  ```python
  import tools
  customer = tools.get_customer("CUST-1001")
  ```

### 2. `get_order(order_id: str) -> dict`
- **Docstring**: `"""Get order by ID."""`
- **Description**: Retrieves order details including status, items, amounts, shipping info, and full event history.
- **Example Call**:
  ```python
  order = tools.get_order("ORD-5001")
  ```

### 3. `get_customer_orders(customer_id: str) -> dict`
- **Docstring**: `"""Get all customer orders."""`
- **Description**: Helper tool returning a list of all orders belonging to a specific customer ID.
- **Example Call**:
  ```python
  orders_list = tools.get_customer_orders("CUST-1001")
  ```

### 4. `check_inventory(sku: str) -> dict`
- **Docstring**: `"""Check item inventory stock."""`
- **Description**: Checks current stock level and availability for a given SKU.
- **Example Call**:
  ```python
  inv = tools.check_inventory("SKU-WIRELESS-EARBUDS-BLK")
  ```

### 5. `check_policy(order_id: str, action: str) -> dict`
- **Docstring**: `"""Check policy for action."""`
- **Description**: Evaluates corporate policy rules for a proposed `action` (`"REFUND"`, `"REPLACEMENT"`, `"CANCEL"`).
- **Example Call**:
  ```python
  policy_check = tools.check_policy("ORD-5001", "REFUND")
  # Returns: {"success": True, "eligible": True, "reason": "..."}
  ```

### 6. `process_refund(order_id: str, amount: float = None) -> dict`
- **Docstring**: `"""Process an order refund."""`
- **Description**: Executes an order refund, updates order status to `"REFUNDED"`, records resolution state, and appends audit log to history.
- **Example Call**:
  ```python
  result = tools.process_refund("ORD-5001", amount=89.99)
  ```

### 7. `process_replacement(order_id: str, sku: str) -> dict`
- **Docstring**: `"""Process item replacement request."""`
- **Description**: Attempts to process a product replacement for `sku`. Deducts 1 unit from stock if available, or returns a predictable failure dict if out of stock.
- **Example Call**:
  ```python
  result = tools.process_replacement("ORD-5004", "SKU-SMARTWATCH-PRO-SLV")
  ```

### 8. `cancel_order(order_id: str) -> dict`
- **Docstring**: `"""Cancel an active order."""`
- **Description**: Cancels an order if its current status is `PENDING` or `PROCESSING`. Blocked by policy if already `SHIPPED` or `DELIVERED`.
- **Example Call**:
  ```python
  result = tools.cancel_order("ORD-5003")
  ```

### 9. `verify_state(order_id: str) -> dict`
- **Docstring**: `"""Verify current order status."""`
- **Description**: Verification endpoint called by the agent after executing an action to confirm that order status and `resolution_state` actually updated in the database.
- **Example Call**:
  ```python
  state = tools.verify_state("ORD-5001")
  # Returns: {"success": True, "current_status": "REFUNDED", "is_resolved": True, ...}
  ```

### 10. `reset_world() -> dict`
- **Docstring**: `"""Reset data initial state."""`
- **Description**: Resets all JSON datasets back to seed state. Useful between test runs or agent simulation loops.
- **Example Call**:
  ```python
  tools.reset_world()
  ```

---

## 🚨 Planted Failure Case (Replanning Test)

For testing agent adaptiveness and replanning when an action fails:
- **Order ID**: `ORD-5004` (Item: `SKU-SMARTWATCH-PRO-SLV`)
- **Inventory Status**: Quantity in stock is **`0`** (restock date: 2026-10-15).
- **Expected Behavior**: Calling `process_replacement("ORD-5004", "SKU-SMARTWATCH-PRO-SLV")` returns:
  ```json
  {
    "success": false,
    "error": "Replacement failed: SKU 'SKU-SMARTWATCH-PRO-SLV' (SmartWatch Pro (Silver)) is out of stock (quantity: 0).",
    "out_of_stock_sku": "SKU-SMARTWATCH-PRO-SLV",
    "restock_date": "2026-10-15T00:00:00Z"
  }
  ```
- **Agent Action**: The agent must detect this failure, re-evaluate policy, and fall back to offering a **refund** or **alternative SKU**.

---

## 🧪 Running Unit Tests

To run the automated verification suite:
```bash
python test_tools.py
```
