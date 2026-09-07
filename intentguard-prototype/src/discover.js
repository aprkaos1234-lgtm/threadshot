'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

function claudeHome(explicit) {
  if (explicit) return explicit;
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
  return path.join(os.homedir(), '.claude');
}

// Claude Code encodes the project cwd into a directory name.
// Observed on v2.1.263: "/home/user/threadshot" -> "-home-user-threadshot".
// Non [A-Za-z0-9-] characters collapse to "-". We do NOT rely on this alone:
// every candidate dir is verified against the `cwd` field inside its JSONL.
function encodeProjectPath(p) {
  return p.replace(/[^A-Za-z0-9]/g, '-');
}

function listProjectDirs(home) {
  const root = path.join(home, 'projects');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name));
}

function sessionFiles(projectDir) {
  if (!fs.existsSync(projectDir)) return [];
  return fs.readdirSync(projectDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(projectDir, f))
    .sort();
}

// Read the first few lines of a transcript to learn which cwd it belongs to.
function peekCwd(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(64 * 1024, fs.statSync(file).size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    for (const line of buf.toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (o && typeof o.cwd === 'string') return o.cwd;
      } catch (_) { /* truncated tail line, ignore */ }
    }
  } catch (_) {
    /* unreadable */
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (_) {}
  }
  return null;
}

function summarizeProjects(home) {
  return listProjectDirs(home).map((dir) => {
    const files = sessionFiles(dir);
    let bytes = 0;
    let newest = null;
    for (const f of files) {
      const st = fs.statSync(f);
      bytes += st.size;
      if (!newest || st.mtimeMs > newest) newest = st.mtimeMs;
    }
    return {
      dir,
      name: path.basename(dir),
      cwd: files.length ? peekCwd(files[0]) : null,
      sessions: files.length,
      bytes,
      mtime: newest ? new Date(newest).toISOString() : null,
    };
  }).sort((a, b) => b.bytes - a.bytes);
}

// Windows paths are case-insensitive and users paste them with or without a
// trailing separator, so compare on a normalised form rather than raw equality.
function normPath(p) {
  if (!p) return '';
  return p.replace(/[\\/]+$/, '').toLowerCase();
}

// Resolve a user-supplied project path (or directory name) to a project dir.
function resolveProject(home, wanted) {
  const projects = summarizeProjects(home);
  if (!wanted) return projects;
  const abs = path.resolve(wanted);
  const enc = encodeProjectPath(abs).toLowerCase();
  // The `cwd` recorded inside the transcript is authoritative; the encoded
  // directory name is only a fallback, since the encoding is Claude Code's
  // private detail and could change.
  const exact = projects.filter((p) =>
    normPath(p.cwd) === normPath(abs) ||
    normPath(p.dir) === normPath(abs) ||
    p.name.toLowerCase() === enc ||
    p.name.toLowerCase() === encodeProjectPath(wanted).toLowerCase());
  if (exact.length) return exact;
  // fall back to substring match on the encoded name
  const needle = encodeProjectPath(wanted).replace(/^-+|-+$/g, '').toLowerCase();
  return projects.filter((p) => needle && p.name.toLowerCase().includes(needle));
}

module.exports = {
  claudeHome, encodeProjectPath, listProjectDirs, sessionFiles,
  peekCwd, summarizeProjects, resolveProject,
};
