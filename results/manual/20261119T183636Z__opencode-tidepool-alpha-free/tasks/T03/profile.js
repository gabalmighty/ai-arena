'use strict';

/**
 * Escape a value for safe HTML text/attribute interpolation.
 * Encodes &, <, >, double quotes and apostrophes.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Fallback value for absent name/role input. */
function profileValue(value) {
  if (typeof value !== 'string' || value.length === 0) return 'Unknown';
  return value;
}

/**
 * Render a user profile as an HTML string.
 *
 * - User-controlled name/role are escaped and never interpolated as markup.
 * - The section carries an accessible label ("User profile"), a heading, a
 *   visible role label and a save button with type="button" and a meaningful
 *   accessible name.
 * - Absent name/role fall back to the safe literal "Unknown".
 * - The input is not mutated.
 */
function renderProfile(user) {
  const name = profileValue(user && user.name);
  const role = profileValue(user && user.role);
  return '<section aria-label="User profile">' +
    '<h2>' + escapeHtml(name) + '</h2>' +
    '<p class="role-label"><span class="role-label-prefix">Role:</span> <span class="role-value">' + escapeHtml(role) + '</span></p>' +
    '<button type="button" aria-label="Save profile">Save</button>' +
    '</section>';
}

module.exports = { renderProfile };
