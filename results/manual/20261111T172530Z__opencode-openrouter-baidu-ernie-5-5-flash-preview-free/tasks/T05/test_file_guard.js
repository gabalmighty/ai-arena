const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { safeFile } = require('./file_guard.js');

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-arena-file-guard-'));
  const root = path.join(base, 'docs');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'inside.txt'), 'inside');
  return { base, root };
}

test('accepts an existing regular file inside the canonical root', () => {
  const { base, root } = fixture();
  try {
    const result = safeFile(root, 'inside.txt');
    assert.equal(result, fs.realpathSync(path.join(root, 'inside.txt')));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects absolute paths and paths outside the root', () => {
  const { base, root } = fixture();
  try {
    const outside = path.join(base, 'outside.txt');
    fs.writeFileSync(outside, 'outside');
    assert.equal(safeFile(root, outside), null);
    assert.equal(safeFile(root, '../outside.txt'), null);
    assert.equal(safeFile(root, path.join('..', 'outside.txt')), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects sibling-prefix paths such as docs-old', () => {
  const { base, root } = fixture();
  try {
    const sibling = path.join(base, 'docs-old');
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret');
    assert.equal(safeFile(root, '../docs-old/secret.txt'), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects root itself, directories, missing files and empty input', () => {
  const { base, root } = fixture();
  try {
    assert.equal(safeFile(root, ''), null);
    assert.equal(safeFile(root, '.'), null);
    assert.equal(safeFile(root, 'missing.txt'), null);
    fs.mkdirSync(path.join(root, 'subdir'));
    assert.equal(safeFile(root, 'subdir'), null);
    assert.equal(safeFile(root, null), null);
    assert.equal(safeFile(root, 'bad\0name'), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects a symlink that escapes the root when symlinks are permitted', () => {
  const { base, root } = fixture();
  try {
    const outside = path.join(base, 'outside-secret.txt');
    fs.writeFileSync(outside, 'secret');
    try {
      fs.symlinkSync(outside, path.join(root, 'escape.txt'), 'file');
    } catch (error) {
      console.log('symlink escape test skipped:', error.code || error.message);
      return;
    }
    assert.equal(safeFile(root, 'escape.txt'), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('accepts a symlink that stays inside the root', () => {
  const { base, root } = fixture();
  try {
    const target = path.join(root, 'inside.txt');
    try {
      fs.symlinkSync(target, path.join(root, 'inside-link.txt'), 'file');
    } catch (error) {
      console.log('inside symlink test skipped:', error.code || error.message);
      return;
    }
    assert.equal(safeFile(root, 'inside-link.txt'), fs.realpathSync(target));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});