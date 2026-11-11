const test = require("node:test");
const assert = require("node:assert/strict");
const { renderProfile } = require("./profile.js");

test("encodes malicious tags and special characters in text content", () => {
  const html = renderProfile({
    name: '<img src=x onerror=alert(1)> & "quote"',
    role: "Dev <Admin> 'lead'",
  });
  // User-controlled content must be rendered as encoded text, not executable markup.
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quote&quot;"));
  assert.ok(html.includes("Dev &lt;Admin&gt; &#39;lead&#39;"));
  assert.ok(!/<script/i.test(html));
});

test("uses safe fallbacks for missing or null values", () => {
  assert.match(renderProfile({}), /<h2>Unknown<\/h2>/);
  assert.match(renderProfile({ name: null, role: undefined }), /<h2>Unknown<\/h2>/);
  assert.match(renderProfile({ name: "", role: "" }), /<h2>Unknown<\/h2>[\s\S]*<span>Unknown<\/span>/);
});

test("includes accessible section label, heading, role label, and safe button semantics", () => {
  const html = renderProfile({ name: "Ada", role: "Engineer" });
  assert.match(html, /<section aria-label="User profile">/);
  assert.match(html, /<h2>Ada<\/h2>/);
  assert.match(html, /Role:/);
  assert.match(html, /<button type="button"[^>]*aria-label="Save profile"[^>]*>Save<\/button>/);
  assert.ok(!/onclick=/i.test(html));
  assert.ok(!/<script/i.test(html));
});

test("does not mutate input object", () => {
  const user = { name: "Ada", role: "Engineer" };
  const before = JSON.stringify(user);
  renderProfile(user);
  assert.equal(JSON.stringify(user), before);
});

test("handles non-object input safely", () => {
  const html = renderProfile(null);
  assert.match(html, /<h2>Unknown<\/h2>/);
  assert.match(html, /aria-label="User profile"/);
});
