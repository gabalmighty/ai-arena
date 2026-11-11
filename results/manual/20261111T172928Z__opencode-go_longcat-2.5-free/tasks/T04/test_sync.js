'use strict';

// T04 tests — run with: node --test test_sync.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { planSync } = require('./sync');

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

test('last pending operation per id wins and order follows last occurrences', () => {
  const server = [];
  const pending = [
    { id: 'a', baseVersion: 0, op: 'upsert', value: 'a1' },
    { id: 'b', baseVersion: 0, op: 'upsert', value: 'b1' },
    { id: 'a', baseVersion: 0, op: 'upsert', value: 'a2' },
  ];
  const result = planSync(server, pending);
  // Last occurrence positions: b at index 1, a at index 2 -> order [b, a].
  assert.deepEqual(result.uploads, [
    { id: 'b', op: 'upsert', value: 'b1' },
    { id: 'a', op: 'upsert', value: 'a2' },
  ]);
  assert.deepEqual(result.conflicts, []);
});

test('stale baseVersion is a conflict and the id is not uploaded', () => {
  const server = [{ id: 'a', version: 2, value: 'current', deleted: false }];
  const pending = [{ id: 'a', baseVersion: 1, op: 'upsert', value: 'stale' }];
  const result = planSync(server, pending);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.conflicts, [{ id: 'a', baseVersion: 1, serverVersion: 2 }]);
});

test('stale attempt to resurrect a deleted server record is a conflict', () => {
  const server = [{ id: 'a', version: 3, value: null, deleted: true }];
  const pending = [{ id: 'a', baseVersion: 2, op: 'upsert', value: 'back' }];
  const result = planSync(server, pending);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.conflicts, [{ id: 'a', baseVersion: 2, serverVersion: 3 }]);
});

test('new item with baseVersion 0 uploads when the server has no record', () => {
  const result = planSync([], [{ id: 'n', baseVersion: 0, op: 'upsert', value: 'v' }]);
  assert.deepEqual(result.uploads, [{ id: 'n', op: 'upsert', value: 'v' }]);
  assert.deepEqual(result.conflicts, []);
});

test('delete omits value and uploads when the version matches', () => {
  const server = [{ id: 'a', version: 1, value: 'x', deleted: false }];
  const pending = [{ id: 'a', baseVersion: 1, op: 'delete' }];
  const result = planSync(server, pending);
  assert.deepEqual(result.uploads, [{ id: 'a', op: 'delete' }]);
  assert.deepEqual(result.conflicts, []);
});

test('empty inputs produce empty uploads and conflicts', () => {
  assert.deepEqual(planSync([], []), { uploads: [], conflicts: [] });
});

test('mixed ids keep last-occurrence order and split uploads/conflicts', () => {
  const server = [
    { id: 'a', version: 2, value: 'x', deleted: false },
    { id: 'b', version: 1, value: 'y', deleted: false },
  ];
  const pending = [
    { id: 'a', baseVersion: 1, op: 'upsert', value: 'stale' },
    { id: 'b', baseVersion: 1, op: 'upsert', value: 'fresh' },
    { id: 'c', baseVersion: 0, op: 'upsert', value: 'new' },
  ];
  const result = planSync(server, pending);
  assert.deepEqual(result.uploads, [
    { id: 'b', op: 'upsert', value: 'fresh' },
    { id: 'c', op: 'upsert', value: 'new' },
  ]);
  assert.deepEqual(result.conflicts, [{ id: 'a', baseVersion: 1, serverVersion: 2 }]);
});

test('does not mutate serverRecords or pendingChanges', () => {
  const server = [{ id: 'a', version: 1, value: 'x', deleted: false }];
  const pending = [{ id: 'a', baseVersion: 1, op: 'delete' }];
  const serverBefore = snapshot(server);
  const pendingBefore = snapshot(pending);
  planSync(server, pending);
  assert.deepEqual(server, serverBefore);
  assert.deepEqual(pending, pendingBefore);
});

test('malformed server records fail explicitly', () => {
  assert.throws(() => planSync('nope', []), TypeError);
  assert.throws(() => planSync([{ id: 'a', version: -1 }], []), TypeError);
  assert.throws(() => planSync([{ id: 'a', version: 1 }, { id: 'a', version: 2 }], []), TypeError);
  assert.throws(() => planSync([{ id: '', version: 1 }], []), TypeError);
  assert.throws(() => planSync([{ id: 'a', version: true }], []), TypeError);
});

test('malformed pending changes fail explicitly', () => {
  assert.throws(() => planSync([], 'nope'), TypeError);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: -1, op: 'upsert', value: 1 }]), TypeError);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0, op: 'merge', value: 1 }]), TypeError);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0, op: 'upsert' }]), TypeError);
});

test('a delete carrying a value is accepted and the value is omitted from uploads', () => {
  const result = planSync([], [{ id: 'a', baseVersion: 0, op: 'delete', value: 1 }]);
  assert.deepEqual(result.uploads, [{ id: 'a', op: 'delete' }]);
  assert.deepEqual(result.conflicts, []);
});
