'use strict';
const fs = require('fs');
const path = require('path');

const discover = require('./discover');
const { parseAll } = require('./parse');
const { HUMAN_TYPES, INTENT_BEARING, NOISE_TYPES } = require('./filter');
const { loadTimeline } = require('./load');
const { estimateTokens } = require('./tokens');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { positional: [], limit: null, from: null, to: null, claudeHome: null, listProjects: false, out: ROOT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
      case '--from': args.from = argv[++i]; break;
      case '--to': args.to = argv[++i]; break;
      case '--claude-home': args.claudeHome = argv[++i]; break;
      case '--out': args.out = path.resolve(argv[++i]); break;
      case '--list-projects': args.listProjects = true; break;
      case '--help': case '-h': args.help = true; break;
      default:
        if (a.startsWith('--')) { console.error('unknown option: ' + a); process.exit(2); }
        args.positional.push(a);
    }
  }
  return args;
}

const USAGE = `
IntentGuard Validation Prototype — STEP 1..3 only

  npm run projects
  npm run analyze -- "<project path>" [--limit N] [--from ISO] [--to ISO]

Options
  --limit N         use only the most recent N raw user-role records (smoke test)
  --from ISO        include records at/after this timestamp
  --to ISO          include records at/before this timestamp
  --claude-home P   Claude config dir (default $CLAUDE_CONFIG_DIR or ~/.claude)
  --out DIR         where to write data/ and output/ (default: this prototype dir)

This command stops after Stage 1. It never runs the requirement pipeline,
the baselines, or the benchmark.
`;

function fmt(n) { return n.toLocaleString('en-US'); }

