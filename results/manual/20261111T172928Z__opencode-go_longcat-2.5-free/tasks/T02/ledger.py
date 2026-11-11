class Ledger:
    def __init__(self):
        self.balances = {}
        self.seen = set()

    def balance(self, invoice_id):
        return self.balances.get(invoice_id, 0)

    def apply(self, event):
        if event["event_id"] in self.seen:
            return self.balance(event["invoice_id"])
        self.seen.add(event["event_id"])
        delta = event["cents"] if event["kind"] == "charge" else -event["cents"]
        self.balances[event["invoice_id"]] = self.balance(event["invoice_id"]) + delta
        return self.balances[event["invoice_id"]]
