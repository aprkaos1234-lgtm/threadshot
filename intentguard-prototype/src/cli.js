'use strict';
const fs = require('fs');
const path = require('path');

const discover = require('./discover');
const { loadTimeline } = require('./load');
const { LLM, DEFAULT_MODEL } = require('./llm');
const { CostLedger } = require('./cost');
const { runPipeline } = require('./pipeline');
const { runBaselines } = require('./baseline');
const { runMerge } = require('./merge');
const { runEvaluation, attributeMissing } = require('./evaluate');
const {
  systemMetrics, temporalEventBreakdown, baselineStability, renderResult, SYSTEMS,
} = require('./result');
const estimateCmd = require('./estimate');

const ROOT = path.resolve(__dirname, '..');

const USAGE = `
IntentGuard Validation Prototype

  npm run projects                                이 PC의 Claude Code 이력 목록
  npm run analyze   -- "<project>" [--limit N]    STEP 2-3  파싱 + 필터 → 강제 중단
  npm run estimate  -- "<project>"                STEP 5-6  전체 실행 비용 추산 → 강제 중단
  npm run pipeline  -- "<project>"                STEP 7    IntentGuard Stage 2-7
  npm run baseline  -- "<project>"                STEP 8    Baseline x3
  npm run merge     -- "<project>"                STEP 9    의미 병합 (4-way, blind)
  npm run evaluate                                STEP 10-11 Blind Evaluation (대화형)
  npm run result    -- "<project>"                STEP 12-13 source 복원 + RESULT.md

옵션
  --limit N         최근 N개 raw user-role 레코드만
  --from ISO        이 시각 이후
  --to ISO          이 시각 이전
  --model ID        LLM 모델 (기본 ${DEFAULT_MODEL})
  --claude-home P   Claude 설정 디렉터리
  --out DIR         산출물 위치 (기본: 이 프로토타입 디렉터리)
  --runs N          baseline 실행 횟수 (기본 3, 명세 §16 은 3을 요구)
  --yes             비용 확인 프롬프트 없이 진행

돈이 드는 단계(pipeline/baseline/merge/result)는 실행 전 예상 비용을 보여주고
확인을 받습니다. ANTHROPIC_API_KEY 가 필요합니다.
`;

function parseArgs(argv) {
  const a = {
    positional: [], limit: null, from: null, to: null, model: DEFAULT_MODEL,
    claudeHome: null, out: ROOT, runs: 3, yes: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    switch (t) {
      case '--limit': a.limit = parseInt(argv[++i], 10); break;
      case '--from': a.from = argv[++i]; break;
      case '--to': a.to = argv[++i]; break;
      case '--model': a.model = argv[++i]; break;
      case '--claude-home': a.claudeHome = argv[++i]; break;
      case '--out': a.out = path.resolve(argv[++i]); break;
      case '--runs': a.runs = parseInt(argv[++i], 10); break;
      case '--yes': case '-y': a.yes = true; break;
      case '--help': case '-h': a.help = true; break;
      default:
        if (t.startsWith('--')) { console.error('unknown option: ' + t); process.exit(2); }
        a.positional.push(t);
    }
  }
  return a;
}

const log = (s) => console.log(s);
function banner(s) { console.log('\n' + '='.repeat(72) + '\n' + s + '\n' + '='.repeat(72) + '\n'); }

function dirs(out) {
  return { dataDir: path.join(out, 'data'), outDir: path.join(out, 'output') };
}

