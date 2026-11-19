'use strict';

/**
 * Pure synchronization planner for mobile offline state (planSync).
 *
 * Contract:
 * - serverRecords: array of {id, version, value, deleted} with integer version >= 0 and unique IDs.
 * - pendingChanges: ordered array of {id, baseVersion, op, value?}, where op is 'upsert' or 'delete'.
 * - Last pending operation per ID wins; the order of last occurrences across IDs is preserved.
 * - Current server version for an ID is the record's version, or 0 if no record exists.
 * - If baseVersion differs from the current version, add {id, baseVersion, serverVersion} to
 *   conflicts and do NOT upload that ID. This includes stale attempts to resurrect a deleted
 *   server record (a deleted record still counts with its version).
 * - Otherwise add {id, op, value?} to uploads; value is omitted for deletes.
 * - Inputs are never mutated and no network I/O is performed.
 *
 * Malformed records/changes fail explicitly with a meaningful Error.
 */

function validateServerRecords(serverRecords) {
  if (!Array.isArray(serverRecords)) throw new Error('serverRecords must be an array');
  const server = new Map();
  serverRecords.forEach((record, index) => {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new Error('serverRecords[' + index + '] must be an object');
    }
    if (typeof record.id !== 'string' || record.id === '') {
      throw new Error('serverRecords[' + index + '].id must be a nonempty string');
    }
    if (server.has(record.id)) {
      throw new Error('serverRecords contains duplicate id: ' + record.id);
    }
    if (!Number.isInteger(record.version) || record.version < 0) {
      throw new Error('serverRecords[' + index + '].version must be an integer >= 0');
    }
    if (record.deleted !== undefined && typeof record.deleted !== 'boolean') {
      throw new Error('serverRecords[' + index + '].deleted must be a boolean');
    }
    server.set(record.id, record);
  });
  return server;
}

function validatePendingChanges(pendingChanges) {
  if (!Array.isArray(pendingChanges)) throw new Error('pendingChanges must be an array');
  pendingChanges.forEach((change, index) => {
    if (typeof change !== 'object' || change === null || Array.isArray(change)) {
      throw new Error('pendingChanges[' + index + '] must be an object');
    }
    if (typeof change.id !== 'string' || change.id === '') {
      throw new Error('pendingChanges[' + index + '].id must be a nonempty string');
    }
    if (!Number.isInteger(change.baseVersion) || change.baseVersion < 0) {
      throw new Error('pendingChanges[' + index + '].baseVersion must be an integer >= 0');
    }
    if (change.op !== 'upsert' && change.op !== 'delete') {
      throw new Error('pendingChanges[' + index + '].op must be "upsert" or "delete"');
    }
  });
}

function planSync(serverRecords, pendingChanges) {
  const server = validateServerRecords(serverRecords);
  validatePendingChanges(pendingChanges);

  // Last change per ID wins; deleting then setting moves the key to the end of
  // the Map, so iteration order = order of last occurrences.
  const winners = new Map();
  pendingChanges.forEach((change) => {
    if (winners.has(change.id)) winners.delete(change.id);
    winners.set(change.id, change);
  });

  const uploads = [];
  const conflicts = [];
  winners.forEach((change) => {
    const record = server.get(change.id);
    const currentVersion = record ? record.version : 0;
    if (change.baseVersion !== currentVersion) {
      conflicts.push({
        id: change.id,
        baseVersion: change.baseVersion,
        serverVersion: currentVersion,
      });
      return;
    }
    const entry = { id: change.id, op: change.op };
    if (change.op === 'upsert') entry.value = change.value;
    uploads.push(entry);
  });
  return { uploads, conflicts };
}

module.exports = { planSync };
