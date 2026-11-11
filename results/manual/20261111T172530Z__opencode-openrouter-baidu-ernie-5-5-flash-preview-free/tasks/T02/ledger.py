import copy


class Ledger:
    def __init__(self):
        self.balances = {}
        self.seen = set()
        self.events = {}

    def balance(self, invoice_id):
        return self.balances.get(invoice_id, 0)

    @staticmethod
    def _validate(event):
        if not isinstance(event, dict):
            raise ValueError("event must be a dict")
        event_id = event.get("event_id")
        invoice_id = event.get("invoice_id")
        kind = event.get("kind")
        cents = event.get("cents")
        if not isinstance(event_id, str) or not event_id.strip():
            raise ValueError("event_id must be a nonempty string")
        if not isinstance(invoice_id, str) or not invoice_id.strip():
            raise ValueError("invoice_id must be a nonempty string")
        if kind not in ("charge", "refund"):
            raise ValueError("kind must be 'charge' or 'refund'")
        if type(cents) is not int or cents <= 0:
            raise ValueError("cents must be a positive integer")
        return event_id, invoice_id, kind, cents

    def apply(self, event):
        event_id, invoice_id, kind, cents = self._validate(event)

        if event_id in self.seen:
            if self.events[event_id] != event:
                raise ValueError("event_id was already used with different contents")
            return self.balance(invoice_id)

        current = self.balance(invoice_id)
        if kind == "refund" and cents > current:
            raise ValueError("refund exceeds the invoice's available balance")

        delta = cents if kind == "charge" else -cents
        self.balances[invoice_id] = current + delta
        self.seen.add(event_id)
        self.events[event_id] = copy.deepcopy(event)
        return self.balances[invoice_id]