function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isVersion(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateServerRecords(serverRecords) {
  if (!Array.isArray(serverRecords)) {
    throw new TypeError('serverRecords must be an array');
  }
  const ids = new Set();
  for (let index = 0; index < serverRecords.length; index += 1) {
    const record = serverRecords[index];
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError(`serverRecords[${index}] must be an object`);
    }
    if (!isNonEmptyString(record.id)) {
      throw new TypeError(`serverRecords[${index}].id must be a nonempty string`);
    }
    if (ids.has(record.id)) {
      throw new Error(`duplicate server record id: ${record.id}`);
    }
    ids.add(record.id);
    if (!isVersion(record.version)) {
      throw new TypeError(`serverRecords[${index}].version must be an integer >= 0`);
    }
    if (typeof record.deleted !== 'boolean') {
      throw new TypeError(`serverRecords[${index}].deleted must be a boolean`);
    }
  }
}

function validatePendingChanges(pendingChanges) {
  if (!Array.isArray(pendingChanges)) {
    throw new TypeError('pendingChanges must be an array');
  }
  for (let index = 0; index < pendingChanges.length; index += 1) {
    const change = pendingChanges[index];
    if (change === null || typeof change !== 'object' || Array.isArray(change)) {
      throw new TypeError(`pendingChanges[${index}] must be an object`);
    }
    if (!isNonEmptyString(change.id)) {
      throw new TypeError(`pendingChanges[${index}].id must be a nonempty string`);
    }
    if (!isVersion(change.baseVersion)) {
      throw new TypeError(`pendingChanges[${index}].baseVersion must be an integer >= 0`);
    }
    if (change.op !== 'upsert' && change.op !== 'delete') {
      throw new TypeError(`pendingChanges[${index}].op must be 'upsert' or 'delete'`);
    }
  }
}

function planSync(serverRecords, pendingChanges) {
  validateServerRecords(serverRecords);
  validatePendingChanges(pendingChanges);

  const serverById = new Map();
  for (const record of serverRecords) {
    serverById.set(record.id, record);
  }

  // Keep only the last pending operation per ID, ordered by its last occurrence.
  const lastIndexById = new Map();
  for (let index = 0; index < pendingChanges.length; index += 1) {
    lastIndexById.set(pendingChanges[index].id, index);
  }
  const effectiveChanges = Array.from(lastIndexById.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => pendingChanges[lastIndexById.get(id)]);

  const uploads = [];
  const conflicts = [];

  for (const change of effectiveChanges) {
    const server = serverById.get(change.id);
    const serverVersion = server ? server.version : 0;

    if (change.baseVersion !== serverVersion) {
      conflicts.push({
        id: change.id,
        baseVersion: change.baseVersion,
        serverVersion,
      });
      continue;
    }

    const upload = { id: change.id, op: change.op };
    if (change.op === 'upsert' && change.value !== undefined) {
      upload.value = change.value;
    }
    uploads.push(upload);
  }

  return { uploads, conflicts };
}

module.exports = { planSync };