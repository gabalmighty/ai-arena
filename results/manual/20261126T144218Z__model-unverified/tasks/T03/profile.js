'use strict';

// Escape a value for safe inclusion in HTML TEXT CONTENT.
// Encodes & < > " ' . Assumes input is not inserted into attributes/script/style;
// callers must keep user data in element text only. Order matters: & first.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FALLBACK = 'Unknown';

// Absent (undefined / null / missing) -> fallback. Otherwise render as string, escaped.
function field(value) {
  if (value === undefined || value === null) return FALLBACK;
  return String(value);
}

// Render an accessible, safe HTML profile string. No dependencies, no inline handlers,
// no user-controlled HTML, no input mutation. Returns a string.
function renderProfile(user) {
  const u = (user !== null && typeof user === 'object') ? user : {};
  const name = escapeHtml(field(u.name));
  const role = escapeHtml(field(u.role));

  return '<section aria-label="User profile">' +
    '<h2>' + name + '</h2>' +
    '<p class="role">' +
    '<span class="role-label">Role:</span> ' +
    '<span class="role-value">' + role + '</span>' +
    '</p>' +
    '<button type="button">Save profile</button>' +
    '</section>';
}

module.exports = { renderProfile, escapeHtml };
