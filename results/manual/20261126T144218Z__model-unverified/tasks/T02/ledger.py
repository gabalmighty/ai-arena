"""Idempotent, state-safe invoice ledger (T02). Python standard library only.

Public interface preserved: Ledger(), apply(event) -> int, balance(invoice_id) -> int.

Contract:
- event is a dict with event_id and invoice_id nonempty strings, kind "charge"|"refund",
  cents a positive integer (bool is NOT accepted).
- One event_id is processed once globally. Replaying an identical full event is a no-op
  returning the current balance for that invoice; reusing the id with different
  contents raises ValueError.
- Refund may not exceed the invoice's currently charged, unrefunded balance.
- Rejected/invalid events raise ValueError without changing any balance or the
  event registry.
- Independent invoices cannot affect one another; balance never goes below zero.
"""
import copy

_REQUIRED_KEYS = ("event_id", "invoice_id", "kind", "cents")
_KINDS = ("charge", "refund")


def _validate_event(event):
    """Return a deep copy of event; raise ValueError on any contract violation.

    Pure: performs no mutation and touches no Ledger state.
    """
    if not isinstance(event, dict):
        raise ValueError("event must be a dictionary")
    for key in _REQUIRED_KEYS:
        if key not in event:
            raise ValueError("event missing required key: %s" % key)
    event_id = event["event_id"]
    invoice_id = event["invoice_id"]
    kind = event["kind"]
    cents = event["cents"]
    if not isinstance(event_id, str) or event_id == "":
        raise ValueError("event_id must be a nonempty string")
    if not isinstance(invoice_id, str) or invoice_id == "":
        raise ValueError("invoice_id must be a nonempty string")
    if kind not in _KINDS:
        raise ValueError("kind must be 'charge' or 'refund'")
    if isinstance(cents, bool) or not isinstance(cents, int):
        raise ValueError("cents must be an integer (bool is not accepted)")
    if cents <= 0:
        raise ValueError("cents must be a positive integer")
    return copy.deepcopy(event)


class Ledger:
    def __init__(self):
        self.balances = {}
        self.seen = {}  # event_id -> stored full event (defensive copy); global once-only

    def balance(self, invoice_id):
        return self.balances.get(invoice_id, 0)

    def apply(self, event):
        # 1) Validate fully BEFORE touching state. Raises ValueError; no mutation.
        ev = _validate_event(event)
        event_id = ev["event_id"]
        invoice_id = ev["invoice_id"]
        kind = ev["kind"]
        cents = ev["cents"]

        # 2) Global once-only event id.
        if event_id in self.seen:
            if self.seen[event_id] != ev:
                # same id, different contents -> reject; state unchanged
                raise ValueError("event_id already used with different contents: %s" % event_id)
            # identical full event replay -> no-op; return CURRENT balance for that invoice
            return self.balance(invoice_id)

        current = self.balance(invoice_id)

        # 3) Refund cannot exceed currently charged, unrefunded balance.
        if kind == "refund" and cents > current:
            raise ValueError("refund exceeds current unrefunded balance")  # no state change

        # 4) Apply. All checks already passed; nothing below raises.
        new_balance = current + cents if kind == "charge" else current - cents
        if new_balance < 0:  # defensive; cannot happen given step 3
            raise ValueError("balance would go negative")
        self.balances[invoice_id] = new_balance
        self.seen[event_id] = ev  # store defensive copy; caller mutation can't corrupt registry
        return new_balance
