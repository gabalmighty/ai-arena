'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Validation only: this never opens or reads the candidate file.
function safeFile(rootDirectory, requestedRelativePath) {
  try {
    if (typeof rootDirectory !== 'string' || rootDirectory.length === 0) return null;
    if (typeof requestedRelativePath !== 'string' || requestedRelativePath.length === 0) return null;
    if (rootDirectory.includes('\0') || requestedRelativePath.includes('\0')) return null;

    // Reject absolute, drive-relative (C:foo) and root-anchored paths.
    if (path.isAbsolute(requestedRelativePath)) return null;
    if (/^[A-Za-z]:/.test(requestedRelativePath)) return null;
    if (/^[/\\]/.test(requestedRelativePath)) return null;

    const realpath = fs.realpathSync.native || fs.realpathSync;

    // Canonicalise the root itself; a symlinked root is resolved to its target.
    const root = realpath(rootDirectory);
    if (!fs.statSync(root).isDirectory()) return null;

    // Canonicalise the requested file. This follows symlinks, so a link that
    // points outside the root resolves to its outside target and is rejected
    // by the containment check below. Nonexistent paths throw -> null.
    const candidate = realpath(path.resolve(root, requestedRelativePath));
    if (candidate === root) return null; // the root itself is not a requested file

    const rel = path.relative(root, candidate);
    if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep) ||
        path.isAbsolute(rel)) return null;

    // Must be an existing regular file, not a directory, special file or symlink
    // (symlinks have already been resolved by realpath).
    if (!fs.lstatSync(candidate).isFile()) return null;

    return candidate;
  } catch (err) {
    // ENOENT, EACCES, ELOOP, invalid arguments, etc. are all "not allowed".
    return null;
  }
}

module.exports = { safeFile };
