'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planSync } = require('./sync.js');

test('dedup: last change per id wins; uploads ordered by last occurrence', () => {
  const { uploads, conflicts } = planSync(
    [],
    [
      { id: 'a', baseVersion: 0, op: 'upsert', value: 'A1' },
      { id: 'b', baseVersion: 0, op: 'upsert', value: 'B1' },
      { id: 'a', baseVersion: 0, op: 'upsert', value: 'A2' },
    ],
  );
  // 'a' last occurs at index 2, 'b' at index 1 -> order [b, a]; winner for 'a' is A2.
  assert.deepStrictEqual(uploads, [
    { id: 'b', op: 'upsert', value: 'B1' },
    { id: 'a', op: 'upsert', value: 'A2' },
  ]);
  assert.deepStrictEqual(conflicts, []);
});

test('version conflict: stale baseVersion goes to conflicts, not uploads', () => {
  const { uploads, conflicts } = planSync(
    [{ id: 'x', version: 5, value: 'v', deleted: false }],
    [{ id: 'x', baseVersion: 4, op: 'upsert', value: 'new' }],
  );
  assert.deepStrictEqual(conflicts, [{ id: 'x', baseVersion: 4, serverVersion: 5 }]);
  assert.deepStrictEqual(uploads, []);
});

test('version match is not a conflict', () => {
  const { uploads, conflicts } = planSync(
    [{ id: 'x', version: 7, value: 'v', deleted: false }],
    [{ id: 'x', baseVersion: 7, op: 'upsert', value: 'w' }],
  );
  assert.deepStrictEqual(uploads, [{ id: 'x', op: 'upsert', value: 'w' }]);
  assert.deepStrictEqual(conflicts, []);
});

test('deleted server record: stale resurrection is a conflict, current is allowed', () => {
  const server = [{ id: 'd', version: 3, deleted: true }];
  const stale = planSync(server, [{ id: 'd', baseVersion: 2, op: 'upsert', value: 'revive' }]);
  assert.deepStrictEqual(stale.conflicts, [{ id: 'd', baseVersion: 2, serverVersion: 3 }]);
  assert.deepStrictEqual(stale.uploads, []);
  const current = planSync(server, [{ id: 'd', baseVersion: 3, op: 'upsert', value: 'revive' }]);
  assert.deepStrictEqual(current.uploads, [{ id: 'd', op: 'upsert', value: 'revive' }]);
  assert.deepStrictEqual(current.conflicts, []);
});

test('new item (no server record, baseVersion 0) uploads', () => {
  const { uploads, conflicts } = planSync(
    [],
    [{ id: 'n', baseVersion: 0, op: 'upsert', value: 'v' }],
  );
  assert.deepStrictEqual(uploads, [{ id: 'n', op: 'upsert', value: 'v' }]);
  assert.deepStrictEqual(conflicts, []);
});

test('new item with nonzero baseVersion conflicts when no record exists', () => {
  const { uploads, conflicts } = planSync(
    [],
    [{ id: 'n', baseVersion: 5, op: 'upsert', value: 'v' }],
  );
  assert.deepStrictEqual(uploads, []);
  assert.deepStrictEqual(conflicts, [{ id: 'n', baseVersion: 5, serverVersion: 0 }]);
});

test('delete uploads without a value key', () => {
  const { uploads, conflicts } = planSync(
    [{ id: 'x', version: 2, value: 'v', deleted: false }],
    [{ id: 'x', baseVersion: 2, op: 'delete' }],
  );
  assert.deepStrictEqual(uploads, [{ id: 'x', op: 'delete' }]);
  assert.ok(!('value' in uploads[0]), 'value must be omitted for deletes');
  assert.deepStrictEqual(conflicts, []);
});

test('empty queue returns empty uploads and conflicts', () => {
  assert.deepStrictEqual(planSync([], []), { uploads: [], conflicts: [] });
});

test('conflict on one id does not block a clean id in the same batch', () => {
  const { uploads, conflicts } = planSync(
    [{ id: 'x', version: 5, deleted: false }],
    [
      { id: 'x', baseVersion: 4, op: 'upsert', value: 1 },
      { id: 'y', baseVersion: 0, op: 'upsert', value: 2 },
    ],
  );
  assert.deepStrictEqual(uploads, [{ id: 'y', op: 'upsert', value: 2 }]);
  assert.deepStrictEqual(conflicts, [{ id: 'x', baseVersion: 4, serverVersion: 5 }]);
});

test('inputs are not mutated', () => {
  const serverRecords = [
    { id: 'x', version: 2, value: 'v', deleted: false },
    { id: 'd', version: 4, deleted: true },
  ];
  const pendingChanges = [
    { id: 'x', baseVersion: 2, op: 'upsert', value: 'w' },
    { id: 'x', baseVersion: 2, op: 'delete' },
    { id: 'z', baseVersion: 0, op: 'upsert', value: 'q' },
  ];
  const serverBefore = JSON.stringify(serverRecords);
  const pendingBefore = JSON.stringify(pendingChanges);
  planSync(serverRecords, pendingChanges);
  assert.equal(JSON.stringify(serverRecords), serverBefore);
  assert.equal(JSON.stringify(pendingChanges), pendingBefore);
});

test('malformed server records throw', () => {
  assert.throws(() => planSync([{ id: '', version: 0 }], []), Error);
  assert.throws(() => planSync([{ id: 'a', version: -1 }], []), Error);
  assert.throws(() => planSync([{ id: 'a', version: 0.5 }], []), Error);
  assert.throws(() => planSync([{ id: 'a', version: 0 }, { id: 'a', version: 1 }], []), Error);
  assert.throws(() => planSync('nope', []), Error);
});

test('malformed pending changes throw', () => {
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0 }]), Error);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: -1, op: 'upsert', value: 1 }]), Error);
  assert.throws(() => planSync([], [{ id: 'a', baseVersion: 0, op: 'bogus' }]), Error);
  assert.throws(() => planSync([], [{ id: '', baseVersion: 0, op: 'delete' }]), Error);
  assert.throws(() => planSync([], null), Error);
});
