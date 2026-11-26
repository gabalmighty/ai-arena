const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { safeFile } = require('./file_guard');

let fixture;
let root;
let inside;
let outside;
let siblingPrefix;
let rootFile;
let escapeLink = null;
let escapeLinkIsFile = false;
let escapeLinkReason = null;

test.before(() => {
  fixture = fs.mkdtempSync(path.join(__dirname, 'fixture-'));
  root = path.join(fixture, 'root');
  outside = path.join(fixture, 'outside');
  siblingPrefix = path.join(fixture, 'root-old');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.mkdirSync(siblingPrefix, { recursive: true });
  inside = path.join(root, 'docs', 'inside.txt');
  fs.writeFileSync(inside, 'inside');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside');
  fs.writeFileSync(path.join(siblingPrefix, 'secret.txt'), 'sibling');
  rootFile = path.join(fixture, 'not-a-directory');
  fs.writeFileSync(rootFile, 'file');

  const link = path.join(root, 'escape-link');
  try {
    fs.symlinkSync(path.join(outside, 'secret.txt'), link, 'file');
    escapeLink = link;
    escapeLinkIsFile = true;
  } catch (error) {
    try {
      // Windows commonly permits directory junctions when file symlinks are denied.
      fs.symlinkSync(outside, link, 'junction');
      escapeLink = link;
    } catch (junctionError) {
      escapeLinkReason = `${error.code || error.message}; junction: ${junctionError.code || junctionError.message}`;
    }
  }
});

test.after(() => {
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
});

test('returns canonical absolute path for an existing inside file', () => {
  assert.equal(safeFile(root, 'docs/inside.txt'), fs.realpathSync(inside));
  assert.ok(path.isAbsolute(safeFile(root, 'docs/inside.txt')));
});

test('rejects absolute requested paths', () => {
  assert.equal(safeFile(root, inside), null);
  assert.equal(safeFile(root, '/etc/passwd'), null);
});

test('rejects traversal outside the root', () => {
  assert.equal(safeFile(root, '../outside/secret.txt'), null);
  assert.equal(safeFile(root, 'docs/../../outside/secret.txt'), null);
});

test('rejects a sibling path sharing the root prefix', () => {
  assert.equal(safeFile(root, '../root-old/secret.txt'), null);
});

test('rejects directories and the root itself', () => {
  assert.equal(safeFile(root, 'docs'), null);
  assert.equal(safeFile(root, '.'), null);
});

test('rejects nonexistent, empty, null-byte, and invalid-type inputs', () => {
  assert.equal(safeFile(root, 'missing.txt'), null);
  assert.equal(safeFile(root, ''), null);
  assert.equal(safeFile(root, 'docs/inside.txt\0.jpg'), null);
  assert.equal(safeFile(root, null), null);
  assert.equal(safeFile(null, 'docs/inside.txt'), null);
});

test('rejects missing or non-directory roots', () => {
  assert.equal(safeFile(path.join(fixture, 'missing-root'), 'file.txt'), null);
  assert.equal(safeFile(rootFile, 'anything'), null);
});

test('rejects a symlink or junction escaping the root', { skip: escapeLink === null }, (t) => {
  if (escapeLinkReason) t.diagnostic(escapeLinkReason);
  const request = escapeLinkIsFile ? 'escape-link' : 'escape-link/secret.txt';
  assert.equal(safeFile(root, request), null);
});
