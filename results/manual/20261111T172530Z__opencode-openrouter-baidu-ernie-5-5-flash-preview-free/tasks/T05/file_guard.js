const fs = require('node:fs');
const path = require('node:path');

function isStrictlyInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative);
}

function safeFile(rootDirectory, requestedRelativePath) {
  try {
    if (typeof rootDirectory !== 'string' || rootDirectory.length === 0) {
      return null;
    }
    if (typeof requestedRelativePath !== 'string' || requestedRelativePath.length === 0) {
      return null;
    }
    if (rootDirectory.includes('\0') || requestedRelativePath.includes('\0')) {
      return null;
    }
    if (path.isAbsolute(requestedRelativePath) || path.win32.isAbsolute(requestedRelativePath)) {
      return null;
    }
    if (/^[A-Za-z]:/.test(requestedRelativePath)) {
      return null;
    }

    const rootAbsolute = path.resolve(rootDirectory);
    const joined = path.resolve(rootAbsolute, requestedRelativePath);
    if (!isStrictlyInside(rootAbsolute, joined)) {
      return null;
    }

    const rootReal = fs.realpathSync(rootAbsolute);
    if (!fs.statSync(rootReal).isDirectory()) {
      return null;
    }

    const candidateReal = fs.realpathSync(joined);
    if (!isStrictlyInside(rootReal, candidateReal)) {
      return null;
    }
    if (!fs.statSync(candidateReal).isFile()) {
      return null;
    }

    return candidateReal;
  } catch {
    return null;
  }
}

module.exports = { safeFile };