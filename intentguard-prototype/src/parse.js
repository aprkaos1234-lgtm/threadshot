'use strict';
const fs = require('fs');

/*
 * Claude Code transcript parser.
 *
 * Written against v2.1.263 after inspecting the real on-disk records — not
 * against an example file. Every assumption that could silently drift with a
 * Claude Code release is recorded in `diagnostics` so that schema variation
 * shows up as data instead of as a wrong answer.
 *
 * The single most important fact: `type: "user"` covers BOTH real human
 * prompts AND tool results. `message.role === "user"` proves nothing, and
 * `promptId` is inherited by tool results from the human turn that spawned
 * them, so it proves nothing either.
 */

const HUMAN_MARKERS = ['origin', 'promptSource', 'permissionMode'];

function newDiagnostics() {
  return {
    files: 0,
    linesRead: 0,
    parseFailures: 0,
    parseFailureSamples: [],
    duplicateUuids: 0,
    recordTypes: {},          // every `type` seen
    unknownRecordTypes: {},   // types this parser has no explicit route for
    attachmentTypes: {},      // attachment sub-kinds seen
    userContentShapes: {},    // string | list of block types
    unknownContentBlocks: {},
    missingTimestamp: 0,
    sidechainEntries: 0,
    humanSignalCoverage: {},  // which human-marker fields were present
    versions: {},
    entrypoints: {},
  };
}

const KNOWN_TYPES = new Set([
  'user', 'assistant', 'attachment', 'system', 'summary',
  'queue-operation', 'atis-latch', 'last-prompt', 'file-history-snapshot',
]);

function bump(obj, key) {
  if (key === undefined || key === null) key = '(none)';
  obj[key] = (obj[key] || 0) + 1;
}

/** Flatten message.content into { text, blockTypes, hasToolResult }. */
function readContent(message, diag) {
  const out = { text: '', blockTypes: [], hasToolResult: false };
  if (!message) return out;
  const c = message.content;
  if (typeof c === 'string') {
    out.text = c;
    out.blockTypes.push('string');
    return out;
  }
  if (!Array.isArray(c)) {
    out.blockTypes.push(typeof c);
    return out;
  }
  const parts = [];
  for (const b of c) {
    if (typeof b === 'string') { parts.push(b); out.blockTypes.push('rawstring'); continue; }
    if (!b || typeof b !== 'object') { out.blockTypes.push('?'); continue; }
    out.blockTypes.push(b.type || '?');
    switch (b.type) {
      case 'text':
        if (typeof b.text === 'string') parts.push(b.text);
        break;
      case 'tool_result':
        out.hasToolResult = true;
        break;
      case 'image':
      case 'document':
        parts.push(`[${b.type}]`);
        break;
      case 'thinking':
      case 'redacted_thinking':
      case 'tool_use':
      case 'server_tool_use':
        break;
      default:
        if (diag) bump(diag.unknownContentBlocks, b.type);
        if (typeof b.text === 'string') parts.push(b.text);
    }
  }
  out.text = parts.join('\n');
  return out;
}

/**
 * Decide what a `type: "user"` record actually is.
 * Returns 'human' | 'tool_result' | 'sidechain' | 'empty'
 */
function routeUserRecord(o, content) {
  // 1. Tool results are the largest non-human population inside role=user.
  if (o.toolUseResult !== undefined) return 'tool_result';
  if (o.sourceToolAssistantUUID) return 'tool_result';
  if (content.hasToolResult) return 'tool_result';
  // 2. Sub-agent / sidechain conversations are not the operator talking.
  if (o.isSidechain === true) return 'sidechain';
  // 3. Everything else is a human-prompt candidate. Note that we deliberately
  //    do NOT require origin.kind === 'human': that field is new, and older
  //    transcripts would be silently emptied by requiring it.
  if (!content.text || !content.text.trim()) return 'empty';
  return 'human';
}

function parseFile(file, diag) {
  const entries = [];
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  diag.files += 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    diag.linesRead += 1;
    let o;
    try {
      o = JSON.parse(line);
    } catch (e) {
      diag.parseFailures += 1;
      if (diag.parseFailureSamples.length < 5) {
        diag.parseFailureSamples.push({ file, line: i + 1, head: line.slice(0, 120) });
      }
      continue;
    }
    if (!o || typeof o !== 'object') { diag.parseFailures += 1; continue; }

    const type = o.type;
    bump(diag.recordTypes, type);
    if (!KNOWN_TYPES.has(type)) bump(diag.unknownRecordTypes, type);
    if (o.version) bump(diag.versions, o.version);
    if (o.entrypoint) bump(diag.entrypoints, o.entrypoint);
    if (o.isSidechain === true) diag.sidechainEntries += 1;

    if (type === 'attachment') {
      bump(diag.attachmentTypes, o.attachment && o.attachment.type);
      continue; // auto-injected context: never a human message
    }
    if (type !== 'user' && type !== 'assistant') continue;

    const content = readContent(o.message, diag);
    if (type === 'assistant') {
      entries.push({
        kind: 'assistant',
        uuid: o.uuid,
        parentUuid: o.parentUuid || null,
        sessionId: o.sessionId,
        timestamp: o.timestamp || null,
        isSidechain: o.isSidechain === true,
      });
      continue;
    }

    bump(diag.userContentShapes, content.blockTypes.join('+') || '(empty)');
    const route = routeUserRecord(o, content);
    for (const m of HUMAN_MARKERS) {
      if (o[m] !== undefined) bump(diag.humanSignalCoverage, m);
    }
    if (!o.timestamp) diag.missingTimestamp += 1;

    entries.push({
      kind: 'user',
      route,
      uuid: o.uuid,
      parentUuid: o.parentUuid || null,
      sessionId: o.sessionId,
      timestamp: o.timestamp || null,
      cwd: o.cwd || null,
      gitBranch: o.gitBranch || null,
      version: o.version || null,
      entrypoint: o.entrypoint || null,
      isSidechain: o.isSidechain === true,
      originKind: o.origin && o.origin.kind ? o.origin.kind : null,
      promptSource: o.promptSource || null,
      blockTypes: content.blockTypes,
      rawText: content.text,
      file,
    });
  }
  return entries;
}

function parseAll(files) {
  const diag = newDiagnostics();
  const seen = new Set();
  let all = [];
  for (const f of files) {
    for (const e of parseFile(f, diag)) {
      if (e.uuid && seen.has(e.uuid)) { diag.duplicateUuids += 1; continue; }
      if (e.uuid) seen.add(e.uuid);
      all.push(e);
    }
  }
  // Stable chronological order; records without a timestamp keep file order.
  all = all.map((e, i) => ({ e, i })).sort((a, b) => {
    const ta = a.e.timestamp ? Date.parse(a.e.timestamp) : NaN;
    const tb = b.e.timestamp ? Date.parse(b.e.timestamp) : NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.i - b.i;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    if (ta !== tb) return ta - tb;
    return a.i - b.i;
  }).map((x) => x.e);
  return { entries: all, diagnostics: diag };
}

module.exports = { parseAll, parseFile, readContent, routeUserRecord, newDiagnostics };
