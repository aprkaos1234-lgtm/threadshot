'use strict';
const discover = require('./discover');
const { parseAll } = require('./parse');
const { buildTimeline, tally } = require('./filter');

/*
 * Shared front half of every command: find the project, parse its transcripts,
 * apply the scope filters, and run Stage 1. `analyze` stops here; the pipeline
 * and baseline commands start from the same timeline so both systems provably
 * receive identical input (spec §15).
 */
function loadTimeline(home, wanted, opts = {}) {
  const matched = discover.resolveProject(home, wanted);
  if (!matched.length) {
    const e = new Error('프로젝트를 찾을 수 없습니다: ' + wanted +
      '\n`npm run projects` 로 목록을 확인하세요.');
    e.code = 'NO_PROJECT';
    throw e;
  }
  if (matched.length > 1) {
    const e = new Error('여러 프로젝트가 일치합니다. 정확한 경로를 지정하세요:\n' +
      matched.map((p) => '  ' + (p.cwd || p.name)).join('\n'));
    e.code = 'AMBIGUOUS_PROJECT';
    throw e;
  }
  const project = matched[0];
  const files = discover.sessionFiles(project.dir);
  const { entries, diagnostics } = parseAll(files);

  let userEntries = entries.filter((e) => e.kind === 'user');
  const scopeParts = [];
  if (opts.from) {
    const t = Date.parse(opts.from);
    userEntries = userEntries.filter((e) => e.timestamp && Date.parse(e.timestamp) >= t);
    scopeParts.push('from ' + opts.from);
  }
  if (opts.to) {
    const t = Date.parse(opts.to);
    userEntries = userEntries.filter((e) => e.timestamp && Date.parse(e.timestamp) <= t);
    scopeParts.push('to ' + opts.to);
  }
  const beforeLimit = userEntries.length;
  if (opts.limit && userEntries.length > opts.limit) {
    userEntries = userEntries.slice(-opts.limit);
    scopeParts.push('most recent ' + opts.limit + ' of ' + beforeLimit + ' raw user-role records');
  } else if (opts.limit) {
    scopeParts.push('--limit ' + opts.limit + ' (전체 ' + beforeLimit + '개가 한도 이하)');
  }

  const timeline = buildTimeline(userEntries);
  const counts = tally(timeline);
  const ts = timeline.map((r) => r.timestamp).filter(Boolean).sort();
  const spanDays = ts.length
    ? (Date.parse(ts[ts.length - 1]) - Date.parse(ts[0])) / 86400000 : 0;

  const warnings = [];
  if (files.length < 3) warnings.push('세션 파일이 ' + files.length + '개뿐이다. 여러 세션에 걸친 개발 이력이 아니다 (명세 §2).');
  if (spanDays < 7) warnings.push('이력 기간이 ' + spanDays.toFixed(2) + '일이다. "긴 시간축의 변경/취소/재활성화"가 존재할 수 없는 길이다.');
  if (counts.humanMessages < 50) warnings.push('사람 메시지가 ' + counts.humanMessages + '개뿐이다. 필터 품질을 통계적으로 평가할 수 없다.');
  if (counts.intentBearing < 20) warnings.push('intent-bearing 메시지가 ' + counts.intentBearing + '개뿐이다. Requirement 복구 성능을 비교할 대상이 없다.');

  return {
    project, files, timeline, counts, diagnostics,
    meta: {
      project: project.cwd || project.name,
      sessionCount: files.length,
      scope: scopeParts.length ? scopeParts.join(', ') : '전체 이력',
      range: (ts[0] || '?') + ' ~ ' + (ts[ts.length - 1] || '?'),
      adequacy: { spanDays: Number(spanDays.toFixed(2)), warnings },
    },
  };
}

module.exports = { loadTimeline };
