'use strict';

// T03 tests — run with: node --test test_profile.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderProfile } = require('./profile');

test('escapes malicious script/image tags in name and role', () => {
  const html = renderProfile({
    name: '<script>alert("xss")</script>',
    role: '<img src=x onerror=alert(1)>',
  });
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img'), false);
  // The escaped text may retain the inert substring "onerror=", but no tag is formed.
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('onerror=alert(1)&gt;'));
});

test('escapes ampersand, angle brackets and both quote styles', () => {
  const html = renderProfile({ name: 'A & B "C" \'D\'', role: 'R&D <admin>' });
  assert.ok(html.includes('A &amp; B &quot;C&quot; &#39;D&#39;'));
  assert.ok(html.includes('R&amp;D &lt;admin&gt;'));
  assert.equal(html.includes('A & B'), false);
  assert.equal(html.includes('<admin>'), false);
});

test('falls back to Unknown for missing name and role', () => {
  const html = renderProfile({});
  assert.ok(html.includes('<h2>Unknown</h2>'));
  assert.ok(html.includes('<p>Unknown</p>'));
});

test('falls back independently when only one field is absent', () => {
  const html = renderProfile({ name: 'Ada' });
  assert.ok(html.includes('<h2>Ada</h2>'));
  assert.ok(html.includes('<p>Unknown</p>'));
  const html2 = renderProfile({ role: 'Admin' });
  assert.ok(html2.includes('<h2>Unknown</h2>'));
  assert.ok(html2.includes('<p>Admin</p>'));
});

test('button has type=button, a meaningful accessible name, and no inline handlers', () => {
  const html = renderProfile({ name: 'Ada', role: 'Admin' });
  assert.ok(html.includes('type="button"'));
  assert.ok(html.includes('Save profile'));
  assert.equal(/onclick/i.test(html), false);
  assert.equal(/onerror/i.test(html), false);
  assert.equal(/on[a-z]+\s*=/i.test(html), false);
});

test('section carries the accessible label and a heading', () => {
  const html = renderProfile({ name: 'Ada', role: 'Admin' });
  assert.ok(html.includes('<section aria-label="User profile">'));
  assert.ok(html.includes('<h2>'));
});

test('does not mutate its input object', () => {
  const user = { name: 'Ada', role: 'Admin' };
  const snapshot = JSON.stringify(user);
  renderProfile(user);
  assert.equal(JSON.stringify(user), snapshot);
});

test('handles null and non-object input without throwing', () => {
  assert.ok(renderProfile(null).includes('Unknown'));
  assert.ok(renderProfile(undefined).includes('Unknown'));
  assert.ok(renderProfile('nope').includes('Unknown'));
});
