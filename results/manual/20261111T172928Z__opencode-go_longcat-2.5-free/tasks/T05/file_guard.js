'use strict';

// T05 — desktop IPC path-boundary guard.
//
// Host actually exercised by the accompanying tests: Microsoft Windows
// (Windows NT 10.0.26200.0, Node v24.19.0). Linux/macOS behaviour is inferred
// from Node's path/realpath semantics and was NOT executed here.
//
// This is validation only: the file's contents are never read or written.
// It does NOT claim complete protection against symlink TOCTOU races (a
// symlink could be swapped between the realpath check and a later open by the
// caller); callers must still open with O_NOFOLLOW-style semantics or accept
// that residual race.

const fs = require('node:fs');
const path = require('node:path');

function safeFile(rootDirectory, requestedRelativePath) {
  try {
    // --- Input validation -------------------------------------------------
    if (typeof rootDirectory !== 'string' || rootDirectory.length === 0) return null;
    if (typeof requestedRelativePath !== 'string' || requestedRelativePath.length === 0) return null;
    if (rootDirectory.includes('\0') || requestedRelativePath.includes('\0')) return null;
    if (path.isAbsolute(requestedRelativePath)) return null;
    // Windows drive-relative paths such as "C:foo" are not caught by
    // path.isAbsolute but must not be allowed to escape the root.
    if (process.platform === 'win32' && /^[A-Za-z]:/.test(requestedRelativePath)) return null;

    // --- Canonical root ---------------------------------------------------
    const rootReal = fs.realpathSync(rootDirectory);
    if (!fs.statSync(rootReal).isDirectory()) return null;

    const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;

    // --- Lexical containment ---------------------------------------------
    // path.resolve normalizes ".." segments; anything that normalizes outside
    // the root (or to the root itself) is rejected before touching the FS.
    const candidate = path.resolve(rootReal, requestedRelativePath);
    if (candidate === rootReal) return null; // root itself is out of scope
    if (!candidate.startsWith(prefix)) return null;

    // --- Canonical candidate (resolves symlinks) --------------------------
    // If any component is a symlink that escapes the root, realpath lands
    // outside the canonical root and the containment check below rejects it.
    const candidateReal = fs.realpathSync(candidate);
    if (candidateReal === rootReal) return null;
    if (!candidateReal.startsWith(prefix)) return null;

    // --- File-type check --------------------------------------------------
    // stat (not lstat) follows symlinks; a symlink to a regular file inside
    // the root is allowed, while directories, sockets, FIFOs and devices are not.
    if (!fs.statSync(candidateReal).isFile()) return null;

    return candidateReal;
  } catch (err) {
    // ENOENT, ELOOP, EACCES, and any other resolution failure are reported as
    // a denial rather than thrown to the IPC caller.
    return null;
  }
}

module.exports = { safeFile };
