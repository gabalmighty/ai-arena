'use strict';

// Pure offline-sync planner. No network I/O. No input mutation.

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}
function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function clone(v) {
  return v === undefined ? undefined : structuredClone(v);
}

function validateServerRecord(r) {
  if (!isPlainObject(r)) throw new TypeError('server record must be an object');
  if (typeof r.id !== 'string' || r.id === '') throw new TypeError('server record id must be a nonempty string');
  if (!Number.isInteger(r.version) || r.version < 0) throw new TypeError('server record version must be an integer >= 0');
  if (typeof r.deleted !== 'boolean') throw new TypeError('server record deleted must be a boolean');
  if (!own(r, 'value')) throw new TypeError('server record must have a value property (id=' + r.id + ')');
}

function validatePendingChange(c) {
  if (!isPlainObject(c)) throw new TypeError('pending change must be an object');
  if (typeof c.id !== 'string' || c.id === '') throw new TypeError('pending change id must be a nonempty string');
  if (!Number.isInteger(c.baseVersion) || c.baseVersion < 0) throw new TypeError('pending change baseVersion must be an integer >= 0');
  if (c.op !== 'upsert' && c.op !== 'delete') throw new TypeError("pending change op must be 'upsert' or 'delete'");
}

function planSync(serverRecords, pendingChanges) {
  if (!Array.isArray(serverRecords)) throw new TypeError('serverRecords must be an array');
  if (!Array.isArray(pendingChanges)) throw new TypeError('pendingChanges must be an array');

  // Index server records; reject malformed + duplicate ids. Do not mutate.
  const server = new Map();
  for (const rec of serverRecords) {
    validateServerRecord(rec);
    if (server.has(rec.id)) throw new Error('duplicate server record id: ' + rec.id);
    server.set(rec.id, rec);
  }

  // Dedupe pending by id keeping LAST operation; remember last-occurrence index.
  // (Map.set on an existing key keeps original insertion order, so we re-sort.)
  const lastById = new Map();
  pendingChanges.forEach((change, index) => {
    validatePendingChange(change);
    lastById.set(change.id, { change, index });
  });

  const ordered = Array.from(lastById.values()).sort((a, b) => a.index - b.index);

  const uploads = [];
  const conflicts = [];

  for (const { change } of ordered) {
    const serverRec = server.get(change.id);
    const currentVersion = serverRec ? serverRec.version : 0; // version or 0 if absent
    if (change.baseVersion !== currentVersion) {
      conflicts.push({ id: change.id, baseVersion: change.baseVersion, serverVersion: currentVersion });
      continue; // do not upload this id
    }
    if (change.op === 'delete') {
      uploads.push({ id: change.id, op: 'delete' }); // omit value for delete
    } else {
      const up = { id: change.id, op: 'upsert' };
      if (own(change, 'value')) up.value = clone(change.value);
      uploads.push(up);
    }
  }

  return { uploads, conflicts };
}

module.exports = { planSync };
