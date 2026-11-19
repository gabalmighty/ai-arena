"""Tests for the Ledger contract (tasks/T02/ledger.py)."""

import unittest

from ledger import Ledger


def charge(eid, invoice, cents):
    return {"event_id": eid, "invoice_id": invoice, "kind": "charge", "cents": cents}


def refund(eid, invoice, cents):
    return {"event_id": eid, "invoice_id": invoice, "kind": "refund", "cents": cents}


class LedgerTests(unittest.TestCase):
    def test_two_invoices_are_independent(self):
        ledger = Ledger()
        self.assertEqual(ledger.apply(charge("e1", "A", 100)), 100)
        self.assertEqual(ledger.apply(charge("e2", "B", 50)), 50)
        self.assertEqual(ledger.balance("A"), 100)
        self.assertEqual(ledger.balance("B"), 50)
        self.assertEqual(ledger.apply(refund("e3", "A", 30)), 70)
        self.assertEqual(ledger.balance("A"), 70)
        self.assertEqual(ledger.balance("B"), 50)  # unaffected by A's refund

    def test_duplicate_replay_is_idempotent(self):
        ledger = Ledger()
        event = charge("e1", "A", 100)
        first = ledger.apply(event)
        second = ledger.apply(event)  # identical replay
        self.assertEqual(first, second)
        self.assertEqual(ledger.balance("A"), 100)
        # Registry still works: a new event applies, and a replay returns the
        # *current* balance.
        self.assertEqual(ledger.apply(charge("e2", "A", 10)), 110)
        self.assertEqual(ledger.apply(event), 110)

    def test_conflicting_replay_raises(self):
        ledger = Ledger()
        ledger.apply(charge("e1", "A", 100))
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "A", "kind": "charge", "cents": 99})
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "B", "kind": "charge", "cents": 100})
        self.assertEqual(ledger.balance("A"), 100)
        self.assertEqual(ledger.balance("B"), 0)

    def test_invalid_amounts_and_types(self):
        ledger = Ledger()
        for bad in (0, -5, 2.5, True, "10", None):
            with self.assertRaises(ValueError, msg=f"cents={bad!r} must be rejected"):
                ledger.apply(charge("bad-" + repr(bad), "A", bad))
        self.assertEqual(ledger.balance("A"), 0)
        self.assertEqual(ledger.seen, {})

    def test_invalid_kind_ids_and_malformed_events(self):
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "A", "kind": "void", "cents": 10})
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "", "invoice_id": "A", "kind": "charge", "cents": 10})
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "", "kind": "charge", "cents": 10})
        with self.assertRaises(ValueError):
            ledger.apply("not-a-dict")
        with self.assertRaises(ValueError):
            ledger.apply({"event_id": "e1", "invoice_id": "A", "kind": "charge"})  # missing cents
        self.assertEqual(ledger.balance("A"), 0)
        self.assertEqual(ledger.seen, {})

    def test_refund_never_exceeds_charged_balance(self):
        ledger = Ledger()
        ledger.apply(charge("c1", "A", 100))
        with self.assertRaises(ValueError):
            ledger.apply(refund("r1", "A", 101))  # overdraw
        self.assertEqual(ledger.balance("A"), 100)
        self.assertEqual(ledger.apply(refund("r1", "A", 100)), 0)
        with self.assertRaises(ValueError):
            ledger.apply(refund("r2", "A", 1))  # refund at zero balance

    def test_state_immutable_after_rejection(self):
        ledger = Ledger()
        ledger.apply(charge("c1", "A", 100))
        ledger.apply(charge("c2", "A", 50))
        balances_before = dict(ledger.balances)
        seen_before = dict(ledger.seen)
        with self.assertRaises(ValueError):
            ledger.apply(refund("r1", "A", 1000))  # overdraw
        with self.assertRaises(ValueError):
            ledger.apply(charge("", "A", 10))  # invalid id
        self.assertEqual(ledger.balances, balances_before)
        self.assertEqual(ledger.seen, seen_before)
        # The ledger is still usable after rejections.
        self.assertEqual(ledger.apply(refund("r3", "A", 150)), 0)

    def test_charge_accumulates(self):
        ledger = Ledger()
        self.assertEqual(ledger.apply(charge("a", "A", 20)), 20)
        self.assertEqual(ledger.apply(charge("b", "A", 30)), 50)
        self.assertEqual(ledger.balance("missing"), 0)


if __name__ == "__main__":
    unittest.main()
