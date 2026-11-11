'use strict';

// T05 tests — run with: node --test test_file_guard.js
// Host: Microsoft Windows NT 10.0.26200.0, Node v24.19.0.
// Creates its own temporary fixture directory and removes only that directory.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeFile } = require('./file_guard');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-guard-'));
  fs.writeFileSync(path.join(root, 'inside.txt'), 'inside', 'utf8');
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'nested.txt'), 'nested', 'utf8');

  // Outside file in the parent of root (reachable via "../").
  const outside = path.join(path.dirname(root), 'file-guard-outside-' + path.basename(root) + '.txt');
  fs.writeFileSync(outside, 'outside', 'utf8');

  // Sibling directory sharing a prefix with the root (docs vs docs-old case).
  const sibling = root + '-old';
  fs.mkdirSync(sibling);
  fs.writeFileSync(path.join(sibling, 'sibling.txt'), 'sibling', 'utf8');

  return { root, outside, sibling };
}

function cleanup(fixture) {
  for (const p of [fixture.root, fixture.outside, fixture.sibling]) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch (err) {
      // best-effort cleanup of test-created paths only
    }
  }
}

test('accepts an existing regular file inside the root and returns its canonical path', () => {
  const fixture = makeFixture();
  try {
    const expected = fs.realpathSync(path.join(fixture.root, 'inside.txt'));
    const result = safeFile(fixture.root, 'inside.txt');
    assert.equal(result, expected);
    assert.ok(path.isAbsolute(result));
  } finally {
    cleanup(fixture);
  }
});

test('accepts a nested regular file inside the root', () => {
  const fixture = makeFixture();
  try {
    const expected = fs.realpathSync(path.join(fixture.root, 'sub', 'nested.txt'));
    assert.equal(safeFile(fixture.root, path.join('sub', 'nested.txt')), expected);
  } finally {
    cleanup(fixture);
  }
});

test('rejects the root directory itself', () => {
  const fixture = makeFixture();
  try {
    assert.equal(safeFile(fixture.root, '.'), null);
    assert.equal(safeFile(fixture.root, ''), null);
  } finally {
    cleanup(fixture);
  }
});

test('rejects subdirectories and nonexistent files', () => {
  const fixture = makeFixture();
  try {
    assert.equal(safeFile(fixture.root, 'sub'), null);
    assert.equal(safeFile(fixture.root, 'missing.txt'), null);
  } finally {
    cleanup(fixture);
  }
});

test('rejects traversal outside the root', () => {
  const fixture = makeFixture();
  try {
    assert.equal(safeFile(fixture.root, '..' + path.sep + path.basename(fixture.outside)), null);
    assert.equal(safeFile(fixture.root, 'sub/../outside.txt'), null);
  } finally {
    cleanup(fixture);
  }
});

test('rejects a sibling directory that shares a prefix with the root', () => {
  const fixture = makeFixture();
  try {
    const rel = '..' + path.sep + path.basename(fixture.sibling) + path.sep + 'sibling.txt';
    assert.equal(safeFile(fixture.root, rel), null);
  } finally {
    cleanup(fixture);
  }
});

test('rejects absolute paths, drive paths and null bytes', () => {
  const fixture = makeFixture();
  try {
    assert.equal(safeFile(fixture.root, fixture.outside), null);
    assert.equal(safeFile(fixture.root, 'C:\\Windows\\win.ini'), null);
    assert.equal(safeFile(fixture.root, 'inside.txt\0'), null);
    assert.equal(safeFile(fixture.root, '\0inside.txt'), null);
  } finally {
    cleanup(fixture);
  }
});

test('rejects a root that does not exist or is not a directory', () => {
  assert.equal(safeFile(path.join(os.tmpdir(), 'file-guard-does-not-exist-' + Date.now()), 'x.txt'), null);
  const fileAsRoot = path.join(os.tmpdir(), 'file-guard-file-root-' + Date.now() + '.txt');
  fs.writeFileSync(fileAsRoot, 'x', 'utf8');
  try {
    assert.equal(safeFile(fileAsRoot, 'inside.txt'), null);
  } finally {
    fs.rmSync(fileAsRoot, { force: true });
  }
});

test('returns null for non-string and malformed inputs', () => {
  const fixture = makeFixture();
  try {
    assert.equal(safeFile(null, 'inside.txt'), null);
    assert.equal(safeFile(fixture.root, null), null);
    assert.equal(safeFile(fixture.root, 123), null);
    assert.equal(safeFile(fixture.root, '   '), null);
  } finally {
    cleanup(fixture);
  }
});

test('rejects a symlink that escapes the root', (t) => {
  const fixture = makeFixture();
  try {
    const linkPath = path.join(fixture.root, 'escape-link.txt');
    try {
      fs.symlinkSync(fixture.outside, linkPath, 'file');
    } catch (err) {
      // EPERM on Windows without Developer Mode / admin: the escape path
      // cannot be exercised on this host, so record an explicit skip.
      t.skip('symlink creation not permitted on this host: ' + err.code);
      return;
    }
    assert.equal(safeFile(fixture.root, 'escape-link.txt'), null);
  } finally {
    cleanup(fixture);
  }
});

test('accepts a symlink that points to a regular file inside the root', (t) => {
  const fixture = makeFixture();
  try {
    const linkPath = path.join(fixture.root, 'inside-link.txt');
    try {
      fs.symlinkSync(path.join(fixture.root, 'inside.txt'), linkPath, 'file');
    } catch (err) {
      t.skip('symlink creation not permitted on this host: ' + err.code);
      return;
    }
    const expected = fs.realpathSync(path.join(fixture.root, 'inside.txt'));
    assert.equal(safeFile(fixture.root, 'inside-link.txt'), expected);
  } finally {
    cleanup(fixture);
  }
});
