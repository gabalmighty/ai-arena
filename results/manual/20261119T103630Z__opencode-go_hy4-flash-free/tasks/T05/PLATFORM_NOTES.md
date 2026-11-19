# T05 platform notes

- **Actually tested on:** Microsoft Windows 10.0.26300 (host reported by .NET `RuntimeInformation`), Node.js v22.16.0, NTFS working tree.
- **Not tested:** Linux, macOS. No claim is made about their specific path semantics.
- The implementation uses `node:path` plus `fs.realpathSync.native` (available on this Node build) so it follows the host's own canonicalisation rules, and compares containment with `path.relative` rather than string prefixes (avoids the `docs` vs `docs-old` sibling-prefix mistake).
- The symlink-escape test was **skipped**: `fs.symlinkSync` returned `EPERM` on this Windows host (privilege/developer-mode restriction). The symlink logic is therefore reasoned about but **not empirically verified here**. Traversal, absolute-path, null-byte, nonexistent-file, root/directory, and valid-file cases were executed and passed (6 passed, 0 failed, 1 skipped).
- This is validation only; no file contents were read. No claim of protection against time-of-check/time-of-use (TOCTOU) races between validation and a later open by another component is made.
