import copy


class Ledger:
    def __init__(self):
        self.balances = {}
        self.seen = set()
        self._events = {}

    def balance(self, invoice_id):
        return self.balances.get(invoice_id, 0)

    def apply(self, event):
        if not isinstance(event, dict):
            raise ValueError("event must be a dictionary")

        required = ("event_id", "invoice_id", "kind", "cents")
        if any(key not in event for key in required):
            raise ValueError("event is missing a required field")

        event_id = event["event_id"]
        invoice_id = event["invoice_id"]
        kind = event["kind"]
        cents = event["cents"]
        if not isinstance(event_id, str) or not event_id:
            raise ValueError("event_id must be a nonempty string")
        if not isinstance(invoice_id, str) or not invoice_id:
            raise ValueError("invoice_id must be a nonempty string")
        if kind not in ("charge", "refund"):
            raise ValueError("kind must be 'charge' or 'refund'")
        if type(cents) is not int or cents <= 0:
            raise ValueError("cents must be a positive integer (not bool)")

        try:
            snapshot = copy.deepcopy(event)
        except Exception as exc:
            raise ValueError("event contents must be copyable") from exc

        if event_id in self.seen:
            try:
                identical = self._events[event_id] == snapshot
            except Exception:
                identical = False
            if identical:
                return self.balance(invoice_id)
            raise ValueError("event_id was already used with different contents")

        current = self.balance(invoice_id)
        if kind == "refund" and cents > current:
            raise ValueError("refund exceeds the invoice's unrefunded balance")

        updated = current + cents if kind == "charge" else current - cents
        self.balances[invoice_id] = updated
        self._events[event_id] = snapshot
        self.seen.add(event_id)
        return updated
