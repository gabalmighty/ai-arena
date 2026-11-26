'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderProfile } = require('./profile.js');

test('user-controlled name/role are HTML-text escaped; no user HTML becomes markup', () => {
  const out = renderProfile({
    name: '<img src=x onerror=alert(1)>',
    role: '<script>alert("x")</script>&',
  });
  // no raw injected tags/handlers
  assert.ok(!out.includes('<img'), out);
  assert.ok(!out.includes('<script'), out);
  assert.ok(!/<[a-zA-Z][^>]*\son\w+\s*=/i.test(out), out); // no inline event handler attribute
  assert.ok(!/<script>alert/i.test(out), out);
  // escaped forms present
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'), out);
  assert.ok(out.includes('&lt;script&gt;'), out);
  assert.ok(out.includes('&amp;'), out);
});

test('special characters & < > double-quote apostrophe are encoded', () => {
  const out = renderProfile({ name: 'A & B <c> "d" \'e\'', role: '"\'&<>' });
  assert.ok(out.includes('A &amp; B &lt;c&gt; &quot;d&quot; &#39;e&#39;'), out);
  assert.ok(out.includes('&quot;&#39;&amp;&lt;&gt;'), out);
  // raw dangerous chars from user input are not present unescaped in user slots
  assert.ok(!out.includes("'e'"), out);
});

test('absent name/role fall back to "Unknown"', () => {
  for (const u of [{}, { name: 'X' }, { role: 'Y' }, { name: null, role: null },
                   { name: undefined, role: undefined }]) {
    const out = renderProfile(u);
    assert.ok(out.includes('Unknown'), JSON.stringify(u) + ' -> ' + out);
  }
  // fallback "Unknown" is not itself user markup
  const out = renderProfile({});
  assert.ok(out.includes('<h2>Unknown</h2>'), out);
  assert.ok(out.includes('role-value">Unknown<'), out);
});

test('structure: section accessible label, heading, visible role label, button semantics', () => {
  const out = renderProfile({ name: 'Ada', role: 'Engineer' });
  assert.ok(out.includes('<section aria-label="User profile">'), out);
  assert.ok(/<h2[^>]*>Ada<\/h2>/.test(out), out);
  assert.ok(out.includes('Role'), out); // visible role label
  assert.ok(out.includes('Engineer'), out);
  assert.ok(out.includes('type="button"'), out);
  assert.ok(/<button[^>]*>[^<]*[A-Za-z]/.test(out), out); // meaningful accessible name
  assert.ok(!/\son\w+\s*=/.test(out), 'no inline event handlers: ' + out); // no onclick= etc
  assert.ok(!/<script/i.test(out), out);
});

test('does not mutate its input', () => {
  const input = { name: '<b>X</b>', role: 'Admin', extra: { a: 1 } };
  const snapshot = JSON.parse(JSON.stringify(input));
  const before = Object.getOwnPropertyNames(input);
  renderProfile(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(Object.getOwnPropertyNames(input), before);
  assert.equal(input.name, '<b>X</b>');
});
