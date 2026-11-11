function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateServerRecords(serverRecords) {
  if (!Array.isArray(serverRecords)) throw new Error("serverRecords must be an array");
  const ids = new Set();
  for (const rec of serverRecords) {
    if (!isPlainObject(rec)) throw new Error("server record must be an object");
    if (typeof rec.id !== "string" || rec.id.length === 0) throw new Error("server record id must be a nonempty string");
    if (!Number.isInteger(rec.version) || rec.version < 0) throw new Error("server record version must be an integer >= 0");
    if (typeof rec.deleted !== "boolean") throw new Error("server record deleted must be boolean");
    if (ids.has(rec.id)) throw new Error("duplicate server record id");
    ids.add(rec.id);
  }
}

function validatePendingChanges(pendingChanges) {
  if (!Array.isArray(pendingChanges)) throw new Error("pendingChanges must be an array");
  for (const ch of pendingChanges) {
    if (!isPlainObject(ch)) throw new Error("pending change must be an object");
    if (typeof ch.id !== "string" || ch.id.length === 0) throw new Error("pending change id must be a nonempty string");
    if (!Number.isInteger(ch.baseVersion) || ch.baseVersion < 0) throw new Error("pending change baseVersion must be an integer >= 0");
    if (ch.op !== "upsert" && ch.op !== "delete") throw new Error("pending change op must be upsert or delete");
    if (ch.op === "upsert" && !Object.prototype.hasOwnProperty.call(ch, "value")) {
      throw new Error("upsert pending change must include value");
    }
  }
}

function planSync(serverRecords, pendingChanges) {
  validateServerRecords(serverRecords);
  validatePendingChanges(pendingChanges);

  const serverById = new Map(serverRecords.map((r) => [r.id, r]));

  // Last pending operation for a given ID wins, preserving order of last occurrences across different IDs.
  const lastIndex = new Map();
  pendingChanges.forEach((ch, i) => lastIndex.set(ch.id, i));
  const seen = new Set();
  const lastOps = [];
  for (let i = 0; i < pendingChanges.length; i++) {
    const ch = pendingChanges[i];
    if (lastIndex.get(ch.id) !== i || seen.has(ch.id)) continue;
    seen.add(ch.id);
    lastOps.push(ch);
  }

  const uploads = [];
  const conflicts = [];

  for (const ch of lastOps) {
    const server = serverById.get(ch.id);
    const serverVersion = server ? server.version : 0;
    if (ch.baseVersion !== serverVersion) {
      conflicts.push({ id: ch.id, baseVersion: ch.baseVersion, serverVersion });
      continue;
    }
    if (ch.op === "delete") {
      uploads.push({ id: ch.id, op: "delete" });
    } else {
      uploads.push({ id: ch.id, op: "upsert", value: ch.value });
    }
  }

  return { uploads, conflicts };
}

module.exports = { planSync };
