'use strict';

function isNonemptyString(x) {
  return typeof x === 'string' && x.length > 0;
}
function isNonnegativeInt(x) {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0;
}
function isObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function planSync(serverRecords, pendingChanges) {
  if (!Array.isArray(serverRecords)) throw new TypeError('serverRecords must be an array');
  if (!Array.isArray(pendingChanges)) throw new TypeError('pendingChanges must be an array');

  const serverById = new Map();
  for (const r of serverRecords) {
    if (!isObject(r)) throw new TypeError('serverRecords entries must be objects');
    if (!isNonemptyString(r.id)) throw new TypeError('server record id must be a nonempty string');
    if (!isNonnegativeInt(r.version)) throw new TypeError('server record version must be an integer >= 0');
    if (typeof r.deleted !== 'boolean') throw new TypeError('server record deleted must be a boolean');
    if (serverById.has(r.id)) throw new TypeError('server record ids must be unique: ' + r.id);
    serverById.set(r.id, r);
  }

  for (const c of pendingChanges) {
    if (!isObject(c)) throw new TypeError('pendingChanges entries must be objects');
    if (!isNonemptyString(c.id)) throw new TypeError('pending change id must be a nonempty string');
    if (!isNonnegativeInt(c.baseVersion)) throw new TypeError('baseVersion must be an integer >= 0');
    if (c.op !== 'upsert' && c.op !== 'delete') throw new TypeError('op must be "upsert" or "delete"');
  }

  // Index of the last pending change for each id.
  const lastIndex = new Map();
  pendingChanges.forEach((c, i) => lastIndex.set(c.id, i));

  const uploads = [];
  const conflicts = [];

  pendingChanges.forEach((c, i) => {
    if (lastIndex.get(c.id) !== i) return; // only the last op per id wins

    const server = serverById.get(c.id);
    // A deleted server record still has a version; it is not treated as absent.
    const serverVersion = server ? server.version : 0;

    if (c.baseVersion !== serverVersion) {
      conflicts.push({ id: c.id, baseVersion: c.baseVersion, serverVersion });
      return;
    }

    const upload = { id: c.id, op: c.op };
    if (c.op === 'upsert' && Object.prototype.hasOwnProperty.call(c, 'value')) {
      upload.value = c.value;
    }
    uploads.push(upload);
  });

  return { uploads, conflicts };
}

module.exports = { planSync };
