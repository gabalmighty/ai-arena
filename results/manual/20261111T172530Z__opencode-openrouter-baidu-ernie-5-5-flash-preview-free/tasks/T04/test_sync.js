const test = require('node:test');
const assert = require('node:assert/strict');

const { planSync } = require('./sync.js');

test('last operation per ID wins and last-occurrence order is preserved', () => {
  const server = [];
  const pending = [
    { id: 'a', baseVersion: 0, op: 'upsert', value: 'a1' },
    { id: 'b', baseVersion: 0, op: 'upsert', value: 'b1' },
    { id: 'a', baseVersion: 0, op: 'upsert', value: 'a2' },
  ];

  assert.deepEqual(planSync(server, pending), {
    uploads: [
      { id: 'b', op: 'upsert', value: 'b1' },
      { id: 'a', op: 'upsert', value: 'a2' },
    ],
    conflicts: [],
  });
});

test('version mismatch becomes a conflict and is not uploaded', () => {
  const server = [{ id: 'a', version: 2, value: 'v2', deleted: false }];
  const pending = [{ id: 'a', baseVersion: 1, op: 'upsert', value: 'v3' }];

  assert.deepEqual(planSync(server, pending), {
    uploads: [],
    conflicts: [{ id: 'a', baseVersion: 1, serverVersion: 2 }],
  });
});

test('stale resurrection of a deleted server record is a conflict', () => {
  const server = [{ id: 'a', version: 2, value: 'old', deleted: true }];
  const pending = [{ id: 'a', baseVersion: 1, op: 'upsert', value: 'new' }];

  assert.deepEqual(planSync(server, pending), {
    uploads: [],
    conflicts: [{ id: 'a', baseVersion: 1, serverVersion: 2 }],
  });
});

test('new item with baseVersion 0 is uploaded', () => {
  const pending = [{ id: 'new', baseVersion: 0, op: 'upsert', value: 'hello' }];
  assert.deepEqual(planSync([], pending), {
    uploads: [{ id: 'new', op: 'upsert', value: 'hello' }],
    conflicts: [],
  });
});

test('delete uploads omit value', () => {
  const server = [{ id: 'a', version: 1, value: 'v1', deleted: false }];
  const pending = [{ id: 'a', baseVersion: 1, op: 'delete', value: 'ignored' }];

  assert.deepEqual(planSync(server, pending), {
    uploads: [{ id: 'a', op: 'delete' }],
    conflicts: [],
  });
});

test('empty inputs return empty plans', () => {
  assert.deepEqual(planSync([], []), { uploads: [], conflicts: [] });
});

test('does not mutate inputs', () => {
  const server = [{ id: 'a', version: 1, value: 'v1', deleted: false }];
  const pending = [
    { id: 'a', baseVersion: 1, op: 'upsert', value: 'v2' },
    { id: 'b', baseVersion: 0, op: 'delete' },
  ];
  const serverBefore = structuredClone(server);
  const pendingBefore = structuredClone(pending);

  planSync(server, pending);

  assert.deepEqual(server, serverBefore);
  assert.deepEqual(pending, pendingBefore);
});

test('malformed input fails explicitly', () => {
  assert.throws(() => planSync(null, []), /serverRecords must be an array/);
  assert.throws(
    () => planSync([{ id: 'a', version: -1, value: 'v', deleted: false }], []),
    /version must be an integer >= 0/,
  );
  assert.throws(
    () => planSync([{ id: 'a', version: 1, value: 'v', deleted: false }, { id: 'a', version: 1, value: 'v', deleted: false }], []),
    /duplicate server record id/,
  );
  assert.throws(
    () => planSync([], [{ id: 'a', baseVersion: 0, op: 'merge' }]),
    /op must be 'upsert' or 'delete'/,
  );
});