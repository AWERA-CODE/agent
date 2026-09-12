"""
Backend tools for the Autonomous Customer Resolution Agent.
Simulates enterprise APIs: Customer DB, Order API, Inventory API, Policy Rules Engine, and Verification Endpoint.
"""

import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

CUSTOMERS_FILE = os.path.join(DATA_DIR, "customers.json")
ORDERS_FILE = os.path.join(DATA_DIR, "orders.json")
INVENTORY_FILE = os.path.join(DATA_DIR, "inventory.json")
POLICY_FILE = os.path.join(DATA_DIR, "policy.json")

# Backup store for resetting state
_SEED_CACHE = {}


def _ensure_seed_cache():
    """Cache initial state for reset_world capability."""
    global _SEED_CACHE
    if not _SEED_CACHE:
        _SEED_CACHE = {
            "customers": _read_file(CUSTOMERS_FILE),
            "orders": _read_file(ORDERS_FILE),
            "inventory": _read_file(INVENTORY_FILE),
            "policy": _read_file(POLICY_FILE),
        }


def _read_file(file_path: str):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_file(file_path: str, data):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def reset_world() -> dict:
    """Reset data initial state."""
    _ensure_seed_cache()
    _write_file(CUSTOMERS_FILE, _SEED_CACHE["customers"])
    _write_file(ORDERS_FILE, _SEED_CACHE["orders"])
    _write_file(INVENTORY_FILE, _SEED_CACHE["inventory"])
    _write_file(POLICY_FILE, _SEED_CACHE["policy"])
    return {
        "success": True,
        "message": "World data successfully reset to initial seed state.",
    }


def get_customer(customer_id: str) -> dict:
    """Get customer profile details."""
    customers = _read_file(CUSTOMERS_FILE)
    for cust in customers:
        if cust["customer_id"] == customer_id:
            return {"success": True, "customer": cust}
    return {
        "success": False,
        "error": f"Customer ID '{customer_id}' not found.",
    }


def get_order(order_id: str) -> dict:
    """Get order by ID."""
    orders = _read_file(ORDERS_FILE)
    for order in orders:
        if order["order_id"] == order_id:
            return {"success": True, "order": order}
    return {
        "success": False,
        "error": f"Order ID '{order_id}' not found.",
    }


def get_customer_orders(customer_id: str) -> dict:
    """Get all customer orders."""
    orders = _read_file(ORDERS_FILE)
    cust_orders = [o for o in orders if o["customer_id"] == customer_id]
    return {"success": True, "customer_id": customer_id, "orders": cust_orders}


def check_inventory(sku: str) -> dict:
    """Check item inventory stock."""
    inventory = _read_file(INVENTORY_FILE)
    for item in inventory:
        if item["sku"] == sku:
            in_stock = item["quantity_in_stock"] > 0
            return {
                "success": True,
                "sku": sku,
                "item_name": item["item_name"],
                "quantity_in_stock": item["quantity_in_stock"],
                "in_stock": in_stock,
                "restock_date": item.get("restock_date"),
            }
    return {
        "success": False,
        "error": f"SKU '{sku}' not found in inventory.",
    }


def check_policy(order_id: str, action: str) -> dict:
    """Check policy for action."""
    order_res = get_order(order_id)
    if not order_res["success"]:
        return order_res

    order = order_res["order"]
    policy = _read_file(POLICY_FILE)
    action_upper = action.strip().upper()

    now = datetime.now(timezone.utc)

    # Calculate days since delivery if delivered
    days_since_delivery = None
    if order.get("delivery_date"):
        deliv_dt = datetime.fromisoformat(order["delivery_date"].replace("Z", "+00:00"))
        days_since_delivery = (now - deliv_dt).days

    if action_upper == "REFUND":
        return_window = policy["return_policy"]["return_window_days"]
        max_refund = policy["refund_policy"]["max_auto_refund_amount"]

        if days_since_delivery is not None and days_since_delivery > return_window:
            return {
                "success": True,
                "eligible": False,
                "reason": f"Order delivery date was {days_since_delivery} days ago, exceeding the {return_window}-day return window.",
            }

        if order["total_amount"] > max_refund:
            return {
                "success": True,
                "eligible": False,
                "reason": f"Order amount (${order['total_amount']:.2f}) exceeds max auto-refund limit of ${max_refund:.2f}.",
            }

        return {
            "success": True,
            "eligible": True,
            "reason": "Refund action is permitted under company policy.",
        }

    elif action_upper == "REPLACEMENT":
        return_window = policy["return_policy"]["return_window_days"]

        if days_since_delivery is not None and days_since_delivery > return_window:
            return {
                "success": True,
                "eligible": False,
                "reason": f"Order delivery date was {days_since_delivery} days ago, exceeding the {return_window}-day replacement window.",
            }

        # Check item inventory for order items
        skus_checked = []
        for item in order.get("items", []):
            inv = check_inventory(item["sku"])
            skus_checked.append(inv)
            if not inv.get("in_stock", False):
                return {
                    "success": True,
                    "eligible": False,
                    "reason": f"Replacement item SKU '{item['sku']}' is currently out of stock.",
                    "inventory_details": inv,
                }

        return {
            "success": True,
            "eligible": True,
            "reason": "Replacement action is permitted and stock is available.",
        }

    elif action_upper == "CANCEL":
        allowed = policy["cancellation_policy"]["allowed_statuses"]
        if order["status"] in allowed:
            return {
                "success": True,
                "eligible": True,
                "reason": f"Order status '{order['status']}' is eligible for cancellation.",
            }
        else:
            return {
                "success": True,
                "eligible": False,
                "reason": f"Order status '{order['status']}' cannot be cancelled. Cancellation is only allowed for statuses: {allowed}.",
            }

    return {
        "success": False,
        "error": f"Unknown policy action '{action}'. Valid actions are REFUND, REPLACEMENT, CANCEL.",
    }


