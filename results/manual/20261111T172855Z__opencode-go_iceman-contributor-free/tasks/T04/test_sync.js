const test = require("node:test");
const assert = require("node:assert/strict");
const { planSync } = require("./sync.js");

function clone(x) { return JSON.parse(JSON.stringify(x)); }

test("dedup keeps last operation per ID and preserves order of last occurrences across IDs", () => {
  const server = [];
  const pending = [
    { id: "a", baseVersion: 0, op: "upsert", value: 1 },
    { id: "b", baseVersion: 0, op: "upsert", value: 1 },
    { id: "a", baseVersion: 0, op: "delete" },
    { id: "c", baseVersion: 0, op: "upsert", value: 3 },
    { id: "b", baseVersion: 0, op: "upsert", value: 2 },
  ];
  const plan = planSync(server, pending);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.uploads.map(u => [u.id, u.op, u.value]), [
    ["a", "delete", undefined],
    ["c", "upsert", 3],
    ["b", "upsert", 2],
  ]);
  assert.ok(!("value" in plan.uploads[0]));
});

test("version conflict does not upload", () => {
  const server = [{ id: "a", version: 2, value: "s", deleted: false }];
  const pending = [{ id: "a", baseVersion: 1, op: "upsert", value: "p" }];
  const plan = planSync(server, pending);
  assert.deepEqual(plan.uploads, []);
  assert.deepEqual(plan.conflicts, [{ id: "a", baseVersion: 1, serverVersion: 2 }]);
});

test("stale attempt against deleted server record is conflict", () => {
  const server = [{ id: "a", version: 3, value: null, deleted: true }];
  const pending = [{ id: "a", baseVersion: 2, op: "upsert", value: "revive" }];
  const plan = planSync(server, pending);
  assert.deepEqual(plan.uploads, []);
  assert.deepEqual(plan.conflicts, [{ id: "a", baseVersion: 2, serverVersion: 3 }]);
});

test("new item uploads when baseVersion matches absent server (0)", () => {
  const plan = planSync([], [{ id: "n", baseVersion: 0, op: "upsert", value: { x: 1 } }]);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.uploads, [{ id: "n", op: "upsert", value: { x: 1 } }]);
});

test("empty queue/inputs return empty plan", () => {
  assert.deepEqual(planSync([], []), { uploads: [], conflicts: [] });
  assert.deepEqual(planSync([{ id: "a", version: 1, value: 1, deleted: false }], []), { uploads: [], conflicts: [] });
});

test("does not mutate inputs and fails explicitly on malformed records", () => {
  const server = [{ id: "a", version: 1, value: 1, deleted: false }];
  const pending = [{ id: "a", baseVersion: 1, op: "upsert", value: 2 }];
  const s0 = clone(server), p0 = clone(pending);
  planSync(server, pending);
  assert.deepEqual(server, s0);
  assert.deepEqual(pending, p0);

  assert.throws(() => planSync([{ id: "a", version: 1, value: 1, deleted: false }, { id: "a", version: 2, value: 2, deleted: false }], []), /duplicate/);
  assert.throws(() => planSync([{ id: "a", version: -1, value: 1, deleted: false }], []), /version/);
  assert.throws(() => planSync([], [{ id: "a", baseVersion: 0, op: "upsert" }]), /value/);
  assert.throws(() => planSync("bad", []), /array/);
});
