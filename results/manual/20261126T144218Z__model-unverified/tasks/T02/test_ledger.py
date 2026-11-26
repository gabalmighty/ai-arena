"""unittest suite for Ledger (T02). Standard library only."""
import copy
import unittest

from ledger import Ledger


def charge(event_id, invoice_id, cents, **extra):
    e = {"event_id": event_id, "invoice_id": invoice_id, "kind": "charge", "cents": cents}
    e.update(extra)
    return e


def refund(event_id, invoice_id, cents, **extra):
    e = {"event_id": event_id, "invoice_id": invoice_id, "kind": "refund", "cents": cents}
    e.update(extra)
    return e


class LedgerTests(unittest.TestCase):
    def test_charge_increases_balance_and_returns_balance(self):
        led = Ledger()
        self.assertEqual(led.balance("inv1"), 0)
        ret = led.apply(charge("e1", "inv1", 1000))
        self.assertEqual(ret, 1000)
        self.assertEqual(led.balance("inv1"), 1000)
        self.assertEqual(led.apply(charge("e2", "inv1", 500)), 1500)
        self.assertEqual(led.balance("inv1"), 1500)

    def test_duplicate_identical_replay_is_idempotent(self):
        led = Ledger()
        ev = charge("e1", "inv1", 1000)
        led.apply(ev)
        # Replaying the identical full event changes nothing...
        ret = led.apply(copy.deepcopy(ev))
        self.assertEqual(led.balance("inv1"), 1000)
        self.assertEqual(ret, 1000)
        # ...and a later unrelated event proves replay did not re-apply: current balance returned.
        led.apply(charge("e2", "inv1", 500))
        ret2 = led.apply(copy.deepcopy(ev))
        self.assertEqual(ret2, 1500)  # current balance, replay still no-op
        self.assertEqual(led.balance("inv1"), 1500)

    def test_conflicting_replay_same_id_raises_and_preserves_state(self):
        led = Ledger()
        led.apply(charge("e1", "inv1", 1000))
        snap_bal = dict(led.balances)
        snap_seen = _registry_snapshot(led)
        with self.assertRaises(ValueError):
            led.apply(charge("e1", "inv1", 999))          # different contents, same id
        with self.assertRaises(ValueError):
            led.apply(refund("e1", "inv1", 1000))          # different kind, same id
        with self.assertRaises(ValueError):
            led.apply(charge("e1", "inv2", 1000))          # different invoice, same id
        self.assertEqual(led.balances, snap_bal)
        self.assertEqual(_registry_snapshot(led), snap_seen)
        self.assertEqual(led.balance("inv1"), 1000)

    def test_invalid_amount_and_type_rejected_without_state_change(self):
        led = Ledger()
        led.apply(charge("e1", "inv1", 1000))
        snap_bal = dict(led.balances)
        snap_seen = _registry_snapshot(led)
        bad_cents = [0, -1, -100, 1.5, 0.0, "100", "", None, True, False, [100], {"x": 1}]
        for i, cents in enumerate(bad_cents):
            with self.assertRaises(ValueError, msg=f"cents={cents!r} should raise"):
                led.apply(charge(f"bad{i}", "inv1", cents))
            with self.assertRaises(ValueError, msg=f"refund cents={cents!r} should raise"):
                led.apply(refund(f"badr{i}", "inv1", cents))
        # bad kind, empty/non-string ids, missing keys, non-dict event
        with self.assertRaises(ValueError):
            led.apply({"event_id": "x", "invoice_id": "inv1", "kind": "CHARGE", "cents": 100})
        with self.assertRaises(ValueError):
            led.apply({"event_id": "x", "invoice_id": "inv1", "kind": "debit", "cents": 100})
        with self.assertRaises(ValueError):
            led.apply(charge("", "inv1", 100))
        with self.assertRaises(ValueError):
            led.apply(charge("x", "", 100))
        with self.assertRaises(ValueError):
            led.apply(charge(123, "inv1", 100))  # type: ignore[arg-type]
        with self.assertRaises(ValueError):
            led.apply(charge("x", 123, 100))     # type: ignore[arg-type]
        with self.assertRaises(ValueError):
            led.apply({"event_id": "x", "invoice_id": "inv1", "kind": "charge"})  # missing cents
        with self.assertRaises(ValueError):
            led.apply({"invoice_id": "inv1", "kind": "charge", "cents": 100})      # missing event_id
        with self.assertRaises(ValueError):
            led.apply("not a dict")              # type: ignore[arg-type]
        self.assertEqual(led.balances, snap_bal)
        self.assertEqual(_registry_snapshot(led), snap_seen)

    def test_refund_overdraw_rejected_and_never_below_zero(self):
        led = Ledger()
        led.apply(charge("e1", "inv1", 1000))
        led.apply(refund("r1", "inv1", 400))
        self.assertEqual(led.balance("inv1"), 600)
        snap_bal = dict(led.balances)
        snap_seen = _registry_snapshot(led)
        with self.assertRaises(ValueError):
            led.apply(refund("r2", "inv1", 601))   # would exceed unrefunded balance
        with self.assertRaises(ValueError):
            led.apply(refund("r3", "unknown", 1))  # refund on invoice with zero balance
        self.assertEqual(led.balances, snap_bal)
        self.assertEqual(_registry_snapshot(led), snap_seen)
        self.assertEqual(led.balance("inv1"), 600)
        # exactly the remaining balance is allowed -> zero
        self.assertEqual(led.apply(refund("r4", "inv1", 600)), 0)
        self.assertEqual(led.balance("inv1"), 0)
        # a rejected overdraw id is NOT poisoned: reusing it later with valid content works
        led.apply(charge("e9", "inv1", 100))
        self.assertEqual(led.apply(refund("r2", "inv1", 100)), 0)

    def test_state_immutability_after_rejection(self):
        led = Ledger()
        led.apply(charge("e1", "inv1", 1000))
        led.apply(charge("e2", "inv2", 2000))
        snap_bal = dict(led.balances)
        snap_seen = _registry_snapshot(led)
        # invalid event, overdraw, conflicting replay, bad type
        for bad in [
            charge("z1", "inv1", -5),
            refund("z2", "inv1", 99999),
            charge("e1", "inv1", 777),         # conflicting replay of existing id
            charge("z3", "inv1", True),        # bool is not int
            charge("z4", "", 100),
        ]:
            with self.assertRaises(ValueError):
                led.apply(bad)
        self.assertEqual(led.balances, snap_bal)
        self.assertEqual(_registry_snapshot(led), snap_seen)
        # original event still replays as identical no-op afterwards
        self.assertEqual(led.apply(charge("e1", "inv1", 1000)), 1000)
        self.assertEqual(led.balance("inv1"), 1000)
        self.assertEqual(led.balance("inv2"), 2000)

    def test_two_invoices_are_independent(self):
        led = Ledger()
        led.apply(charge("a1", "invA", 1000))
        led.apply(charge("b1", "invB", 2000))
        self.assertEqual(led.balance("invA"), 1000)
        self.assertEqual(led.balance("invB"), 2000)
        led.apply(refund("a2", "invA", 1000))
        self.assertEqual(led.balance("invA"), 0)
        self.assertEqual(led.balance("invB"), 2000)  # unaffected
        # event ids are global across invoices
        with self.assertRaises(ValueError):
            led.apply(charge("b1", "invA", 5))  # 'b1' already used on invB
        self.assertEqual(led.balance("invA"), 0)
        self.assertEqual(led.balance("invB"), 2000)

    def test_input_event_not_mutated_and_registry_unaffected_by_caller_mutation(self):
        led = Ledger()
        ev = charge("e1", "inv1", 1000)
        original = copy.deepcopy(ev)
        led.apply(ev)
        self.assertEqual(ev, original)  # function did not mutate caller's event
        ev["cents"] = 99999             # caller mutates its own dict afterwards
        ev["kind"] = "refund"
        self.assertEqual(led.balance("inv1"), 1000)
        # identical replay uses stored original, not caller-mutated object
        self.assertEqual(led.apply(original), 1000)

    def test_refund_basic_and_exact_amount(self):
        led = Ledger()
        led.apply(charge("e1", "inv1", 1000))
        self.assertEqual(led.apply(refund("r1", "inv1", 250)), 750)
        self.assertEqual(led.balance("inv1"), 750)
        self.assertEqual(led.apply(refund("r2", "inv1", 750)), 0)


def _registry_snapshot(led):
    """Snapshot internal event registry regardless of its concrete type."""
    seen = led.seen
    if isinstance(seen, dict):
        return {k: copy.deepcopy(v) for k, v in seen.items()}
    return {k: None for k in seen}


if __name__ == "__main__":
    unittest.main()
