'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderProfile } = require('./profile.js');

test('escapes HTML tags and attributes in name (malicious input)', () => {
  const user = { name: '<img src=x onerror=alert(1)>', role: 'admin' };
  const out = renderProfile(user);
  assert.ok(out.includes('<h2>&lt;img src=x onerror=alert(1)&gt;</h2>'), out);
  assert.ok(!out.includes('<img src=x'), 'no raw <img> markup from input');
  assert.ok(!out.includes('<script'), 'no script tags from input');
});

test('special characters &, <, > are encoded in text content', () => {
  const out = renderProfile({ name: 'A & B <C>', role: 'R' });
  assert.ok(out.includes('A &amp; B &lt;C&gt;'), out);
});

test('apostrophes are encoded (&#39;) in name and role', () => {
  const out = renderProfile({ name: "O'Brien", role: "it's an admin" });
  assert.ok(out.includes('O&#39;Brien'), out);
  assert.ok(out.includes('it&#39;s an admin'), out);
});

test('missing name and role render the safe fallback "Unknown"', () => {
  const out = renderProfile({});
  assert.ok(out.includes('<h2>Unknown</h2>'), out);
  assert.ok(out.includes('role-value">Unknown<'), out);
  const out2 = renderProfile(null);
  assert.ok(out2.includes('<h2>Unknown</h2>'), out2);
});

test('save button: type="button" with a meaningful accessible name; no inline handlers', () => {
  const out = renderProfile({ name: 'N', role: 'R' });
  assert.ok(
    out.includes('<button type="button" aria-label="Save profile">Save</button>'),
    out,
  );
  assert.ok(!/on\w+\s*=/.test(out), 'no inline event handlers');
  assert.ok(!out.includes('<script'), 'no script tags');
});

test('section has an accessible label and a heading; role is visibly labeled', () => {
  const out = renderProfile({ name: 'N', role: 'admin' });
  assert.ok(out.includes('aria-label="User profile"'), out);
  assert.ok(/<h[1-6]>/.test(out), 'a heading element is present');
  assert.ok(out.includes('role-label'), out);
});

test('input is not mutated by rendering', () => {
  const user = { name: '<b>x</b>', role: 'r' };
  const before = JSON.stringify(user);
  renderProfile(user);
  renderProfile(user);
  assert.equal(JSON.stringify(user), before);
});
