'use strict';

const fs = require('node:fs');
const path = require('node:path');

function safeFile(rootDirectory, requestedRelativePath) {
  try {
    if (typeof rootDirectory !== 'string' || rootDirectory.length === 0 ||
        rootDirectory.includes('\0')) {
      return null;
    }
    if (typeof requestedRelativePath !== 'string' || requestedRelativePath.length === 0 ||
        requestedRelativePath.includes('\0')) {
      return null;
    }
    if (path.isAbsolute(requestedRelativePath) || path.win32.isAbsolute(requestedRelativePath) ||
        path.win32.parse(requestedRelativePath).root) {
      return null;
    }

    const canonicalRoot = fs.realpathSync.native(rootDirectory);
    if (!fs.statSync(canonicalRoot).isDirectory()) return null;

    const candidate = path.resolve(canonicalRoot, requestedRelativePath);
    const canonicalCandidate = fs.realpathSync.native(candidate);
    const relative = path.relative(canonicalRoot, canonicalCandidate);
    if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)) {
      return null;
    }

    // Validation only: this does not open the file. A caller that later opens the
    // returned path still needs its own TOCTOU-safe strategy.
    return fs.statSync(canonicalCandidate).isFile() ? canonicalCandidate : null;
  } catch {
    return null;
  }
}

module.exports = { safeFile };
