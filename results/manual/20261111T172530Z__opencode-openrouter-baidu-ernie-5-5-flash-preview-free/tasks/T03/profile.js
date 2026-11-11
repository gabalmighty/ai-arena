function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textOrUnknown(value) {
  if (value === null || value === undefined || value === '') {
    return 'Unknown';
  }
  return escapeHtml(value);
}

function renderProfile(user) {
  const name = textOrUnknown(user && user.name);
  const role = textOrUnknown(user && user.role);

  return '<section aria-label="User profile">' +
    '<h2>' + name + '</h2>' +
    '<p><strong>Role:</strong> ' + role + '</p>' +
    '<button type="button" aria-label="Save profile">Save</button>' +
    '</section>';
}

module.exports = { renderProfile };