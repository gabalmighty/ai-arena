"""T02 tests for the Ledger contract.

NOTE: Python 3 is not installed on this host (only the Microsoft Store alias
stubs are present), so this suite was NOT executed. It is preserved as the
intended discriminating test set. Expected against the preserved defective
starter: several cases fail (bool accepted, refund overdraw allowed, conflicting
replay silently ignored, invalid kinds/ids accepted).
"""

import unittest

from ledger import Ledger


def charge(event_id, invoice_id, cents):
    return {"event_id": event_id, "invoice_id": invoice_id, "kind": "charge", "cents": cents}


def refund(event_id, invoice_id, cents):
    return {"event_id": event_id, "invoice_id": invoice_id, "kind": "refund", "cents": cents}


class LedgerTests(unittest.TestCase):
    def test_charge_increases_balance(self):
        ledger = Ledger()
        self.assertEqual(ledger.apply(charge("e1", "inv1", 1000)), 1000)
        self.assertEqual(ledger.balance("inv1"), 1000)

    def test_refund_decreases_balance(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        self.assertEqual(ledger.apply(refund("e2", "inv1", 300)), 700)
        self.assertEqual(ledger.balance("inv1"), 700)

    def test_replay_identical_event_is_noop_and_returns_current_balance(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        ledger.apply(refund("e2", "inv1", 250))
        before = dict(ledger.balances)
        self.assertEqual(ledger.apply(charge("e1", "inv1", 1000)), 750)
        self.assertEqual(ledger.balance("inv1"), 750)
        self.assertEqual(ledger.balances, before)

    def test_conflicting_replay_same_id_different_contents_raises(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        with self.assertRaises(ValueError):
            ledger.apply(charge("e1", "inv1", 999))
        # registry and balance unchanged by the rejected conflicting replay
        self.assertEqual(ledger.balance("inv1"), 1000)
        self.assertEqual(ledger.seen, {"e1"})

    def test_invalid_amount_zero_or_negative_raises_without_state_change(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        before = dict(ledger.balances)
        for bad in (0, -5):
            with self.assertRaises(ValueError):
                ledger.apply(charge("e2", "inv1", bad))
        self.assertEqual(ledger.balances, before)
        self.assertEqual(ledger.seen, {"e1"})

    def test_bool_is_not_accepted_as_integer(self):
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.apply(charge("e1", "inv1", True))

    def test_non_integer_kind_raises(self):
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "inv1", "kind": "transfer", "cents": 10})

    def test_missing_required_keys_raise(self):
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "inv1", "kind": "charge"})

    def test_empty_string_ids_rejected(self):
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.apply(charge("", "inv1", 10))
        with self.assertRaises(ValueError):
            ledger.apply(charge("e1", "", 10))

    def test_refund_overdraw_rejected_and_state_unchanged(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        before = dict(ledger.balances)
        with self.assertRaises(ValueError):
            ledger.apply(refund("e2", "inv1", 1001))
        self.assertEqual(ledger.balances, before)
        self.assertEqual(ledger.seen, {"e1"})

    def test_refund_up_to_full_balance_allowed(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        self.assertEqual(ledger.apply(refund("e2", "inv1", 1000)), 0)

    def test_independent_invoices_do_not_affect_each_other(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "inv1", 1000))
        ledger.apply(charge("e2", "inv2", 500))
        ledger.apply(refund("e3", "inv1", 200))
        self.assertEqual(ledger.balance("inv1"), 800)
        self.assertEqual(ledger.balance("inv2"), 500)
        self.assertEqual(ledger.balance("inv3"), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
