'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeFile } = require('./file_guard');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-fileguard-'));
const root = path.join(tmp, 'docs');       // deliberately a prefix of docs-old
const sibling = path.join(tmp, 'docs-old');
fs.mkdirSync(root);
fs.mkdirSync(sibling);
const inside = path.join(root, 'inside.txt');
const outside = path.join(sibling, 'secret.txt');
fs.writeFileSync(inside, 'inside');
fs.writeFileSync(outside, 'outside');

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const real = (p) => (fs.realpathSync.native || fs.realpathSync)(p);

test('valid inside file returns its canonical absolute path', () => {
  assert.equal(safeFile(root, 'inside.txt'), real(inside));
  assert.ok(path.isAbsolute(safeFile(root, 'inside.txt')));
});

test('traversal outside root is rejected', () => {
  assert.equal(safeFile(root, path.join('..', 'docs-old', 'secret.txt')), null);
});

test('absolute path is rejected', () => {
  assert.equal(safeFile(root, outside), null);
});

test('null byte / invalid input is rejected without throwing', () => {
  assert.equal(safeFile(root, 'inside.txt\0.txt'), null);
  assert.equal(safeFile(root, ''), null);
  assert.equal(safeFile(root, null), null);
  assert.equal(safeFile('', 'inside.txt'), null);
});

test('nonexistent file is rejected', () => {
  assert.equal(safeFile(root, 'does-not-exist.txt'), null);
  assert.equal(safeFile(path.join(tmp, 'no-such-root'), 'inside.txt'), null);
});

test('root directory and other directories are outside requested-file scope', () => {
  assert.equal(safeFile(root, '.'), null);
  assert.equal(safeFile(root, path.join('.', '..', 'docs')), null);
});

test('symlink escape is rejected (when symlinks are permitted)', (t) => {
  const link = path.join(root, 'escape-link.txt');
  try {
    fs.symlinkSync(outside, link, 'file');
  } catch (e) {
    t.skip('symlink creation not permitted on this host: ' + e.code);
    return;
  }
  assert.equal(safeFile(root, 'escape-link.txt'), null);
});
