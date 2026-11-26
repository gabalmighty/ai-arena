import copy
import unittest

from ledger import Ledger


def event(event_id="e1", invoice_id="inv-1", kind="charge", cents=1000, **extra):
    return {
        "event_id": event_id,
        "invoice_id": invoice_id,
        "kind": kind,
        "cents": cents,
        **extra,
    }


class LedgerTests(unittest.TestCase):
    def test_charge_and_identical_duplicate(self):
        ledger = Ledger()
        charge = event()
        self.assertEqual(ledger.apply(charge), 1000)
        self.assertEqual(ledger.apply(copy.deepcopy(charge)), 1000)
        self.assertEqual(ledger.balance("inv-1"), 1000)
        self.assertEqual(ledger.seen, {"e1"})

    def test_conflicting_replay_rejected_without_effect(self):
        ledger = Ledger()
        ledger.apply(event())
        with self.assertRaises(ValueError):
            ledger.apply(event(cents=900))
        self.assertEqual(ledger.balance("inv-1"), 1000)
        self.assertEqual(ledger.seen, {"e1"})

    def test_event_id_is_global_across_invoices(self):
        ledger = Ledger()
        ledger.apply(event())
        with self.assertRaises(ValueError):
            ledger.apply(event(invoice_id="inv-2"))
        self.assertEqual(ledger.balance("inv-1"), 1000)
        self.assertEqual(ledger.balance("inv-2"), 0)

    def test_invalid_amounts_and_types(self):
        invalid_amounts = (0, -1, True, False, 1.0, "100", None)
        for index, amount in enumerate(invalid_amounts):
            with self.subTest(amount=amount):
                ledger = Ledger()
                with self.assertRaises(ValueError):
                    ledger.apply(event(event_id=f"bad-{index}", cents=amount))
                self.assertEqual(ledger.balance("inv-1"), 0)
                self.assertEqual(ledger.seen, set())

    def test_invalid_event_shape_ids_and_kind(self):
        invalid_events = (
            None,
            {},
            event(event_id=""),
            event(invoice_id=""),
            event(event_id=7),
            event(invoice_id=None),
            event(kind="adjustment"),
        )
        for index, invalid in enumerate(invalid_events):
            with self.subTest(index=index):
                ledger = Ledger()
                with self.assertRaises(ValueError):
                    ledger.apply(invalid)
                self.assertEqual(ledger.balances, {})
                self.assertEqual(ledger.seen, set())

    def test_refund_overdraw_rejected(self):
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.apply(event(kind="refund", cents=1))
        self.assertEqual(ledger.balance("inv-1"), 0)
        self.assertEqual(ledger.seen, set())

    def test_partial_refund_and_exact_zero(self):
        ledger = Ledger()
        ledger.apply(event())
        self.assertEqual(ledger.apply(event("e2", kind="refund", cents=400)), 600)
        self.assertEqual(ledger.apply(event("e3", kind="refund", cents=600)), 0)
        with self.assertRaises(ValueError):
            ledger.apply(event("e4", kind="refund", cents=1))
        self.assertEqual(ledger.balance("inv-1"), 0)

    def test_state_immutable_after_multiple_rejections(self):
        ledger = Ledger()
        ledger.apply(event())
        rejected = (
            event(cents=999),
            event("bad-kind", kind="refund", cents=1001),
            event("bad-type", kind="charge", cents=True),
        )
        for bad in rejected:
            with self.assertRaises(ValueError):
                ledger.apply(bad)
        self.assertEqual(ledger.balances, {"inv-1": 1000})
        self.assertEqual(ledger.seen, {"e1"})

    def test_two_invoices_are_independent(self):
        ledger = Ledger()
        self.assertEqual(ledger.apply(event("a", "inv-a", cents=700)), 700)
        self.assertEqual(ledger.apply(event("b", "inv-b", cents=200)), 200)
        self.assertEqual(ledger.apply(event("c", "inv-a", "refund", 300)), 400)
        self.assertEqual(ledger.balance("inv-a"), 400)
        self.assertEqual(ledger.balance("inv-b"), 200)
        self.assertEqual(ledger.balance("missing"), 0)

    def test_extra_full_event_contents_are_part_of_identity(self):
        ledger = Ledger()
        original = event(metadata={"source": "mobile"})
        ledger.apply(original)
        original["metadata"]["source"] = "web"
        with self.assertRaises(ValueError):
            ledger.apply(original)
        self.assertEqual(ledger.balance("inv-1"), 1000)
        self.assertEqual(ledger.seen, {"e1"})


if __name__ == "__main__":
    unittest.main()
