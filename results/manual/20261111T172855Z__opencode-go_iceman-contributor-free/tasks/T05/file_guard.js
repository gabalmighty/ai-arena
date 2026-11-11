const fs = require("node:fs");
const path = require("node:path");

function hasNullByte(s) {
  return typeof s === "string" && s.includes("\u0000");
}

function safeFile(rootDirectory, requestedRelativePath) {
  try {
    if (typeof rootDirectory !== "string" || rootDirectory.length === 0) return null;
    if (typeof requestedRelativePath !== "string" || requestedRelativePath.length === 0) return null;
    if (hasNullByte(rootDirectory) || hasNullByte(requestedRelativePath)) return null;

    // Must be a relative path (reject absolute paths, including Windows drive/UNC forms)
    if (path.isAbsolute(requestedRelativePath)) return null;
    if (/^[a-zA-Z]:/.test(requestedRelativePath)) return null;
    if (requestedRelativePath.startsWith("\\\\")) return null;

    // Reject traversal segments explicitly and after normalization
    const norm = path.normalize(requestedRelativePath);
    if (norm.split(/[\\/]+/).includes("..")) return null;
    if (path.isAbsolute(norm)) return null;

    // Root must exist
    const rootStat = fs.statSync(rootDirectory, { throwIfNoEntry: false });
    if (!rootStat) return null;
    // Resolve real filesystem paths
    const rootReal = fs.realpathSync(rootDirectory);

    const candidateJoined = path.join(rootReal, norm);
    const candidateResolved = path.resolve(candidateJoined);

    // Candidate must be inside canonical root, not the root itself
    const rel = path.relative(rootReal, candidateResolved);
    if (rel === "" || rel === ".") return null;
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

    // Must resolve to an existing real path (no symlink escape)
    let candidateReal;
    try {
      candidateReal = fs.realpathSync(candidateResolved);
    } catch {
      return null;
    }

    const relReal = path.relative(rootReal, candidateReal);
    if (relReal === "" || relReal === ".") return null;
    if (relReal.startsWith("..") || path.isAbsolute(relReal)) return null;

    // Must be an existing regular file
    let st;
    try {
      st = fs.lstatSync(candidateReal);
    } catch {
      return null;
    }
    if (!st.isFile()) return null;

    return candidateReal;
  } catch {
    return null;
  }
}

module.exports = { safeFile };
