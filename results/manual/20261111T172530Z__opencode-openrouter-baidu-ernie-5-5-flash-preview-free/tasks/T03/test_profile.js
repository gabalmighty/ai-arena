const test = require('node:test');
const assert = require('node:assert/strict');

const { renderProfile } = require('./profile.js');

test('escapes malicious markup in user-controlled name and role', () => {
  const html = renderProfile({
    name: '<script>alert("x")</script>',
    role: '<img src=x onerror="alert(1)">',
  });

  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('<img src=x onerror='), false);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test('encodes all five HTML text-content metacharacters', () => {
  const html = renderProfile({ name: `A&B <C> "D" 'E'`, role: 'R&D' });
  assert.match(html, /A&amp;B &lt;C&gt; &quot;D&quot; &#39;E&#39;/);
  assert.match(html, /R&amp;D/);
});

test('uses safe fallback for absent or empty values', () => {
  const html = renderProfile({ name: '', role: null });
  assert.match(html, /<h2>Unknown<\/h2>/);
  assert.match(html, /Role:<\/strong> Unknown/);
  assert.equal(renderProfile(null).includes('Unknown'), true);
  assert.equal(renderProfile({}).includes('Unknown'), true);
});

test('renders accessible section, heading, role label and save button', () => {
  const html = renderProfile({ name: 'Ada', role: 'Admin' });
  assert.match(html, /<section aria-label="User profile">/);
  assert.match(html, /<h2>Ada<\/h2>/);
  assert.match(html, /<strong>Role:<\/strong> Admin/);
  assert.match(html, /<button type="button" aria-label="Save profile">Save<\/button>/);
});

test('does not use inline handlers, script tags or dependencies', () => {
  const html = renderProfile({ name: 'Ada', role: 'Admin' });
  assert.equal(/on[a-z]+\s*=/i.test(html), false);
  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('javascript:'), false);
});

test('does not mutate its input', () => {
  const user = { name: 'Ada <Admin>', role: 'Admin & Owner' };
  const before = structuredClone(user);
  renderProfile(user);
  assert.deepEqual(user, before);
});