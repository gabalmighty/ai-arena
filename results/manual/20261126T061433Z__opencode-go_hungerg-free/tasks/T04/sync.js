'use strict';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isVersion(value) {
  return Number.isInteger(value) && value >= 0;
}

function planSync(serverRecords, pendingChanges) {
  if (!Array.isArray(serverRecords)) {
    throw new TypeError('serverRecords must be an array');
  }
  if (!Array.isArray(pendingChanges)) {
    throw new TypeError('pendingChanges must be an array');
  }

  const serverById = new Map();
  for (let index = 0; index < serverRecords.length; index += 1) {
    const record = serverRecords[index];
    const where = `serverRecords[${index}]`;
    if (!isRecord(record)) throw new TypeError(`${where} must be an object`);
    if (!isNonemptyString(record.id)) throw new TypeError(`${where}.id must be a nonempty string`);
    if (!isVersion(record.version)) throw new TypeError(`${where}.version must be an integer >= 0`);
    if (!Object.hasOwn(record, 'value')) throw new TypeError(`${where}.value is required`);
    if (typeof record.deleted !== 'boolean') throw new TypeError(`${where}.deleted must be boolean`);
    if (serverById.has(record.id)) throw new TypeError(`duplicate server id: ${record.id}`);
    serverById.set(record.id, record);
  }

  const lastChangeById = new Map();
  for (let index = 0; index < pendingChanges.length; index += 1) {
    const change = pendingChanges[index];
    const where = `pendingChanges[${index}]`;
    if (!isRecord(change)) throw new TypeError(`${where} must be an object`);
    if (!isNonemptyString(change.id)) throw new TypeError(`${where}.id must be a nonempty string`);
    if (!isVersion(change.baseVersion)) throw new TypeError(`${where}.baseVersion must be an integer >= 0`);
    if (change.op !== 'upsert' && change.op !== 'delete') {
      throw new TypeError(`${where}.op must be 'upsert' or 'delete'`);
    }
    if (change.op === 'upsert' && !Object.hasOwn(change, 'value')) {
      throw new TypeError(`${where}.value is required for upsert`);
    }
    // Deleting before setting moves an existing ID to its last-occurrence position.
    lastChangeById.delete(change.id);
    lastChangeById.set(change.id, change);
  }

  const uploads = [];
  const conflicts = [];
  for (const change of lastChangeById.values()) {
    const current = serverById.get(change.id);
    const serverVersion = current ? current.version : 0;
    if (change.baseVersion !== serverVersion) {
      conflicts.push({
        id: change.id,
        baseVersion: change.baseVersion,
        serverVersion,
      });
      continue;
    }
    const upload = { id: change.id, op: change.op };
    if (change.op === 'upsert') upload.value = change.value;
    uploads.push(upload);
  }

  return { uploads, conflicts };
}

module.exports = { planSync };
