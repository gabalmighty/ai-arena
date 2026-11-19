'use strict';

/**
 * safeFile(rootDirectory, requestedRelativePath) -> canonical absolute path or null.
 *
 * Desktop app IPC validation: returns the canonical absolute path of the requested
 * file when it is an existing regular file strictly inside the canonical root
 * directory; null for any disallowed or unavailable input (never throws to the caller).
 *
 * Rules enforced:
 * - requestedRelativePath must be a nonempty relative path: rejects absolute paths
 *   (POSIX/win32/UNC), drive-relative forms such as "C:foo", traversal that escapes
 *   the root (".."), invalid input and null bytes.
 * - Root directory must exist and be a directory.
 * - Both the root and the final candidate are resolved with real filesystem paths
 *   (realpathSync); a symlink that escapes the canonical root is forbidden.
 * - The candidate must be an existing regular file within the canonical root; the
 *   root itself is treated as outside the requested-file scope, and other
 *   directories or special files are rejected.
 * - No file contents are read or written (validation only).
 * - Uses only Node built-ins. NOT protected against symlink TOCTOU races.
 *
 * Platform tested: Windows 11 (host) — see tasks/T05/notes.md.
 */

const path = require('node:path');
const fs = require('node:fs');

function safeFile(rootDirectory, requestedRelativePath) {
  try {
    if (typeof rootDirectory !== 'string' || rootDirectory.trim() === '') return null;
    if (typeof requestedRelativePath !== 'string' || requestedRelativePath === '') return null;
    if (requestedRelativePath.includes('\0')) return null;
    // ':' cannot appear in a relative path on Windows (filenames cannot contain
    // ':'), so any ':' means an absolute/drive-relative/UNC-ish or invalid path.
    if (requestedRelativePath.includes(':')) return null;
    if (path.isAbsolute(requestedRelativePath) ||
        path.win32.isAbsolute(requestedRelativePath) ||
        path.posix.isAbsolute(requestedRelativePath)) return null;

    const normalized = path.normalize(requestedRelativePath);
    if (normalized === '' || normalized === '.' || normalized === '..' ||
        normalized.startsWith('..' + path.sep) || path.isAbsolute(normalized)) {
      return null;
    }

    const rootReal = fs.realpathSync(rootDirectory);
    if (!fs.statSync(rootReal).isDirectory()) return null;

    const candidate = path.join(rootReal, normalized);
    const candidateReal = fs.realpathSync(candidate); // throws if missing or dangling
    const rel = path.relative(rootReal, candidateReal);
    if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep) ||
        path.isAbsolute(rel)) {
      return null; // outside the canonical root, including escaping symlinks
    }

    const stats = fs.statSync(candidateReal);
    if (!stats.isFile()) return null; // directory, special file, etc.
    return candidateReal;
  } catch {
    return null;
  }
}

module.exports = { safeFile };
