'use strict';

// T03 — safe, accessible user-profile HTML rendering.
// User-controlled values are always HTML-escaped; they are never interpolated
// as markup. No inline event handlers, no script tags, no dependencies.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const ESCAPE_PATTERN = /[&<>"']/g;

function escapeHtml(value) {
  return String(value).replace(ESCAPE_PATTERN, (ch) => HTML_ESCAPES[ch]);
}

// Absent (undefined/null/empty) values fall back to the safe literal "Unknown".
function displayValue(value) {
  if (value === undefined || value === null) return 'Unknown';
  const text = String(value);
  return text === '' ? 'Unknown' : text;
}

function renderProfile(user) {
  // Never mutate the caller's object; only read from it.
  const source = user !== null && typeof user === 'object' ? user : {};
  const name = escapeHtml(displayValue(source.name));
  const role = escapeHtml(displayValue(source.role));

  return '<section aria-label="User profile">' +
    '<h2>' + name + '</h2>' +
    '<p>' + role + '</p>' +
    '<button type="button">Save profile</button>' +
    '</section>';
}

module.exports = { renderProfile };
