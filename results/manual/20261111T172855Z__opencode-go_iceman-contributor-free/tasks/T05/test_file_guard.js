const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { safeFile } = require("./file_guard.js");

function makeFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "file-guard-"));
  const root = path.join(base, "root");
  const outside = path.join(base, "outside.txt");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs-old"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "inside.txt"), "inside", "utf8");
  fs.writeFileSync(path.join(root, "docs-old", "sib.txt"), "sibling", "utf8");
  fs.writeFileSync(outside, "outside", "utf8");
  return { base, root, outside };
}

test("allows existing regular file inside root and returns canonical absolute path", (t) => {
  const fx = makeFixture();
  t.after(() => fs.rmSync(fx.base, { recursive: true, force: true }));
  const res = safeFile(fx.root, path.join("docs", "inside.txt"));
  assert.equal(res, fs.realpathSync(path.join(fx.root, "docs", "inside.txt")));
  assert.ok(path.isAbsolute(res));
});

test("rejects outside file, traversal, sibling-prefix confusion, root itself, nonexistent, and invalid input", (t) => {
  const fx = makeFixture();
  t.after(() => fs.rmSync(fx.base, { recursive: true, force: true }));
  const outsideRel = path.relative(fx.root, fx.outside);
  assert.equal(safeFile(fx.root, outsideRel), null);
  assert.equal(safeFile(fx.root, "../outside.txt"), null);
  assert.equal(safeFile(fx.root, "docs/../../outside.txt"), null);
  assert.equal(safeFile(fx.root, "docs-old/sib.txt") !== null, true); // inside root, different dir
  // sibling prefix root name confusion attempt relative style
  assert.equal(safeFile(fx.root, "docs"), null); // directory, not regular file
  assert.equal(safeFile(fx.root, ""), null);
  assert.equal(safeFile(fx.root, "docs/nope.txt"), null);
  assert.equal(safeFile(fx.root, path.resolve(fx.root, "docs", "inside.txt")), null);
  assert.equal(safeFile(fx.root, "docs/inside.txt\u0000"), null);
  assert.equal(safeFile("", "docs/inside.txt"), null);
});

test("rejects symlink escape if OS permits creating symlinks", async (t) => {
  const fx = makeFixture();
  t.after(() => fs.rmSync(fx.base, { recursive: true, force: true }));
  const linkPath = path.join(fx.root, "docs", "link-out.txt");
  let canSymlink = true;
  try {
    fs.symlinkSync(fx.outside, linkPath);
  } catch (e) {
    canSymlink = false;
  }
  if (!canSymlink) {
    t.skip("symlink creation not permitted on this host; symlink-escape check not executed");
    return;
  }
  assert.equal(safeFile(fx.root, path.join("docs", "link-out.txt")), null);
});
