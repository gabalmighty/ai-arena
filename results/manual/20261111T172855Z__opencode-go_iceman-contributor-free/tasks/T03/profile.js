function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderProfile(user) {
  const safeUser = user && typeof user === "object" ? user : {};
  const name = safeUser.name == null ? "Unknown" : String(safeUser.name);
  const role = safeUser.role == null ? "Unknown" : String(safeUser.role);
  const displayName = name === "" ? "Unknown" : name;
  const displayRole = role === "" ? "Unknown" : role;

  return (
    '<section aria-label="User profile">' +
    "<h2>" + escapeHtml(displayName) + "</h2>" +
    '<p><span>Role: </span><span>' + escapeHtml(displayRole) + "</span></p>" +
    '<button type="button" aria-label="Save profile">Save</button>' +
    "</section>"
  );
}

module.exports = { renderProfile };
