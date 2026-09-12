"""
Unit test suite for tools.py.
Verifies all data tools, policy checks, state changes, verification endpoint, and planted failure cases.
"""

import unittest
import tools


class TestBackendTools(unittest.TestCase):

    def setUp(self):
        """Reset world data before each test."""
        tools.reset_world()

    def tearDown(self):
        """Clean up world state after each test."""
        tools.reset_world()

    def test_get_customer_success(self):
        res = tools.get_customer("CUST-1001")
        self.assertTrue(res["success"])
        self.assertEqual(res["customer"]["name"], "Alice Smith")
        self.assertEqual(res["customer"]["tier"], "VIP")

    def test_get_customer_not_found(self):
        res = tools.get_customer("CUST-9999")
        self.assertFalse(res["success"])
        self.assertIn("not found", res["error"])

    def test_get_order_success(self):
        res = tools.get_order("ORD-5001")
        self.assertTrue(res["success"])
        self.assertEqual(res["order"]["customer_id"], "CUST-1001")
        self.assertEqual(res["order"]["status"], "DELIVERED")

    def test_get_customer_orders(self):
        res = tools.get_customer_orders("CUST-1001")
        self.assertTrue(res["success"])
        self.assertEqual(len(res["orders"]), 2)

    def test_check_inventory_in_stock(self):
        res = tools.check_inventory("SKU-WIRELESS-EARBUDS-BLK")
        self.assertTrue(res["success"])
        self.assertTrue(res["in_stock"])
        self.assertGreater(res["quantity_in_stock"], 0)

    def test_check_inventory_out_of_stock_planted_failure(self):
        res = tools.check_inventory("SKU-SMARTWATCH-PRO-SLV")
        self.assertTrue(res["success"])
        self.assertFalse(res["in_stock"])
        self.assertEqual(res["quantity_in_stock"], 0)
        self.assertIsNotNone(res["restock_date"])

    def test_check_policy_eligible_refund(self):
        res = tools.check_policy("ORD-5001", "REFUND")
        self.assertTrue(res["success"])
        self.assertTrue(res["eligible"])

    def test_check_policy_expired_refund_window(self):
        res = tools.check_policy("ORD-5002", "REFUND")
        self.assertTrue(res["success"])
        self.assertFalse(res["eligible"])
        self.assertIn("exceeding", res["reason"])

    def test_check_policy_cancel_pending_order(self):
        res = tools.check_policy("ORD-5003", "CANCEL")
        self.assertTrue(res["success"])
        self.assertTrue(res["eligible"])

    def test_check_policy_cancel_shipped_order_blocked(self):
        res = tools.check_policy("ORD-5005", "CANCEL")
        self.assertTrue(res["success"])
        self.assertFalse(res["eligible"])
        self.assertIn("cannot be cancelled", res["reason"])

    def test_process_refund_and_verify(self):
        res = tools.process_refund("ORD-5001", 89.99)
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "REFUNDED")

        # Verify state endpoint
        verification = tools.verify_state("ORD-5001")
        self.assertTrue(verification["success"])
        self.assertEqual(verification["current_status"], "REFUNDED")
        self.assertEqual(verification["resolution_state"], "REFUNDED")
        self.assertTrue(verification["is_resolved"])

    def test_process_replacement_planted_failure_case(self):
        """Test planted out-of-stock failure case for SKU-SMARTWATCH-PRO-SLV."""
        res = tools.process_replacement("ORD-5004", "SKU-SMARTWATCH-PRO-SLV")
        self.assertFalse(res["success"])
        self.assertIn("out of stock", res["error"])

        # Order state should remain UNRESOLVED
        verification = tools.verify_state("ORD-5004")
        self.assertFalse(verification["is_resolved"])
        self.assertEqual(verification["current_status"], "DELIVERED")

    def test_process_replacement_success(self):
        res = tools.process_replacement("ORD-5001", "SKU-WIRELESS-EARBUDS-WHT")
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "REPLACED")

        verification = tools.verify_state("ORD-5001")
        self.assertTrue(verification["is_resolved"])
        self.assertEqual(verification["resolution_state"], "REPLACED")

    def test_cancel_order_success(self):
        res = tools.cancel_order("ORD-5003")
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "CANCELLED")

        verification = tools.verify_state("ORD-5003")
        self.assertTrue(verification["is_resolved"])
        self.assertEqual(verification["current_status"], "CANCELLED")

    def test_cancel_order_blocked(self):
        res = tools.cancel_order("ORD-5005")
        self.assertFalse(res["success"])
        self.assertIn("blocked by policy", res["error"])

    def test_reset_world(self):
        # Mutate order
        tools.process_refund("ORD-5001", 89.99)
        self.assertEqual(tools.verify_state("ORD-5001")["resolution_state"], "REFUNDED")

        # Reset
        res = tools.reset_world()
        self.assertTrue(res["success"])
        self.assertEqual(tools.verify_state("ORD-5001")["resolution_state"], "NONE")


if __name__ == "__main__":
    unittest.main(verbosity=2)