function esc(s) {
  return String(s).replace(/```/g, '` ` `');
}

function sample(list, n) {
  return list.slice(0, n);
}

function block(text, maxLen) {
  const t = text.length > maxLen ? text.slice(0, maxLen) + '\n… [truncated, ' + text.length + ' chars total]' : text;
  return '```text\n' + esc(t) + '\n```';
}

function renderSamples(timeline, meta) {
  const by = (type) => timeline.filter((r) => r.message_type === type);
  const L = [];
  L.push('# Message Filter Samples — 사람이 직접 검토할 파일');
  L.push('');
  L.push('> **이 파일을 검토하기 전에는 다음 단계(Requirement Pipeline / Baseline / Benchmark)를 실행하지 않는다.**');
  L.push('> 명세 §4. 쓰레기 입력 위에서 정교한 평가를 하지 않는다.');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push('| 프로젝트 | `' + meta.project + '` |');
  L.push('| 세션 파일 수 | ' + meta.sessionCount + ' |');
  L.push('| 적용한 범위 | ' + meta.scope + ' |');
  L.push('| 생성 시각 | ' + new Date().toISOString() + ' |');
  L.push('');
  L.push('검토 방법: 각 샘플의 분류가 **틀렸다면** 그 항목에 메모를 남기고,');
  L.push('`src/filter.js` 의 규칙을 고친 뒤 이 명령을 다시 실행한다 (STEP 4).');
  L.push('`npm test` 가 회귀를 잡아준다.');
  L.push('');

  // Adequacy warning: the spec (§2) forbids judging IntentGuard on a short or
  // thin history, so say so loudly before anyone reads the numbers.
  if (meta.adequacy && meta.adequacy.warnings.length) {
    L.push('---');
    L.push('');
    L.push('## ⚠️ 이 데이터셋은 가설 검증에 충분하지 않다');
    L.push('');
    for (const w of meta.adequacy.warnings) L.push('- ' + w);
    L.push('');
    L.push('명세 §2: *"짧고 단순한 프로젝트의 결과로 IntentGuard 사업성을 판정하지 않는다."*');
    L.push('');
    L.push('아래 샘플은 **parser/filter 동작 확인용**으로만 읽는다.');
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('## Stage 1 의 알려진 한계 (검토 시 감안할 것)');
  L.push('');
  L.push('1. **긴 문서 = 라벨 하나.** 요구사항 20개가 든 기획서 한 통도 버킷 하나로 분류된다.');
  L.push('   Stage 3(Requirement Candidate Extraction)에서 문단 단위로 쪼개기 전까지는 정상이다.');
  L.push('   검토 시 "이 긴 메시지의 라벨이 틀렸다"고 판단하기보다 **노이즈가 섞였는지**만 본다.');
  L.push('2. **규칙 기반이라 어휘에 민감하다.** 한국어 요청 어미(…줘/…하게/…하자)와 정정 표현');
  L.push('   (아니/말고/빼자/됐어)에 의존한다. 본인의 말버릇이 목록에 없으면 UNKNOWN 으로 샌다.');
  L.push('   → **UNKNOWN 섹션을 가장 먼저 볼 것.**');
  L.push('3. **LLM 을 쓰지 않았다 (비용 $0).** 정교한 분류는 Stage 2 이후의 일이다.');
  L.push('   쓰레기 입력 위에 돈을 쓰지 않기 위해 순서를 이렇게 잡았다.');
  L.push('');

  const sections = [
    ['HUMAN_INTENT', 30, '요구사항을 담고 있다고 판단한 메시지. **여기 노이즈가 섞이면 이후 전부 오염된다.**'],
    ['HUMAN_CORRECTION', 30, '이전 지시를 뒤집거나 되돌리는 메시지. IntentGuard 가설의 핵심 입력.'],
    ['HUMAN_CONFIRMATION', 20, '독립 Requirement 로 만들면 안 되는 승인 발화. `context_message_ids` 로 직전 맥락과 연결됨.'],
    ['HUMAN_CONTEXT', 20, '질문/설명/아이디어. ACTIVE Requirement 가 되어서는 안 된다.'],
    ['LOW_INFORMATION', 20, '"계속", "ㅇㅋ" 류. 독립 Requirement 금지.'],
    ['UNKNOWN', 20, '**가장 중요한 검토 대상.** 규칙이 판단하지 못한 것들.'],
  ];
  for (const [type, n, note] of sections) {
    const rows = by(type);
    L.push('---');
    L.push('');
    L.push('## ' + type + ' — ' + rows.length + '개 (샘플 ' + Math.min(n, rows.length) + '개)');
    L.push('');
    L.push(note);
    L.push('');
    if (!rows.length) { L.push('_해당 없음._'); L.push(''); continue; }
    sample(rows, n).forEach((r, i) => {
      L.push('### ' + type + ' #' + (i + 1));
      L.push('');
      L.push('- id: `' + r.id + '`');
      L.push('- time: `' + r.timestamp + '`');
      L.push('- confidence: ' + r.confidence);
      L.push('- rule: ' + (r._reasons || []).join('; '));
      if (r.context_message_ids.length) L.push('- context: `' + r.context_message_ids.join('`, `') + '`');
      L.push('');
      L.push(block(r.text, 1200));
      L.push('');
      L.push('판정: [ ] 맞음  [ ] 틀림 → 올바른 분류: ______');
      L.push('');
    });
  }

  L.push('---');
  L.push('');
  const noise = timeline.filter((r) => NOISE_TYPES.has(r.message_type));
  L.push('## 제외된 Noise 샘플 — ' + noise.length + '개 중 30개');
  L.push('');
  L.push('여기에 **진짜 사람이 쓴 요구사항이 섞여 있으면 그것이 가장 심각한 오류다.**');
  L.push('(누락은 Precision 지표에 잡히지 않는다.)');
  L.push('');
  const noiseByType = {};
  for (const r of noise) (noiseByType[r.message_type] = noiseByType[r.message_type] || []).push(r);
  // interleave so all noise kinds get represented
  const picked = [];
  const keys = Object.keys(noiseByType);
  for (let i = 0; picked.length < 30 && keys.some((k) => noiseByType[k][i]); i++) {
    for (const k of keys) if (noiseByType[k][i] && picked.length < 30) picked.push(noiseByType[k][i]);
  }
  picked.forEach((r, i) => {
    L.push('### NOISE #' + (i + 1) + ' — ' + r.message_type);
    L.push('');
    L.push('- id: `' + r.id + '` · time: `' + r.timestamp + '` · route: `' + r._route + '` · raw ' + r._raw_len + ' chars');
    L.push('- rule: ' + (r._reasons || []).join('; '));
    L.push('');
    const preview = r.text || '(정제 후 텍스트 없음 — tool_result / 자동주입 context)';
    L.push(block(preview, 500));
    L.push('');
    L.push('판정: [ ] 노이즈 맞음  [ ] **사람 메시지였음 (심각)**');
    L.push('');
  });

  L.push('---');
  L.push('');
  L.push('## AMBIGUOUS / 경계 사례');
  L.push('');
  L.push('confidence <= 0.6 인 human 분류 항목. 규칙이 확신하지 못한 것들이다.');
  L.push('');
  const amb = timeline.filter((r) => HUMAN_TYPES.has(r.message_type) && r.confidence <= 0.6 && r.text);
  if (!amb.length) L.push('_해당 없음._');
  sample(amb, 25).forEach((r, i) => {
    L.push('### AMBIGUOUS #' + (i + 1) + ' — ' + r.message_type + ' (conf ' + r.confidence + ')');
    L.push('');
    L.push('- id: `' + r.id + '` · rule: ' + (r._reasons || []).join('; '));
    L.push('');
    L.push(block(r.text, 600));
    L.push('');
  });
  return L.join('\n');
}

function renderReport(timeline, counts, meta, diag) {
  const L = [];
  L.push('# Message Filter Report');
  L.push('');
  L.push('- 프로젝트: `' + meta.project + '`');
  L.push('- 세션 파일: ' + meta.sessionCount + '개');
  L.push('- 범위: ' + meta.scope);
  L.push('- 생성: ' + new Date().toISOString());
  L.push('- LLM 호출: **0회 (비용 $0)** — Stage 1 은 전부 결정론적 규칙');
  L.push('');
  L.push('## 카운트 (명세 §7)');
  L.push('');
  L.push('| 항목 | 수 |');
  L.push('|---|---:|');
  L.push('| Raw user-role messages | ' + fmt(counts.rawUserRole) + ' |');
  L.push('| Actual human messages | ' + fmt(counts.humanMessages) + ' |');
  L.push('| Potential intent-bearing | ' + fmt(counts.intentBearing) + ' |');
  L.push('| Low-information / context-only | ' + fmt(counts.lowInformation) + ' |');
  L.push('| Noise (system/tool/paste/error) | ' + fmt(counts.noise) + ' |');
  L.push('| Unknown | ' + fmt(counts.unknown) + ' |');
  L.push('');
  L.push('## 버킷별 분포');
  L.push('');
  L.push('| message_type | 수 | 비율 |');
  L.push('|---|---:|---:|');
  const total = counts.rawUserRole || 1;
  Object.entries(counts.byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    L.push('| ' + k + ' | ' + fmt(v) + ' | ' + (100 * v / total).toFixed(1) + '% |');
  });
  L.push('');
  L.push('## Token 추정 (STEP 5/6 입력)');
  L.push('');
  const humanText = timeline.filter((r) => HUMAN_TYPES.has(r.message_type) && r.text).map((r) => r.text);
  const intentText = timeline.filter((r) => INTENT_BEARING.has(r.message_type)).map((r) => r.text);
  const rawChars = timeline.reduce((s, r) => s + r._raw_len, 0);
  L.push('| 대상 | 문자 | 추정 토큰 |');
  L.push('|---|---:|---:|');
  // tool_result 본문은 rawText 에 담지 않는다(메모리). 따라서 이 행은 "raw 전체"가
  // 아니라 "사람 메시지의 정제 전 문자수"다. 라벨을 실제 내용에 맞춘다.
  L.push('| 사람 메시지 (정제 전, 주입 블록 포함) | ' + fmt(rawChars) + ' | ~' + fmt(Math.ceil(rawChars / 3)) + ' |');
  L.push('| 필터 통과 human timeline | ' + fmt(humanText.join('').length) + ' | ' + fmt(estimateTokens(humanText.join('\n'))) + ' |');
  L.push('| intent-bearing 만 | ' + fmt(intentText.join('').length) + ' | ' + fmt(estimateTokens(intentText.join('\n'))) + ' |');
  L.push('');
  L.push('필터가 Baseline 에 넣을 입력을 얼마나 줄였는지가 곧 Baseline 의 context 여유다.');
  L.push('**주의(명세 §17): 이 축소는 IntentGuard 만의 이점이 아니다. Baseline 도 동일한 filtered timeline 을 받는다.**');
  L.push('');
  L.push('## 시간 범위');
  L.push('');
  const ts = timeline.map((r) => r.timestamp).filter(Boolean).sort();
  L.push('- 최초: `' + (ts[0] || 'n/a') + '`');
  L.push('- 최종: `' + (ts[ts.length - 1] || 'n/a') + '`');
  const days = ts.length ? (Date.parse(ts[ts.length - 1]) - Date.parse(ts[0])) / 86400000 : 0;
  L.push('- 기간: ' + days.toFixed(2) + '일');
  L.push('');
  if (days < 2) {
    L.push('> ⚠️ **기간이 너무 짧다.** IntentGuard 가설은 "긴 시간축에서의 변경/취소/임시변경/재활성화 복구"에');
    L.push('> 관한 것이다. 이 정도 기간의 데이터로는 가설을 검증할 수 없다 (명세 §2).');
    L.push('');
  }
  L.push('## Parser 진단');
  L.push('');
  L.push('```json');
  L.push(JSON.stringify(diag, null, 2));
  L.push('```');
  return L.join('\n');
}

function renderDiagnostics(diag, meta) {
  const L = [];
  L.push('# Parse Diagnostics — 유지보수 리스크 근거 (명세 §29 #11, §31)');
  L.push('');
  L.push('Claude Code 는 외부 제품이 통제하는 비공개 포맷이다. 여기 기록되는 값들은');
  L.push('IntentGuard 를 제품으로 유지할 때 **매 릴리스마다 깨질 수 있는 지점**의 목록이다.');
  L.push('');
  L.push('- Claude Code 버전: ' + JSON.stringify(diag.versions));
  L.push('- entrypoint: ' + JSON.stringify(diag.entrypoints));
  L.push('- 파일 ' + diag.files + '개 / 라인 ' + fmt(diag.linesRead) + '개');
  L.push('- JSON 파싱 실패: ' + diag.parseFailures);
  L.push('- 중복 uuid (세션 resume/fork 로 인한): ' + diag.duplicateUuids);
  L.push('- timestamp 없는 레코드: ' + diag.missingTimestamp);
  L.push('- sidechain(sub-agent) 레코드: ' + diag.sidechainEntries);
  L.push('');
  L.push('## 관측된 record type');
  L.push('');
  L.push('| type | 수 | parser 처리 |');
  L.push('|---|---:|---|');
  Object.entries(diag.recordTypes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const unknown = diag.unknownRecordTypes[k];
    L.push('| `' + k + '` | ' + v + ' | ' + (unknown ? '⚠️ **미지 타입 — 규칙 없음**' : '명시적 라우팅') + ' |');
  });
  L.push('');
  if (Object.keys(diag.unknownRecordTypes).length) {
    L.push('> ⚠️ 미지 타입이 존재한다. Claude Code 가 새 레코드 종류를 추가했다는 뜻이며,');
    L.push('> 그 안에 인간 메시지가 들어갔다면 조용히 누락된다. 이것이 이 제품의 구조적 취약점이다.');
    L.push('');
  }
  L.push('## `type: "user"` 안의 content 모양');
  L.push('');
  L.push('| block 구성 | 수 |');
  L.push('|---|---:|');
  Object.entries(diag.userContentShapes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push('| `' + k + '` | ' + v + ' |'));
  L.push('');
  L.push('## 인간 판별 신호의 존재율');
  L.push('');
  L.push('| 필드 | 존재한 레코드 수 |');
  L.push('|---|---:|');
  Object.entries(diag.humanSignalCoverage).forEach(([k, v]) => L.push('| `' + k + '` | ' + v + ' |'));
  L.push('');
  L.push('`origin.kind === "human"` 은 최신 버전에만 존재한다. 구버전 transcript 에는 없으므로');
  L.push('**부재를 근거로 배제하면 과거 이력이 통째로 사라진다.** parser 는 이를 보조 신호로만 쓴다.');
  L.push('');
  L.push('## 자동 주입 attachment 종류');
  L.push('');
  L.push('| attachment.type | 수 |');
  L.push('|---|---:|');
  Object.entries(diag.attachmentTypes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push('| `' + k + '` | ' + v + ' |'));
  L.push('');
  L.push('이들은 전부 `type: "attachment"` 로 분리되어 있어 배제가 쉬웠다. 다만 종류가 ' +
    Object.keys(diag.attachmentTypes).length + '가지이고 버전마다 늘어난다.');
  if (Object.keys(diag.unknownContentBlocks).length) {
    L.push('');
    L.push('## 미지 content block');
    L.push('');
    L.push('```json');
    L.push(JSON.stringify(diag.unknownContentBlocks, null, 2));
    L.push('```');
  }
  return L.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }
  const home = discover.claudeHome(args.claudeHome);

  if (args.listProjects || !args.positional.length) {
    const projects = discover.summarizeProjects(home);
    console.log('Claude home: ' + home);
    if (!projects.length) {
      console.log('\n프로젝트 이력이 없습니다.');
      console.log('이 머신의 ~/.claude/projects 가 비어 있습니다.');
      return;
    }
    console.log('\n발견한 프로젝트 (' + projects.length + '개):\n');
    for (const p of projects) {
      console.log('  ' + (p.cwd || p.name));
      console.log('      dir      : ' + p.dir);
      console.log('      sessions : ' + p.sessions + '   size: ' + (p.bytes / 1024).toFixed(0) + ' KB   last: ' + p.mtime);
    }
    if (!args.listProjects) console.log('\n' + USAGE);
    return;
  }

  const wanted = args.positional[0];
  let loaded;
  try {
    loaded = loadTimeline(home, wanted, { from: args.from, to: args.to, limit: args.limit });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const { project, files, timeline, counts, diagnostics, meta } = loaded;
  console.log('project : ' + meta.project);
  console.log('dir     : ' + project.dir);
  console.log('sessions: ' + files.length);
  const scope = meta.scope;

  const dataDir = path.join(args.out, 'data');
  const outDir = path.join(args.out, 'output');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const contract = timeline.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    timestamp: r.timestamp,
    text: r.text,
    message_type: r.message_type,
    context_message_ids: r.context_message_ids,
    confidence: r.confidence,
  }));
  fs.writeFileSync(path.join(dataDir, 'user_messages.json'),
    JSON.stringify({ meta, counts, messages: contract }, null, 2));
  fs.writeFileSync(path.join(dataDir, 'user_messages.debug.json'),
    JSON.stringify({ meta, diagnostics, messages: timeline }, null, 2));
  fs.writeFileSync(path.join(outDir, 'message_filter_report.md'), renderReport(timeline, counts, meta, diagnostics));
  fs.writeFileSync(path.join(outDir, 'message_filter_samples.md'), renderSamples(timeline, meta));
  fs.writeFileSync(path.join(outDir, 'parse_diagnostics.md'), renderDiagnostics(diagnostics, meta));

  console.log('scope   : ' + scope);
  console.log('');
  console.log('Raw user-role messages : ' + fmt(counts.rawUserRole));
  console.log('Human messages         : ' + fmt(counts.humanMessages));
  console.log('Intent-bearing         : ' + fmt(counts.intentBearing));
  console.log('Low information        : ' + fmt(counts.lowInformation));
  console.log('Noise/system/tool      : ' + fmt(counts.noise));
  console.log('Unknown                : ' + fmt(counts.unknown));
  console.log('');
  console.log('wrote data/user_messages.json');
  console.log('wrote data/user_messages.debug.json');
  console.log('wrote output/message_filter_report.md');
  console.log('wrote output/message_filter_samples.md');
  console.log('wrote output/parse_diagnostics.md');
  console.log('');
  console.log('='.repeat(72));
  console.log('STOP: message_filter_samples.md를 사람이 직접 검토한 뒤 다음 단계를 실행하세요.');
  console.log('='.repeat(72));
  console.log('');
  console.log('검토 전에는 Requirement Pipeline / Baseline / Full Benchmark 를 실행하지 않습니다.');
  console.log('검토 후 필터를 고칠 곳은 src/filter.js 입니다 (STEP 4).');
}

main();