def process_refund(order_id: str, amount: float = None) -> dict:
    """Process an order refund."""
    orders = _read_file(ORDERS_FILE)
    target_index = -1
    target_order = None

    for i, order in enumerate(orders):
        if order["order_id"] == order_id:
            target_index = i
            target_order = order
            break

    if target_order is None:
        return {"success": False, "error": f"Order ID '{order_id}' not found."}

    refund_amount = amount if amount is not None else target_order["total_amount"]

    if target_order["status"] == "REFUNDED":
        return {
            "success": False,
            "error": f"Order '{order_id}' has already been refunded.",
        }

    # Execute refund
    timestamp = datetime.now(timezone.utc).isoformat()
    target_order["status"] = "REFUNDED"
    target_order["resolution_state"] = "REFUNDED"
    target_order["refund_amount"] = refund_amount
    target_order["history"].append({
        "timestamp": timestamp,
        "action": "PROCESS_REFUND",
        "details": f"Processed refund of ${refund_amount:.2f}",
    })

    orders[target_index] = target_order
    _write_file(ORDERS_FILE, orders)

    return {
        "success": True,
        "order_id": order_id,
        "refund_amount": refund_amount,
        "status": "REFUNDED",
        "message": f"Refund of ${refund_amount:.2f} successfully processed for order {order_id}.",
    }


def process_replacement(order_id: str, sku: str) -> dict:
    """Process item replacement request."""
    orders = _read_file(ORDERS_FILE)
    target_index = -1
    target_order = None

    for i, order in enumerate(orders):
        if order["order_id"] == order_id:
            target_index = i
            target_order = order
            break

    if target_order is None:
        return {"success": False, "error": f"Order ID '{order_id}' not found."}

    # Check inventory stock for requested SKU
    inv = check_inventory(sku)
    if not inv["success"]:
        return inv

    if not inv["in_stock"]:
        # Planted failure case triggered!
        return {
            "success": False,
            "error": f"Replacement failed: SKU '{sku}' ({inv['item_name']}) is out of stock (quantity: 0).",
            "out_of_stock_sku": sku,
            "restock_date": inv.get("restock_date"),
        }

    # Deduct 1 item from inventory
    inventory = _read_file(INVENTORY_FILE)
    for item in inventory:
        if item["sku"] == sku:
            item["quantity_in_stock"] -= 1
            break
    _write_file(INVENTORY_FILE, inventory)

    # Execute replacement on order
    timestamp = datetime.now(timezone.utc).isoformat()
    target_order["status"] = "REPLACED"
    target_order["resolution_state"] = "REPLACED"
    target_order["replacement_sku"] = sku
    target_order["history"].append({
        "timestamp": timestamp,
        "action": "PROCESS_REPLACEMENT",
        "details": f"Replacement unit ordered for SKU '{sku}'",
    })

    orders[target_index] = target_order
    _write_file(ORDERS_FILE, orders)

    return {
        "success": True,
        "order_id": order_id,
        "replacement_sku": sku,
        "status": "REPLACED",
        "message": f"Replacement for SKU '{sku}' successfully created for order {order_id}.",
    }


def cancel_order(order_id: str) -> dict:
    """Cancel an active order."""
    orders = _read_file(ORDERS_FILE)
    target_index = -1
    target_order = None

    for i, order in enumerate(orders):
        if order["order_id"] == order_id:
            target_index = i
            target_order = order
            break

    if target_order is None:
        return {"success": False, "error": f"Order ID '{order_id}' not found."}

    # Check policy for cancellation
    pol_check = check_policy(order_id, "CANCEL")
    if not pol_check.get("eligible", False):
        return {
            "success": False,
            "error": f"Cancellation blocked by policy: {pol_check.get('reason')}",
        }

    # Execute cancellation
    timestamp = datetime.now(timezone.utc).isoformat()
    target_order["status"] = "CANCELLED"
    target_order["resolution_state"] = "CANCELLED"
    target_order["history"].append({
        "timestamp": timestamp,
        "action": "CANCEL_ORDER",
        "details": "Order cancelled successfully prior to shipping.",
    })

    orders[target_index] = target_order
    _write_file(ORDERS_FILE, orders)

    return {
        "success": True,
        "order_id": order_id,
        "status": "CANCELLED",
        "message": f"Order {order_id} has been successfully cancelled.",
    }


def verify_state(order_id: str) -> dict:
    """Verify current order status."""
    order_res = get_order(order_id)
    if not order_res["success"]:
        return order_res

    order = order_res["order"]
    is_resolved = order["resolution_state"] in ["REFUNDED", "REPLACED", "CANCELLED"]

    return {
        "success": True,
        "order_id": order_id,
        "current_status": order["status"],
        "resolution_state": order["resolution_state"],
        "is_resolved": is_resolved,
        "items": order["items"],
        "total_amount": order["total_amount"],
        "history": order["history"],
    }


# Ensure seed cache is populated on module load
_ensure_seed_cache()
