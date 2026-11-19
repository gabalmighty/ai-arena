'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planSync } = require('./sync');

const rec = (id, version, value = 'v', deleted = false) => ({ id, version, value, deleted });

test('dedup keeps last operation and orders by last occurrence', () => {
  const server = [rec('A', 1)];
  const pending = [
    { id: 'A', baseVersion: 0, op: 'upsert', value: 'first' },
    { id: 'B', baseVersion: 0, op: 'upsert', value: 'bee' },
    { id: 'A', baseVersion: 1, op: 'upsert', value: 'last' },
    { id: 'C', baseVersion: 0, op: 'upsert', value: 'see' },
  ];
  const out = planSync(server, pending);
  assert.deepEqual(out.uploads, [
    { id: 'B', op: 'upsert', value: 'bee' },
    { id: 'A', op: 'upsert', value: 'last' },
    { id: 'C', op: 'upsert', value: 'see' },
  ]);
  assert.deepEqual(out.conflicts, []);
});

test('version mismatch produces a conflict and no upload', () => {
  const out = planSync([rec('A', 2)], [{ id: 'A', baseVersion: 1, op: 'upsert', value: 'x' }]);
  assert.deepEqual(out.uploads, []);
  assert.deepEqual(out.conflicts, [{ id: 'A', baseVersion: 1, serverVersion: 2 }]);
});

test('stale resurrection of a deleted server record is a conflict', () => {
  const out = planSync([rec('X', 3, 'gone', true)], [{ id: 'X', baseVersion: 2, op: 'upsert', value: 'revive' }]);
  assert.deepEqual(out.uploads, []);
  assert.deepEqual(out.conflicts, [{ id: 'X', baseVersion: 2, serverVersion: 3 }]);
});

test('new item with baseVersion 0 uploads', () => {
  const out = planSync([], [{ id: 'N', baseVersion: 0, op: 'upsert', value: 'new' }]);
  assert.deepEqual(out.uploads, [{ id: 'N', op: 'upsert', value: 'new' }]);
  assert.deepEqual(out.conflicts, []);
});

test('delete upload omits value', () => {
  const out = planSync([rec('D', 1)], [{ id: 'D', baseVersion: 1, op: 'delete', value: 'ignored' }]);
  assert.deepEqual(out.uploads, [{ id: 'D', op: 'delete' }]);
});

test('empty inputs', () => {
  assert.deepEqual(planSync([], []), { uploads: [], conflicts: [] });
});

test('inputs are never mutated', () => {
  const server = Object.freeze([Object.freeze(rec('A', 1))]);
  const pending = Object.freeze([Object.freeze({ id: 'A', baseVersion: 1, op: 'upsert', value: 'x' })]);
  const before = JSON.stringify({ server, pending });
  planSync(server, pending);
  assert.equal(JSON.stringify({ server, pending }), before);
});

test('malformed input fails explicitly', () => {
  assert.throws(() => planSync(null, []), /serverRecords/);
  assert.throws(() => planSync([], null), /pendingChanges/);
  assert.throws(() => planSync([rec('A', -1)], []), /version/);
  assert.throws(() => planSync([rec('A', 1), rec('A', 2)], []), /unique|duplicate/i);
  assert.throws(() => planSync([], [{ id: 'A', baseVersion: 0, op: 'frobnicate' }]), /op/);
});
