"""Ledger with strict validation, global event-id idempotency and overdraft safety.

Public interface (unchanged): Ledger(), apply(event) -> int, balance(invoice_id) -> int.
Standard library only.
"""


class Ledger:
    def __init__(self):
        self.balances = {}
        # event_id -> canonical fingerprint of the full event, so a replay with
        # different contents can be distinguished from an identical replay.
        self.seen = {}

    def balance(self, invoice_id):
        return self.balances.get(invoice_id, 0)

    def _validate(self, event):
        """Return a canonical, hashable fingerprint, or raise ValueError.

        Validation is performed in full before any state is mutated.
        """
        if not isinstance(event, dict):
            raise ValueError("event must be a dictionary")

        event_id = event.get("event_id")
        invoice_id = event.get("invoice_id")
        kind = event.get("kind")
        cents = event.get("cents")

        if not isinstance(event_id, str) or not event_id:
            raise ValueError("event_id must be a nonempty string")
        if not isinstance(invoice_id, str) or not invoice_id:
            raise ValueError("invoice_id must be a nonempty string")
        if kind not in ("charge", "refund"):
            raise ValueError("kind must be 'charge' or 'refund'")
        # bool is a subclass of int in Python; exclude it explicitly.
        if type(cents) is not int or cents <= 0:
            raise ValueError("cents must be a positive integer (bool is not allowed)")

        # Fingerprint every field so any change to the event content is detected.
        # repr() keeps values hashable even if an unexpected extra key is present.
        fingerprint = tuple(sorted((str(k), repr(v)) for k, v in event.items()))
        return event_id, invoice_id, kind, cents, fingerprint

    def apply(self, event):
        event_id, invoice_id, kind, cents, fingerprint = self._validate(event)

        if event_id in self.seen:
            if self.seen[event_id] != fingerprint:
                raise ValueError("event_id reused with different contents")
            # Identical replay: no state change, current balance returned.
            return self.balance(invoice_id)

        current = self.balance(invoice_id)
        if kind == "refund" and cents > current:
            raise ValueError("refund exceeds the available unrefunded balance")

        # All checks passed; only now mutate state.
        self.seen[event_id] = fingerprint
        new_balance = current + cents if kind == "charge" else current - cents
        self.balances[invoice_id] = new_balance
        return new_balance
