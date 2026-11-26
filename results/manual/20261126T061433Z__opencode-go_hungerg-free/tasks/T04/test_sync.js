const test = require('node:test');
const assert = require('node:assert/strict');
const { planSync } = require('./sync');

function server(id, version, value = id, deleted = false) {
  return { id, version, value, deleted };
}

function pending(id, baseVersion, op = 'upsert', value = id) {
  return op === 'delete' ? { id, baseVersion, op } : { id, baseVersion, op, value };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('last pending operation wins and last-occurrence order is preserved', () => {
  const result = planSync([], [
    pending('a', 0, 'upsert', 'old-a'),
    pending('b', 0, 'upsert', 'old-b'),
    pending('a', 0, 'upsert', 'new-a'),
    pending('c', 0, 'upsert', 'new-c'),
    pending('b', 0, 'delete'),
  ]);
  assert.deepEqual(result, {
    uploads: [
      { id: 'a', op: 'upsert', value: 'new-a' },
      { id: 'c', op: 'upsert', value: 'new-c' },
      { id: 'b', op: 'delete' },
    ],
    conflicts: [],
  });
});

test('version conflict suppresses upload and reports both versions', () => {
  const result = planSync([server('a', 3)], [pending('a', 2, 'upsert', 'new')]);
  assert.deepEqual(result, {
    uploads: [],
    conflicts: [{ id: 'a', baseVersion: 2, serverVersion: 3 }],
  });
});

test('stale resurrection of a deleted server record conflicts', () => {
  const result = planSync(
    [server('a', 2, null, true)],
    [pending('a', 0, 'upsert', 'resurrected')],
  );
  assert.deepEqual(result, {
    uploads: [],
    conflicts: [{ id: 'a', baseVersion: 0, serverVersion: 2 }],
  });
});

test('new item with base version zero uploads', () => {
  assert.deepEqual(planSync([], [pending('new', 0, 'upsert', 42)]), {
    uploads: [{ id: 'new', op: 'upsert', value: 42 }],
    conflicts: [],
  });
});

test('matching version uploads and delete omits value', () => {
  const result = planSync([server('a', 4), server('b', 7)], [
    pending('a', 4, 'delete'),
    { id: 'b', baseVersion: 7, op: 'delete', value: 'must-not-leak' },
  ]);
  assert.deepEqual(result, {
    uploads: [{ id: 'a', op: 'delete' }, { id: 'b', op: 'delete' }],
    conflicts: [],
  });
});

test('empty inputs return empty arrays', () => {
  assert.deepEqual(planSync([], []), { uploads: [], conflicts: [] });
});

test('does not mutate frozen inputs', () => {
  const records = deepFreeze([server('a', 1, { nested: true })]);
  const changes = deepFreeze([pending('a', 1, 'upsert', { nested: false })]);
  const beforeRecords = structuredClone(records);
  const beforeChanges = structuredClone(changes);
  const result = planSync(records, changes);
  assert.deepEqual(records, beforeRecords);
  assert.deepEqual(changes, beforeChanges);
  assert.deepEqual(result.uploads, [{ id: 'a', op: 'upsert', value: { nested: false } }]);
});

test('malformed top-level inputs fail explicitly', () => {
  assert.throws(() => planSync(null, []), /serverRecords must be an array/);
  assert.throws(() => planSync([], {}), /pendingChanges must be an array/);
});

test('malformed server records fail explicitly', () => {
  assert.throws(() => planSync([server('a', -1)], []), /serverRecords\[0\]/);
  assert.throws(() => planSync([server('a', 1), server('a', 2)], []), /duplicate server id/);
  assert.throws(() => planSync([{ id: 'a', version: 1, deleted: false }], []), /value/);
});

test('malformed pending changes fail even if a later duplicate would replace them', () => {
  assert.throws(() => planSync([], [pending('a', true)]), /pendingChanges\[0\]/);
  assert.throws(() => planSync([], [pending('a', 0, 'bad')]), /pendingChanges\[0\]/);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0, op: 'upsert' }]), /value/);
});
