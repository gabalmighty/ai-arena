'use strict';

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { safeFile } = require('./file_guard.js');

// Fixture: base/
//   docs/inside.txt, docs/sub/deep.txt        (the root under test)
//   docs-old/secret.txt                       (sibling prefix of root)
//   outside.txt                               (outside root)
const fixtures = [];

function makeFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fileguard-'));
  const root = path.join(base, 'docs');
  const sibling = path.join(base, 'docs-old');
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(root, 'inside.txt'), 'inside');
  fs.writeFileSync(path.join(root, 'sub', 'deep.txt'), 'deep');
  fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret');
  fs.writeFileSync(path.join(base, 'outside.txt'), 'outside');
  fixtures.push(base);
  return { base, root, sibling };
}

after(() => {
  // Clean up only test-created temporary files.
  for (const base of fixtures) fs.rmSync(base, { recursive: true, force: true });
});

test('inside file resolves to the canonical path inside the root', () => {
  const { root } = makeFixture();
  const result = safeFile(root, 'inside.txt');
  assert.equal(path.isAbsolute(result), true);
  assert.equal(result, fs.realpathSync(path.join(root, 'inside.txt')));
});

test('nested file inside the root is allowed', () => {
  const { root } = makeFixture();
  assert.equal(
    safeFile(root, path.join('sub', 'deep.txt')),
    fs.realpathSync(path.join(root, 'sub', 'deep.txt')),
  );
});

test('traversal outside the root is rejected', () => {
  const { root, base } = makeFixture();
  assert.equal(safeFile(root, '../outside.txt'), null);
  assert.equal(safeFile(root, 'sub/../../outside.txt'), null);
  assert.equal(safeFile(root, path.relative(root, path.join(base, 'outside.txt'))), null);
});

test('sibling-prefix confusion (docs vs docs-old) is rejected', () => {
  const { root, sibling } = makeFixture();
  // A naive startsWith(root) check would accept these; the canonical-relative
  // check must not.
  assert.equal(safeFile(root, '../docs-old/secret.txt'), null);
  assert.equal(safeFile(root, path.relative(root, path.join(sibling, 'secret.txt'))), null);
});

test('nonexistent file, directory, root itself, and missing root are rejected', () => {
  const { root, base } = makeFixture();
  assert.equal(safeFile(root, 'missing.txt'), null);
  assert.equal(safeFile(root, 'sub'), null); // a directory inside the root
  assert.equal(safeFile(root, '.'), null); // the root itself is out of scope
  assert.equal(safeFile(path.join(base, 'nope'), 'inside.txt'), null); // root must exist
});

test('absolute paths, drive forms and null bytes are rejected', () => {
  const { root, base } = makeFixture();
  assert.equal(safeFile(root, path.join(root, 'inside.txt')), null); // absolute
  assert.equal(safeFile(root, 'C:\\outside\\x.txt'), null); // absolute (win32)
  assert.equal(safeFile(root, 'C:outside.txt'), null); // drive-relative
  assert.equal(safeFile(root, 'inside\0.txt'), null); // null byte
  assert.equal(safeFile(root, ''), null);
  assert.equal(safeFile(root, null), null);
  assert.equal(safeFile(root, undefined), null);
  assert.equal(safeFile('', 'inside.txt'), null);
  assert.equal(safeFile(base + '\\nope', 'inside.txt'), null); // root does not exist
});

test('symlink escaping the root is rejected; symlink inside root is allowed', () => {
  const { base, root } = makeFixture();
  const escapeLink = path.join(root, 'escape-link');
  try {
    fs.symlinkSync(path.join(base, 'outside.txt'), escapeLink, 'file');
  } catch {
    // Windows without symlink privileges: skip, per "if OS permits symlinks".
    return;
  }
  assert.equal(safeFile(root, 'escape-link'), null);
  const innerLink = path.join(root, 'inner-link');
  fs.symlinkSync(path.join(root, 'inside.txt'), innerLink, 'file');
  assert.equal(safeFile(root, 'inner-link'), fs.realpathSync(path.join(root, 'inside.txt')));
});
