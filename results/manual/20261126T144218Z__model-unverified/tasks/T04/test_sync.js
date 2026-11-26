'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planSync } = require('./sync.js');

function srv(id, version, value = null, deleted = false) {
  return { id, version, value, deleted };
}

test('empty queue -> no uploads, no conflicts; empty server ok', () => {
  assert.deepEqual(planSync([], []), { uploads: [], conflicts: [] });
  assert.deepEqual(planSync([srv('a', 3, 1)], []), { uploads: [], conflicts: [] });
});

test('dedup order: last pending op per id wins; order of LAST occurrences, not first', () => {
  const pending = [
    { id: 'a', baseVersion: 0, op: 'upsert', value: 'a-first' },
    { id: 'b', baseVersion: 0, op: 'upsert', value: 'b' },
    { id: 'a', baseVersion: 0, op: 'upsert', value: 'a-second' }, // last 'a' occurs AFTER 'b'
    { id: 'c', baseVersion: 0, op: 'delete' },
    { id: 'b', baseVersion: 0, op: 'delete' },                    // last 'b' occurs AFTER 'c'
  ];
  const { uploads } = planSync([], pending);
  // last occurrences order: a(idx2) < c(idx3) < b(idx4)
  assert.deepEqual(uploads.map(u => u.id), ['a', 'c', 'b']);
  // last op wins: 'a' keeps a-second; 'b' became delete
  assert.deepEqual(uploads.find(u => u.id === 'a'), { id: 'a', op: 'upsert', value: 'a-second' });
  assert.deepEqual(uploads.find(u => u.id === 'b'), { id: 'b', op: 'delete' });
  assert.deepEqual(uploads.find(u => u.id === 'c'), { id: 'c', op: 'delete' });
});

test('version conflict: baseVersion != current server version -> conflict, no upload', () => {
  const server = [srv('a', 2, 'x'), srv('b', 0, null)];
  const pending = [
    { id: 'a', baseVersion: 1, op: 'upsert', value: 'stale' },   // stale
    { id: 'b', baseVersion: 0, op: 'upsert', value: 'ok' },      // matches
    { id: 'new', baseVersion: 5, op: 'upsert', value: 'n' },     // absent server -> current 0 -> conflict
  ];
  const { uploads, conflicts } = planSync(server, pending);
  assert.deepEqual(uploads, [{ id: 'b', op: 'upsert', value: 'ok' }]);
  assert.deepEqual(conflicts, [
    { id: 'a', baseVersion: 1, serverVersion: 2 },
    { id: 'new', baseVersion: 5, serverVersion: 0 },
  ]);
});

test('deleted server record: current version still counts; stale resurrection is a conflict', () => {
  const server = [srv('a', 4, 'gone', true)];
  // matching baseVersion on a deleted record is not a conflict...
  let r = planSync(server, [{ id: 'a', baseVersion: 4, op: 'upsert', value: 'back' }]);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.uploads, [{ id: 'a', op: 'upsert', value: 'back' }]);
  // ...but a STALE attempt to resurrect a deleted server record IS a conflict
  r = planSync(server, [{ id: 'a', baseVersion: 0, op: 'upsert', value: 'back' }]);
  assert.deepEqual(r.uploads, []);
  assert.deepEqual(r.conflicts, [{ id: 'a', baseVersion: 0, serverVersion: 4 }]);
  r = planSync(server, [{ id: 'a', baseVersion: 3, op: 'delete' }]);
  assert.deepEqual(r.conflicts, [{ id: 'a', baseVersion: 3, serverVersion: 4 }]);
});

test('new item: absent server -> current version 0; baseVersion 0 uploads', () => {
  const { uploads, conflicts } = planSync([], [{ id: 'x', baseVersion: 0, op: 'upsert', value: { k: 1 } }]);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(uploads, [{ id: 'x', op: 'upsert', value: { k: 1 } }]);
});

test('delete uploads omit value; upsert without value has no value key', () => {
  const { uploads } = planSync([srv('a', 0, 1)], [
    { id: 'a', baseVersion: 0, op: 'delete', value: 'ignored' },
    { id: 'z', baseVersion: 0, op: 'upsert' },
  ]);
  assert.deepEqual(uploads.find(u => u.id === 'a'), { id: 'a', op: 'delete' });
  assert.deepEqual(uploads.find(u => u.id === 'z'), { id: 'z', op: 'upsert' });
});

test('immutability: inputs are not changed; output value is a clone', () => {
  const server = [srv('a', 1, { n: 1 })];
  const pending = [{ id: 'a', baseVersion: 1, op: 'upsert', value: { nested: [1, 2] } }];
  const serverSnap = structuredClone(server);
  const pendingSnap = structuredClone(pending);
  const out = planSync(server, pending);
  assert.deepEqual(server, serverSnap);
  assert.deepEqual(pending, pendingSnap);
  out.uploads[0].value.nested.push(99); // mutate output...
  assert.deepEqual(pending[0].value, { nested: [1, 2] }); // ...input unaffected
});

test('malformed records fail explicitly with meaningful error (no silent drop)', () => {
  assert.throws(() => planSync(null, []), /serverRecords must be an array/);
  assert.throws(() => planSync([], null), /pendingChanges must be an array/);
  // server records
  assert.throws(() => planSync([srv('a', -1)], []), /version/);
  assert.throws(() => planSync([srv('a', 1.5)], []), /version/);
  assert.throws(() => planSync([{ id: 'a', version: 0, deleted: false }], []), /value/);
  assert.throws(() => planSync([srv('', 0)], []), /id/);
  assert.throws(() => planSync([srv('a', 0, null, 'no')], []), /deleted/);
  assert.throws(() => planSync([srv('a', 0), srv('a', 1)], []), /duplicate/); // unique ids
  assert.throws(() => planSync(['nope'], []), /object/);
  // pending changes
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0, op: 'merge' }]), /op/);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: -1, op: 'upsert' }]), /baseVersion/);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0.5, op: 'upsert' }]), /baseVersion/);
  assert.throws(() => planSync([], [{ id: '', baseVersion: 0, op: 'upsert' }]), /id/);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0 }]), /op/);
  assert.throws(() => planSync([], [null]), /object/);
});
