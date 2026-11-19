'use strict';

// Encode for HTML *text* context. & must be replaced first so that the
// entities we introduce are not themselves re-encoded.
function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return 'Unknown';
  return escapeHtmlText(value);
}

function renderProfile(user) {
  const source = user && typeof user === 'object' ? user : {};
  const name = displayValue(source.name);
  const role = displayValue(source.role);

  return '<section aria-label="User profile">' +
    '<h2>' + name + '</h2>' +
    '<p><span class="role-label">Role:</span> ' + role + '</p>' +
    '<button type="button" aria-label="Save profile">Save</button>' +
    '</section>';
}

module.exports = { renderProfile };
