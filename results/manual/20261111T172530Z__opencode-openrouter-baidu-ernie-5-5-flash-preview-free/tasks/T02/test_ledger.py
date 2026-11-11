import unittest

from ledger import Ledger


def event(event_id, invoice_id, kind, cents):
    return {
        "event_id": event_id,
        "invoice_id": invoice_id,
        "kind": kind,
        "cents": cents,
    }


class LedgerTests(unittest.TestCase):
    def test_charge_and_refund_update_balance(self):
        ledger = Ledger()
        self.assertEqual(ledger.apply(event("e1", "inv1", "charge", 500)), 500)
        self.assertEqual(ledger.apply(event("e2", "inv1", "refund", 200)), 300)
        self.assertEqual(ledger.balance("inv1"), 300)

    def test_identical_replay_is_idempotent(self):
        ledger = Ledger()
        first = event("e1", "inv1", "charge", 500)
        self.assertEqual(ledger.apply(first), 500)
        self.assertEqual(ledger.apply(dict(first)), 500)
        self.assertEqual(ledger.balance("inv1"), 500)

    def test_conflicting_replay_is_rejected_without_state_change(self):
        ledger = Ledger()
        original = event("e1", "inv1", "charge", 500)
        ledger.apply(original)
        with self.assertRaises(ValueError):
            ledger.apply(event("e1", "inv1", "charge", 600))
        self.assertEqual(ledger.balance("inv1"), 500)
        self.assertNotIn("e2", ledger.seen)
        # The original event is still a valid replay after the rejected conflict.
        self.assertEqual(ledger.apply(dict(original)), 500)

    def test_invalid_amount_and_type_are_rejected_without_registry_change(self):
        ledger = Ledger()
        bad_values = [0, -1, True, False, 1.5, "5", None]
        for index, bad in enumerate(bad_values):
            with self.subTest(cents=bad):
                with self.assertRaises(ValueError):
                    ledger.apply(event(f"bad-{index}", "inv1", "charge", bad))
        self.assertEqual(ledger.balance("inv1"), 0)
        self.assertEqual(ledger.seen, set())
        # The rejected event ID must not be burned; a later valid event may use it.
        self.assertEqual(ledger.apply(event("bad-0", "inv1", "charge", 100)), 100)

    def test_refund_overdraw_is_rejected_and_balance_is_unchanged(self):
        ledger = Ledger()
        ledger.apply(event("e1", "inv1", "charge", 500))
        with self.assertRaises(ValueError):
            ledger.apply(event("e2", "inv1", "refund", 600))
        self.assertEqual(ledger.balance("inv1"), 500)
        self.assertNotIn("e2", ledger.seen)
        self.assertEqual(ledger.apply(event("e3", "inv1", "refund", 200)), 300)

    def test_independent_invoices_do_not_affect_each_other(self):
        ledger = Ledger()
        ledger.apply(event("a1", "invoice-a", "charge", 500))
        ledger.apply(event("b1", "invoice-b", "charge", 100))
        ledger.apply(event("a2", "invoice-a", "refund", 200))
        self.assertEqual(ledger.balance("invoice-a"), 300)
        self.assertEqual(ledger.balance("invoice-b"), 100)
        self.assertEqual(ledger.balance("never-seen"), 0)

    def test_refund_never_goes_below_zero(self):
        ledger = Ledger()
        ledger.apply(event("e1", "inv1", "charge", 500))
        self.assertEqual(ledger.apply(event("e2", "inv1", "refund", 500)), 0)
        with self.assertRaises(ValueError):
            ledger.apply(event("e3", "inv1", "refund", 1))
        self.assertEqual(ledger.balance("inv1"), 0)

    def test_invalid_event_shape_is_rejected(self):
        ledger = Ledger()
        malformed = [
            {},
            {"event_id": "", "invoice_id": "inv1", "kind": "charge", "cents": 100},
            {"event_id": "e1", "invoice_id": "", "kind": "charge", "cents": 100},
            {"event_id": "e1", "invoice_id": "inv1", "kind": "credit", "cents": 100},
            {"event_id": "e1", "invoice_id": "inv1", "kind": "charge"},
            {"event_id": 1, "invoice_id": "inv1", "kind": "charge", "cents": 100},
        ]
        for bad in malformed:
            with self.subTest(event=bad):
                with self.assertRaises(ValueError):
                    ledger.apply(bad)
        self.assertEqual(ledger.balance("inv1"), 0)
        self.assertEqual(ledger.seen, set())


if __name__ == "__main__":
    unittest.main()