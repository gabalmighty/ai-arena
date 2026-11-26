'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeFile } = require('./file_guard.js');

const TMP_BASE = path.join(os.tmpdir(), 'opencode');

// Build an isolated fixture. We only ever create/remove our own temp dirs.
function makeFixture(t) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  const parent = fs.mkdtempSync(path.join(TMP_BASE, 't05-'));
  const root = path.join(parent, 'docs');          // canonical root name 'docs'
  const sibling = path.join(parent, 'docs-old');   // sibling-prefix sibling
  const outside = path.join(parent, 'outside');    // separate outside tree
  fs.mkdirSync(root);
  fs.mkdirSync(sibling);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(root, 'inside.txt'), 'inside');
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'nested.txt'), 'nested');
  fs.writeFileSync(path.join(sibling, 'secret.txt'), 'sibling-secret');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside-secret');
  fs.writeFileSync(path.join(parent, 'loose.txt'), 'loose');
  t.after(() => { fs.rmSync(parent, { recursive: true, force: true }); }); // cleanup ONLY our temp
  return { parent, root, sibling, outside };
}

test('existing regular file inside root -> canonical absolute real path', (t) => {
  const { root } = makeFixture(t);
  const got = safeFile(root, 'inside.txt');
  assert.equal(got, fs.realpathSync(path.join(root, 'inside.txt')));
  assert.ok(path.isAbsolute(got));
  const nested = safeFile(root, path.join('sub', 'nested.txt'));
  assert.equal(nested, fs.realpathSync(path.join(root, 'sub', 'nested.txt')));
  // inside-normalizing traversal that stays inside root is fine
  assert.equal(safeFile(root, path.join('sub', '..', 'inside.txt')), fs.realpathSync(path.join(root, 'inside.txt')));
});

test('nonempty relative requirement: reject empty, null byte, absolute, non-string', (t) => {
  const { root } = makeFixture(t);
  assert.equal(safeFile(root, ''), null);                       // empty
  assert.equal(safeFile(root, 'inside.txt\0.png'), null);       // null byte
  assert.equal(safeFile(root, '\0'), null);                     // null byte
  assert.equal(safeFile(root, null), null);                     // non-string
  assert.equal(safeFile(root, undefined), null);                // non-string
  assert.equal(safeFile(root, 123), null);                      // non-string
  assert.equal(safeFile(root, {}), null);                       // non-string
  // absolute requested paths rejected (even pointing at a valid inside file)
  assert.equal(safeFile(root, fs.realpathSync(path.join(root, 'inside.txt'))), null);
  assert.equal(safeFile(root, path.join(root, 'inside.txt')), null);
  assert.equal(safeFile(root, '/etc/passwd'), null);
  assert.equal(safeFile(root, '\\windows\\win.ini'), null);
  assert.equal(safeFile(root, 'C:\\Windows\\win.ini'), null);
  assert.equal(safeFile(root, 'C:relative'), null);             // drive-relative
});

test('traversal outside root rejected; sibling-prefix (docs vs docs-old) rejected', (t) => {
  const { parent, root, sibling, outside } = makeFixture(t);
  assert.equal(safeFile(root, path.join('..', 'docs-old', 'secret.txt')), null); // sibling prefix
  assert.equal(safeFile(root, '..' + path.sep + 'docs-old' + path.sep + 'secret.txt'), null);
  assert.equal(safeFile(root, path.join('..', 'outside', 'secret.txt')), null);  // sibling outside
  assert.equal(safeFile(root, path.join('..', 'loose.txt')), null);              // parent file
  assert.equal(safeFile(root, path.join('..', '..', 'etc', 'passwd')), null);    // climb out
  assert.equal(safeFile(root, path.join('sub', '..', '..', 'loose.txt')), null); // normalize then escape
  assert.ok(fs.existsSync(path.join(sibling, 'secret.txt')));                    // we didn't delete anything
});

test('root itself, directories, and nonexistent files rejected', (t) => {
  const { root } = makeFixture(t);
  assert.equal(safeFile(root, '.'), null);        // root itself
  assert.equal(safeFile(root, ''), null);         // (also empty)
  assert.equal(safeFile(root, 'sub'), null);      // directory, not regular file
  assert.equal(safeFile(root, 'sub' + path.sep), null);
  assert.equal(safeFile(root, 'nope.txt'), null); // nonexistent
  assert.equal(safeFile(root, path.join('sub', 'nope.txt')), null);
  assert.equal(safeFile(root, '..'), null);       // parent dir
});

test('root directory must exist and be a directory; bad root -> null (no throw)', (t) => {
  const { root, parent } = makeFixture(t);
  assert.equal(safeFile(path.join(parent, 'no-such-dir'), 'inside.txt'), null);
  assert.equal(safeFile('', 'inside.txt'), null);
  assert.equal(safeFile(null, 'inside.txt'), null);           // type: ignore
  assert.equal(safeFile(path.join(root, 'inside.txt'), 'inside.txt'), null); // root is a file, not dir
  assert.equal(safeFile(root + '\0', 'inside.txt'), null);
});

test('returns null, never throws, on disallowed/unavailable inputs', (t) => {
  const { root } = makeFixture(t);
  assert.doesNotThrow(() => safeFile(root, '..' + path.sep + 'x'));
  assert.doesNotThrow(() => safeFile(root, '\0'));
  assert.doesNotThrow(() => safeFile(root, 'nope'));
  assert.equal(typeof safeFile(root, 'inside.txt'), 'string');
});

test('symlink escape forbidden; symlink to inside file allowed (if OS permits symlinks)', (t) => {
  const { root, outside } = makeFixture(t);

  // (a) FILE symlinks — may require elevated privilege on Windows
  let fileLinkOk = true;
  try {
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'escape.txt'), 'file'); // -> outside
    fs.symlinkSync(path.join(root, 'inside.txt'), path.join(root, 'alias.txt'), 'file');      // -> inside
  } catch { fileLinkOk = false; }
  if (fileLinkOk) {
    assert.equal(safeFile(root, 'escape.txt'), null); // real path escapes root -> rejected
    const alias = safeFile(root, 'alias.txt');
    assert.equal(alias, fs.realpathSync(path.join(root, 'inside.txt'))); // canonical inside target
  }

  // (b) DIRECTORY junction/symlink — often permitted without admin on Windows
  let dirLinkOk = true;
  try { fs.symlinkSync(outside, path.join(root, 'outdir'), 'junction'); }
  catch { dirLinkOk = false; }
  if (dirLinkOk) {
    assert.equal(safeFile(root, path.join('outdir', 'secret.txt')), null); // escapes root via dir link
  }

  if (!fileLinkOk && !dirLinkOk) { t.skip('OS does not permit creating symlinks here'); }
});