function readJson(file, what) {
  if (!fs.existsSync(file)) {
    throw new Error(what + ' 이 없습니다: ' + file + '\n먼저 이전 단계를 실행하세요.');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function confirmCost(args, estimateUsd, label) {
  if (args.yes) return true;
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((r) => rl.question(
    '\n' + label + ' 예상 비용: 약 $' + estimateUsd.toFixed(2) + '\n진행할까요? (y/N) > ', r));
  rl.close();
  return ans.trim().toLowerCase() === 'y';
}

function requireCredentials() {
  if (!LLM.hasCredentials()) {
    console.error('\nANTHROPIC_API_KEY 가 설정되지 않았습니다.');
    console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
    console.error('\n(`ant auth login` 으로 로그인한 프로필도 SDK 가 자동으로 사용합니다.)');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------

async function cmdEstimate(args) {
  const home = discover.claudeHome(args.claudeHome);
  const full = loadTimeline(home, args.positional[0], { from: args.from, to: args.to });
  const smoke = loadTimeline(home, args.positional[0],
    { from: args.from, to: args.to, limit: args.limit || 200 });
  const { dataDir, outDir } = dirs(args.out);

  let ledgerSummary = null;
  const ledgerFile = path.join(dataDir, 'cost_ledger.json');
  if (fs.existsSync(ledgerFile)) {
    try { ledgerSummary = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).summary; } catch (_) {}
  }

  const { fullEst } = estimateCmd.run(smoke.timeline, full.timeline, args.model, ledgerSummary, outDir);
  console.log('project : ' + full.meta.project);
  console.log('사람 메시지: smoke ' + smoke.counts.humanMessages + ' / full ' + full.counts.humanMessages);
  console.log('');
  console.log('Estimated Full IntentGuard Cost : $' + fullEst.totals.intentguard.toFixed(2));
  console.log('Estimated Baseline x3           : $' + fullEst.totals.baselines.toFixed(2));
  console.log('Estimated Semantic Judge        : $' + fullEst.totals.judge.toFixed(2));
  console.log('Estimated Total                 : $' + fullEst.totals.all.toFixed(2));
  console.log('');
  console.log('wrote output/full_run_cost_estimate.md');
  banner('STOP: 전체 Benchmark 예상 비용을 확인한 후 명시적으로 full run을 실행하세요.');
  console.log('확인했다면:  npm run pipeline -- "' + full.meta.project + '"');
}

async function cmdPipeline(args) {
  requireCredentials();
  const home = discover.claudeHome(args.claudeHome);
  const loaded = loadTimeline(home, args.positional[0],
    { from: args.from, to: args.to, limit: args.limit });
  const { dataDir, outDir } = dirs(args.out);

  const est = estimateCmd.estimateRun(loaded.timeline, args.model, estimateCmd.DEFAULTS);
  if (!(await confirmCost(args, est.totals.intentguard, 'IntentGuard 파이프라인'))) {
    console.log('중단했습니다.'); return;
  }

  const ledger = new CostLedger(path.join(dataDir, 'cost_ledger.json'));
  const llm = new LLM({ model: args.model, ledger });
  banner('STEP 7 — IntentGuard Pipeline (Stage 2-7)');
  try {
    const res = await runPipeline(llm, loaded.timeline, { dataDir, outDir }, log);
    console.log('\n요구사항 ' + res.requirements.length + '개');
    const byStatus = {};
    for (const r of res.requirements) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    for (const [k, v] of Object.entries(byStatus)) console.log('  ' + k + ': ' + v);
  } finally {
    ledger.save();
    console.log('\n비용: $' + ledger.summary().total_cost_usd.toFixed(4));
  }
  console.log('\nwrote output/intentguard_contract.md');
  console.log('다음: npm run baseline -- "' + loaded.meta.project + '"');
}

async function cmdBaseline(args) {
  requireCredentials();
  const home = discover.claudeHome(args.claudeHome);
  const loaded = loadTimeline(home, args.positional[0],
    { from: args.from, to: args.to, limit: args.limit });
  const { dataDir, outDir } = dirs(args.out);

  const est = estimateCmd.estimateRun(loaded.timeline, args.model, estimateCmd.DEFAULTS);
  if (!(await confirmCost(args, est.totals.baselines, 'Baseline x' + args.runs))) {
    console.log('중단했습니다.'); return;
  }
  const ledger = new CostLedger(path.join(dataDir, 'cost_ledger.json'));
  const llm = new LLM({ model: args.model, ledger });
  banner('STEP 8 — Baseline x' + args.runs);
  try {
    await runBaselines(llm, loaded.timeline, { dataDir, outDir }, log, args.runs);
  } finally {
    ledger.save();
    console.log('\n누적 비용: $' + ledger.summary().total_cost_usd.toFixed(4));
  }
  console.log('다음: npm run merge -- "' + loaded.meta.project + '"');
}

async function cmdMerge(args) {
  requireCredentials();
  const { dataDir, outDir } = dirs(args.out);
  const reconciled = readJson(path.join(dataDir, 'reconciled.json'), 'reconciled.json');
  const baselines = [];
  for (let i = 1; i <= args.runs; i++) {
    const f = path.join(dataDir, 'baseline_' + i + '.json');
    if (!fs.existsSync(f)) break;
    baselines.push(JSON.parse(fs.readFileSync(f, 'utf8')).requirements);
  }
  if (baselines.length < 1) throw new Error('baseline_*.json 이 없습니다. 먼저 npm run baseline 을 실행하세요.');

  const ledger = new CostLedger(path.join(dataDir, 'cost_ledger.json'));
  const llm = new LLM({ model: args.model, ledger });
  banner('STEP 9 — Semantic Merge (4-way, blind)');
  try {
    const { merged, blind } = await runMerge(
      llm, reconciled.requirements, baselines, { dataDir, outDir }, log, 'intentguard');
    console.log('\n병합 결과 ' + merged.length + '개 항목이 blind 평가 대상입니다.');
    console.log('blind_items.json 에는 요구사항 텍스트와 제안 상태만 들어 있습니다 (명세 §19).');
    if (blind.length > 100) {
      console.log('\n항목이 100개를 넘어 평가는 자동으로 분할됩니다 (명세 §21).');
    }
  } finally {
    ledger.save();
    console.log('\n누적 비용: $' + ledger.summary().total_cost_usd.toFixed(4));
  }
  console.log('\n다음: npm run evaluate');
}

async function cmdEvaluate(args) {
  const { dataDir } = dirs(args.out);
  await runEvaluation(dataDir, log);
}

async function cmdResult(args) {
  const home = discover.claudeHome(args.claudeHome);
  const { dataDir, outDir } = dirs(args.out);
  const merged = readJson(path.join(dataDir, 'merged_items.json'), 'merged_items.json');
  const progress = readJson(path.join(dataDir, 'evaluation_progress.json'), 'evaluation_progress.json');
  const reconciled = readJson(path.join(dataDir, 'reconciled.json'), 'reconciled.json');

  if (!progress.completed) {
    console.log('\n⚠️ Blind Evaluation 이 아직 끝나지 않았습니다.');
    console.log('판정 ' + Object.keys(progress.verdicts).length + ' / ' + merged.items.length);
    console.log('명세 §20 은 평가 완료 전 source 복원을 금지합니다.');
    console.log('먼저 `npm run evaluate` 를 끝내세요.');
    process.exit(1);
  }

  banner('STEP 12 — Hidden source 복원');
  const verdicts = progress.verdicts;
  const items = merged.items;

  let missingAttribution = [];
  if (progress.manual_missing && progress.manual_missing.length) {
    if (LLM.hasCredentials()) {
      const ledger = new CostLedger(path.join(dataDir, 'cost_ledger.json'));
      const llm = new LLM({ model: args.model, ledger });
      console.log('MANUAL_MISSING ' + progress.manual_missing.length + '개를 각 시스템 출력과 대조합니다…');
      missingAttribution = await attributeMissing(llm, progress.manual_missing, items, log);
      ledger.save();
    } else {
      console.log('API 키가 없어 MANUAL_MISSING 대조는 어휘 유사도만 사용합니다.');
      missingAttribution = await attributeMissing(null, progress.manual_missing, items, log);
    }
  }

  const metrics = SYSTEMS.map((s) => systemMetrics(items, verdicts, s));
  const eventBreakdown = temporalEventBreakdown(items, verdicts, reconciled.requirements);
  const stability = baselineStability(items);

  let costSummary = { total_calls: 0, total_cost_usd: 0, by_stage: {} };
  const ledgerFile = path.join(dataDir, 'cost_ledger.json');
  if (fs.existsSync(ledgerFile)) costSummary = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).summary;

  let contextAnalysis = null;
  const ctxFile = path.join(outDir, 'baseline_context_analysis.md');
  if (fs.existsSync(ctxFile)) {
    contextAnalysis = fs.readFileSync(ctxFile, 'utf8').split('\n').slice(1).join('\n').trim();
  }

  let filterCounts = null, parseDiagnostics = null, meta = { project: '?', range: '?' };
  const dbg = path.join(dataDir, 'user_messages.debug.json');
  if (fs.existsSync(dbg)) {
    const d = JSON.parse(fs.readFileSync(dbg, 'utf8'));
    parseDiagnostics = d.diagnostics;
    meta = Object.assign(meta, d.meta || {});
  }
  const um = path.join(dataDir, 'user_messages.json');
  if (fs.existsSync(um)) {
    const d = JSON.parse(fs.readFileSync(um, 'utf8'));
    filterCounts = d.counts;
    meta = Object.assign(meta, d.meta || {});
  }
  if (!meta.range) meta.range = '?';

  const notes = (meta.adequacy && meta.adequacy.warnings) || [];
  const md = renderResult({
    metrics, eventBreakdown, stability, missingAttribution, verdicts, merged: items,
    costSummary, contextAnalysis, filterCounts, parseDiagnostics, meta, notes,
  });
  fs.writeFileSync(path.join(args.out, 'RESULT.md'), md);

  console.log('\n시스템별 요약:');
  for (const m of metrics) {
    console.log('  ' + m.system.padEnd(12) +
      ' items ' + String(m.items).padStart(4) +
      ' | ACTIVE precision ' + (m.active_precision === null ? 'n/a' : m.active_precision + '%').padStart(6) +
      ' | ambiguous ' + (m.ambiguous_rate === null ? 'n/a' : m.ambiguous_rate + '%'));
  }
  console.log('\nwrote RESULT.md');
  console.log('\n명세 §29: GO / NO-GO 는 자동 판정하지 않습니다. RESULT.md 를 직접 읽고 판단하세요.');
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { console.log(USAGE); return; }
  const args = parseArgs(argv.slice(1));
  if (args.help) { console.log(USAGE); return; }

  const needsProject = ['estimate', 'pipeline', 'baseline'];
  if (needsProject.includes(cmd) && !args.positional.length) {
    console.error('프로젝트 경로가 필요합니다.\n`npm run projects` 로 목록을 확인하세요.');
    process.exit(1);
  }

  const commands = {
    estimate: cmdEstimate, pipeline: cmdPipeline, baseline: cmdBaseline,
    merge: cmdMerge, evaluate: cmdEvaluate, result: cmdResult,
  };
  if (!commands[cmd]) { console.error('알 수 없는 명령: ' + cmd); console.log(USAGE); process.exit(2); }
  await commands[cmd](args);
}

main().catch((e) => {
  console.error('\n' + (e && e.message ? e.message : e));
  if (process.env.IG_DEBUG) console.error(e);
  process.exit(1);
});
