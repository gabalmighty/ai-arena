function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textOrUnknown(value) {
  return value === undefined || value === null || value === '' ? 'Unknown' : value;
}

function renderProfile(user) {
  const profile = user && typeof user === 'object' ? user : {};
  const name = escapeHtml(textOrUnknown(profile.name));
  const role = escapeHtml(textOrUnknown(profile.role));
  return '<section aria-label="User profile">' +
    '<h2>' + name + '</h2>' +
    '<p><strong>Role:</strong> ' + role + '</p>' +
    '<button type="button" aria-label="Save user profile">Save</button>' +
    '</section>';
}

module.exports = { renderProfile };
