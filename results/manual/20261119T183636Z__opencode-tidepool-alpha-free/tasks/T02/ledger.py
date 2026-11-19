"""Ledger: idempotent application of charge/refund events per invoice.

Standard library only. Public API: Ledger(), apply(event) -> int, balance(invoice_id) -> int.
"""


def _validate_event(event):
    if not isinstance(event, dict):
        raise ValueError("event must be a dict")
    for key in ("event_id", "invoice_id"):
        value = event.get(key)
        if not isinstance(value, str) or value == "":
            raise ValueError("event field %r must be a nonempty string" % key)
    if event.get("kind") not in ("charge", "refund"):
        raise ValueError("event field 'kind' must be 'charge' or 'refund'")
    cents = event.get("cents")
    if isinstance(cents, bool) or not isinstance(cents, int) or cents <= 0:
        raise ValueError("event field 'cents' must be a positive integer")


def _event_signature(event):
    """Canonical signature of the event's full content (excluding event_id)."""
    return tuple(sorted((repr(k), repr(v)) for k, v in event.items() if k != "event_id"))


class Ledger:
    def __init__(self):
        self.balances = {}
        self.seen = {}  # event_id -> signature of the applied event

    def balance(self, invoice_id):
        return self.balances.get(invoice_id, 0)

    def apply(self, event):
        _validate_event(event)
        event_id = event["event_id"]
        signature = _event_signature(event)
        if event_id in self.seen:
            if self.seen[event_id] != signature:
                raise ValueError("event_id reused with different contents: " + event_id)
            # Identical replay: no state changes; return the current balance.
            return self.balance(event["invoice_id"])
        invoice_id = event["invoice_id"]
        if event["kind"] == "refund" and event["cents"] > self.balance(invoice_id):
            raise ValueError("refund exceeds the charged balance of invoice " + invoice_id)
        delta = event["cents"] if event["kind"] == "charge" else -event["cents"]
        new_balance = self.balance(invoice_id) + delta
        self.balances[invoice_id] = new_balance
        self.seen[event_id] = signature
        return new_balance
