"""Tests for the Ledger contract. Run: py -3 -m unittest -v"""
import unittest

from ledger import Ledger


def ev(eid, inv, kind, cents):
    return {"event_id": eid, "invoice_id": inv, "kind": kind, "cents": cents}


class TestLedger(unittest.TestCase):
    def test_01_charge_increases_balance(self):
        led = Ledger()
        self.assertEqual(led.apply(ev("e1", "INV-1", "charge", 1000)), 1000)
        self.assertEqual(led.balance("INV-1"), 1000)

    def test_02_refund_decreases_balance(self):
        led = Ledger()
        led.apply(ev("e1", "INV-1", "charge", 1000))
        self.assertEqual(led.apply(ev("e2", "INV-1", "refund", 400)), 600)
        self.assertEqual(led.balance("INV-1"), 600)

    def test_03_duplicate_identical_replay_is_noop(self):
        led = Ledger()
        led.apply(ev("e1", "INV-1", "charge", 1000))
        before = dict(led.balances)
        self.assertEqual(led.apply(ev("e1", "INV-1", "charge", 1000)), 1000)
        self.assertEqual(led.balances, before)

    def test_04_conflicting_replay_raises_value_error(self):
        led = Ledger()
        led.apply(ev("e1", "INV-1", "charge", 1000))
        before = dict(led.balances)
        with self.assertRaises(ValueError):
            led.apply(ev("e1", "INV-1", "charge", 9999))
        self.assertEqual(led.balances, before)
        self.assertEqual(led.balance("INV-1"), 1000)

    def test_05_invalid_cents_zero_and_negative(self):
        led = Ledger()
        for bad in (0, -5):
            with self.assertRaises(ValueError):
                led.apply(ev("bad-" + str(bad), "INV-1", "charge", bad))
        self.assertEqual(led.balances, {})

    def test_06_bool_and_string_cents_rejected(self):
        led = Ledger()
        with self.assertRaises(ValueError):
            led.apply(ev("b", "INV-1", "charge", True))
        with self.assertRaises(ValueError):
            led.apply(ev("s", "INV-1", "charge", "100"))
        self.assertEqual(led.balances, {})

    def test_07_refund_overdraw_rejected_without_mutation(self):
        led = Ledger()
        led.apply(ev("e1", "INV-1", "charge", 500))
        before = dict(led.balances)
        with self.assertRaises(ValueError):
            led.apply(ev("e2", "INV-1", "refund", 501))
        self.assertEqual(led.balances, before)
        self.assertEqual(led.balance("INV-1"), 500)

    def test_08_rejected_event_does_not_register_id(self):
        led = Ledger()
        with self.assertRaises(ValueError):
            led.apply(ev("e1", "INV-1", "refund", 100))
        self.assertNotIn("e1", getattr(led, "seen", {}))
        # The same id must still be usable for a valid event.
        self.assertEqual(led.apply(ev("e1", "INV-1", "charge", 100)), 100)

    def test_09_two_invoices_are_independent(self):
        led = Ledger()
        led.apply(ev("e1", "A", "charge", 1000))
        led.apply(ev("e2", "B", "charge", 250))
        self.assertEqual(led.balance("A"), 1000)
        self.assertEqual(led.balance("B"), 250)
        led.apply(ev("e3", "A", "refund", 1000))
        self.assertEqual(led.balance("A"), 0)
        self.assertEqual(led.balance("B"), 250)

    def test_10_invalid_kind_and_ids_rejected(self):
        led = Ledger()
        with self.assertRaises(ValueError):
            led.apply(ev("e1", "INV-1", "credit", 100))
        with self.assertRaises(ValueError):
            led.apply(ev("", "INV-1", "charge", 100))
        with self.assertRaises(ValueError):
            led.apply(ev("e2", "", "charge", 100))
        self.assertEqual(led.balances, {})


if __name__ == "__main__":
    unittest.main()
