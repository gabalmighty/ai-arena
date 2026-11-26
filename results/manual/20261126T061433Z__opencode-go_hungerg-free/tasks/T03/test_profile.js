const test = require('node:test');
const assert = require('node:assert/strict');
const { renderProfile } = require('./profile');

test('encodes malicious tags as text in name and role', () => {
  const html = renderProfile({
    name: '<script>alert("name")</script>',
    role: '<img src=x onerror=alert(1)>',
  });
  assert.ok(html.includes('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
});

test('encodes all required special characters', () => {
  const html = renderProfile({ name: `A&B<>"'`, role: `R&<>"'` });
  assert.ok(html.includes('A&amp;B&lt;&gt;&quot;&#39;'));
  assert.ok(html.includes('R&amp;&lt;&gt;&quot;&#39;'));
});

test('uses Unknown for absent or empty name and role', () => {
  const cases = [
    [{}, 2],
    [{ name: null, role: undefined }, 2],
    [{ name: '', role: '' }, 2],
    [null, 2],
  ];
  for (const [user, count] of cases) {
    const html = renderProfile(user);
    assert.equal((html.match(/Unknown/g) || []).length, count);
  }
});

test('has accessible section, heading, visible role label, and button semantics', () => {
  const html = renderProfile({ name: 'Ada', role: 'Admin' });
  assert.match(html, /<section\b[^>]*\baria-label="User profile"[^>]*>/);
  assert.match(html, /<h2>Ada<\/h2>/);
  assert.match(html, /<p><strong>Role:<\/strong> Admin<\/p>/);
  assert.match(html, /<button\b[^>]*\btype="button"[^>]*>/);
  assert.match(html, /<button\b[^>]*\baria-label="Save user profile"[^>]*>Save<\/button>/);
});

test('contains no inline event handlers or script elements', () => {
  const html = renderProfile({ name: 'Ada', role: 'Admin' });
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /<script\b/i);
});

test('does not mutate the input object', () => {
  const user = { name: 'Ada & Co', role: 'Engineer', extra: { keep: true } };
  const before = structuredClone(user);
  renderProfile(user);
  assert.deepEqual(user, before);
});
