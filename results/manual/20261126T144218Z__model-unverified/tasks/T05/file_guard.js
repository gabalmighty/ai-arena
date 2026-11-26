'use strict';
const path = require('node:path');
const fs = require('node:fs');

// --- unsafe original starter (preserved for reference; NOT used) -------------
// const path = require('node:path');
// function safeFile(rootDirectory, requestedRelativePath) {
//   return path.join(rootDirectory, requestedRelativePath);
// }
// module.exports = { safeFile };
// -----------------------------------------------------------------------------

function hasNullByte(s) { return s.includes('\u0000'); }

// Strict containment: target must be strictly INSIDE root (root itself excluded).
function isInside(root, p) {
  const rel = path.relative(root, p);
  if (rel === '') return false;                 // == root
  if (rel === '..') return false;
  if (rel.startsWith('..' + path.sep)) return false; // escapes root
  if (path.isAbsolute(rel)) return false;
  return true;
}

function samePath(a, b) { return path.relative(a, b) === ''; }

function isAbsoluteAnywhere(p) {
  return path.isAbsolute(p) || path.win32.isAbsolute(p) || path.posix.isAbsolute(p) ||
    /^[a-zA-Z]:/.test(p); // drive-letter forms, incl. drive-relative C:foo
}

/**
 * safeFile(rootDirectory, requestedRelativePath) -> canonical absolute path | null
 *
 * Validation only; never reads/writes file contents; returns null (not a thrown
 * error) for disallowed/unavailable inputs.
 */
function safeFile(rootDirectory, requestedRelativePath) {
  try {
    // --- requestedRelativePath checks ---
    if (typeof requestedRelativePath !== 'string') return null;
    if (requestedRelativePath === '') return null;                 // nonempty
    if (hasNullByte(requestedRelativePath)) return null;           // null byte
    if (isAbsoluteAnywhere(requestedRelativePath)) return null;    // must be RELATIVE
    // reject rooted UNC / leading separators explicitly
    if (requestedRelativePath.startsWith('\\') || requestedRelativePath.startsWith('/')) return null;

    // --- rootDirectory checks ---
    if (typeof rootDirectory !== 'string') return null;
    if (rootDirectory === '') return null;
    if (hasNullByte(rootDirectory)) return null;

    // canonical root; root must EXIST and be a directory (realpath throws -> null)
    const rootReal = fs.realpathSync(rootDirectory);
    if (!fs.statSync(rootReal).isDirectory()) return null;

    // lexical join + normalize, then re-check containment BEFORE touching disk
    const lexical = path.resolve(rootReal, requestedRelativePath);
    if (!isInside(rootReal, lexical)) return null; // isInside excludes root itself

    // canonical target; nonexistent -> realpathSync throws -> null; symlinks resolved
    const realTarget = fs.realpathSync(lexical);

    // containment on REAL (symlink-resolved) paths; a symlink escaping root is rejected
    if (!isInside(rootReal, realTarget)) return null;
    if (samePath(rootReal, realTarget)) return null; // root itself not allowed

    // must be an existing REGULAR file (not dir, not symlink target type, not special)
    const st = fs.statSync(realTarget); // realTarget already canonical
    if (!st.isFile()) return null;

    return realTarget; // canonical absolute path
  } catch {
    return null; // any fs/encoding error -> null, never crash caller
  }
}

module.exports = { safeFile };
