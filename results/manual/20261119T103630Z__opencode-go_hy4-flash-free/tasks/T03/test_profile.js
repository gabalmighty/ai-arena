'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderProfile } = require('./profile');

test('malicious tags are encoded, never emitted as markup', () => {
  const out = renderProfile({ name: '<script>alert(1)</script>', role: '<img src=x onerror=alert(1)>' });
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(out, /&lt;img/);
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /<img/i);
  // "onerror=" is fine as escaped text; it must not be a real attribute inside a tag.
  assert.doesNotMatch(out, /<[^>]*onerror\s*=/i);
});

test('all five special characters are encoded', () => {
  const out = renderProfile({ name: `&<>"'`, role: `&<>"'` });
  assert.match(out, /&amp;&lt;&gt;&quot;&#39;/);
  assert.equal((out.match(/&amp;/g) || []).length, 2);
});

test('missing or empty name/role fall back to safe Unknown', () => {
  const out = renderProfile({});
  assert.match(out, />Unknown</);
  assert.equal((out.match(/Unknown/g) || []).length, 2);
  assert.ok(!out.includes('undefined'));
  assert.ok(!out.includes('null'));
  assert.match(renderProfile({ name: '', role: null }), />Unknown</);
});

test('button semantics: type=button, accessible name, no inline handler', () => {
  const out = renderProfile({ name: 'A', role: 'B' });
  assert.match(out, /<button type="button"[^>]*>/);
  assert.match(out, /Save profile/);
  assert.doesNotMatch(out, /onclick/i);
  assert.doesNotMatch(out, /on\w+\s*=/i);
  assert.doesNotMatch(out, /<script/i);
});

test('section has an accessible label and a heading', () => {
  const out = renderProfile({ name: 'Alice', role: 'Admin' });
  assert.match(out, /<section aria-label="User profile">/);
  assert.match(out, /<h2>Alice<\/h2>/);
  assert.match(out, />Role:<\/span>/);
});

test('input object is not mutated', () => {
  const user = Object.freeze({ name: 'Bob', role: 'User' });
  const before = JSON.stringify(user);
  renderProfile(user);
  assert.equal(JSON.stringify(user), before);
});
