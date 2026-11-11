'use strict';

// T04 — pure offline synchronization planner.
// No network I/O, no input mutation, explicit errors for malformed input.

const VALID_OPS = new Set(['upsert', 'delete']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isIntegerAtLeastZero(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validateServerRecords(serverRecords) {
  if (!Array.isArray(serverRecords)) {
    throw new TypeError('planSync: serverRecords must be an array');
  }
  const byId = new Map();
  serverRecords.forEach((record, index) => {
    if (!isPlainObject(record)) {
      throw new TypeError(`planSync: serverRecords[${index}] must be an object`);
    }
    if (!isNonemptyString(record.id)) {
      throw new TypeError(`planSync: serverRecords[${index}].id must be a nonempty string`);
    }
    if (byId.has(record.id)) {
      throw new TypeError(`planSync: duplicate serverRecords id "${record.id}"`);
    }
    if (!isIntegerAtLeastZero(record.version)) {
      throw new TypeError(`planSync: serverRecords[${index}].version must be an integer >= 0`);
    }
    if (record.deleted !== undefined && typeof record.deleted !== 'boolean') {
      throw new TypeError(`planSync: serverRecords[${index}].deleted must be a boolean when present`);
    }
    byId.set(record.id, record);
  });
  return byId;
}

function validatePendingChanges(pendingChanges) {
  if (!Array.isArray(pendingChanges)) {
    throw new TypeError('planSync: pendingChanges must be an array');
  }
  pendingChanges.forEach((change, index) => {
    if (!isPlainObject(change)) {
      throw new TypeError(`planSync: pendingChanges[${index}] must be an object`);
    }
    if (!isNonemptyString(change.id)) {
      throw new TypeError(`planSync: pendingChanges[${index}].id must be a nonempty string`);
    }
    if (!isIntegerAtLeastZero(change.baseVersion)) {
      throw new TypeError(`planSync: pendingChanges[${index}].baseVersion must be an integer >= 0`);
    }
    if (!VALID_OPS.has(change.op)) {
      throw new TypeError(`planSync: pendingChanges[${index}].op must be "upsert" or "delete"`);
    }
    if (change.op === 'upsert' && !Object.prototype.hasOwnProperty.call(change, 'value')) {
      throw new TypeError(`planSync: pendingChanges[${index}] upsert requires a value`);
    }
  });
}

function planSync(serverRecords, pendingChanges) {
  const serverById = validateServerRecords(serverRecords);
  validatePendingChanges(pendingChanges);

  // The last pending operation for an id wins. Order follows the position of
  // each id's LAST occurrence (not its first), across different ids.
  const lastById = new Map();
  pendingChanges.forEach((change, index) => {
    lastById.set(change.id, { change, index });
  });
  const ordered = [...lastById.values()]
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.change);

  const uploads = [];
  const conflicts = [];

  for (const change of ordered) {
    const serverRecord = serverById.get(change.id);
    const serverVersion = serverRecord ? serverRecord.version : 0;

    if (change.baseVersion !== serverVersion) {
      // Includes stale attempts to resurrect a deleted server record: a deleted
      // record still carries its version, so an older baseVersion is a conflict.
      conflicts.push({
        id: change.id,
        baseVersion: change.baseVersion,
        serverVersion,
      });
      continue;
    }

    if (change.op === 'delete') {
      uploads.push({ id: change.id, op: 'delete' });
    } else {
      uploads.push({ id: change.id, op: 'upsert', value: change.value });
    }
  }

  return { uploads, conflicts };
}

module.exports = { planSync };
