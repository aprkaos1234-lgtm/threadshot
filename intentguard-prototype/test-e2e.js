'use strict';
/*
 * End-to-end wiring test with a mock model.
 *
 * The point is not to check answer quality — a mock cannot tell you that.
 * The point is that a real run costs real money, and discovering at STEP 9 that
 * merge crashes on the shape stage 5 produced would waste it. This exercises
 * pipeline -> baseline -> merge -> evaluate -> result on the synthetic fixture
 * without a single API call.
 *
 * Run: npm run test:e2e
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { loadTimeline } = require('./src/load');
const { CostLedger } = require('./src/cost');
const { runPipeline } = require('./src/pipeline');
const { runBaselines } = require('./src/baseline');
const { runMerge } = require('./src/merge');
const { systemMetrics, temporalEventBreakdown, baselineStability, renderResult, SYSTEMS } = require('./src/result');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok   ' + name); }
  catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const quiet = () => {};

const { MockLLM } = require('./fixtures/mock-llm');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-e2e-'));
  const out = path.join(tmp, 'run');
  const dataDir = path.join(out, 'data');
  const outDir = path.join(out, 'output');
  execFileSync(process.execPath, [path.join(__dirname, 'fixtures/make_fixture.js'), tmp], { stdio: 'pipe' });
  // Stage 1 artifacts, so `result` can read filter counts and diagnostics.
  execFileSync(process.execPath, [path.join(__dirname, 'src/analyze.js'), '/home/user/demo-app',
    '--claude-home', tmp, '--out', out], { stdio: 'pipe' });

  const loaded = loadTimeline(tmp, '/home/user/demo-app', {});
  const llm = new MockLLM();

  console.log('\nSTEP 7 — pipeline');
  const pipe = await runPipeline(llm, loaded.timeline, { dataDir, outDir }, quiet);
  check('stage 2-3 produced candidates', () => assert.ok(pipe.candidates.length > 0));
  check('stage 4 grouped candidates', () => assert.ok(pipe.groups.length > 0));
  check('stage 5-7 produced requirements with a status', () => {
    assert.ok(pipe.requirements.length > 0);
    for (const r of pipe.requirements) {
      assert.ok(['ACTIVE', 'TEMPORARY', 'AMBIGUOUS', 'SUPERSEDED', 'REJECTED'].includes(r.status),
        'bad status: ' + r.status);
      assert.ok(Array.isArray(r.history));
    }
  });
  check('every stage wrote its file (spec §12)', () => {
    for (const f of ['classified_messages.json', 'candidates.json', 'groups.json', 'reconciled.json']) {
      assert.ok(fs.existsSync(path.join(dataDir, f)), 'missing ' + f);
    }
    assert.ok(fs.existsSync(path.join(outDir, 'intentguard_contract.md')));
  });
  check('grouping avoided exhaustive pairwise judging (spec §18)', () => {
    const g = JSON.parse(fs.readFileSync(path.join(dataDir, 'groups.json'), 'utf8'));
    assert.ok(g.lexical_pairs_judged < g.exhaustive_pairs_avoided,
      'judged ' + g.lexical_pairs_judged + ' of ' + g.exhaustive_pairs_avoided);
  });

  console.log('\nSTEP 8 — baselines');
  const { results: baselines } = await runBaselines(llm, loaded.timeline, { dataDir, outDir }, quiet, 3);
  check('three baseline runs were written', () => {
    assert.strictEqual(baselines.length, 3);
    for (let i = 1; i <= 3; i++) assert.ok(fs.existsSync(path.join(dataDir, 'baseline_' + i + '.json')));
  });
  check('context analysis was written (spec §17)', () =>
    assert.ok(fs.existsSync(path.join(outDir, 'baseline_context_analysis.md'))));

  console.log('\nSTEP 9 — merge');
  const { merged, blind } = await runMerge(llm, pipe.requirements, baselines, { dataDir, outDir }, quiet, 'seed');
  check('merge produced items', () => assert.ok(merged.length > 0));
  check('blind list leaks NO source information (spec §19)', () => {
    const raw = fs.readFileSync(path.join(dataDir, 'blind_items.json'), 'utf8');
    for (const leak of ['intentguard', 'baseline_1', 'baseline_2', 'baseline_3', '_source']) {
      assert.ok(!raw.includes(leak), 'blind_items.json leaked "' + leak + '"');
    }
    for (const it of blind) {
      assert.deepStrictEqual(Object.keys(it).sort(),
        ['merged_id', 'n', 'proposed_status', 'requirement']);
    }
  });
  check('hidden sources are kept in the separate merged file', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dataDir, 'merged_items.json'), 'utf8'));
    assert.ok(m.items.every((i) => Array.isArray(i._sources)));
    assert.ok(m.items.some((i) => i._sources.includes('intentguard')));
  });
  check('merge judged far fewer pairs than exhaustive (spec §18)', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dataDir, 'merged_items.json'), 'utf8'));
    assert.ok(m.stats.pairs_judged < m.stats.exhaustive_pairs_avoided);
  });

  console.log('\nSTEP 10-11 — blind evaluation (scripted stdin)');
  // Drive the real interactive CLI rather than faking its output file.
  // per item: verdict line + empty note line; then the MANUAL_MISSING list,
  // terminated by an empty line. A stray blank before the list would end it
  // immediately, which is exactly the bug this string once had.
  const answers = blind.map((_, i) => (i % 5 + 1) + '\n\n').join('') +
    '잊고 있던 요구사항 예시\n\n';
  execFileSync(process.execPath, [path.join(__dirname, 'src/cli.js'), 'evaluate', '--out', out],
    { input: answers, stdio: ['pipe', 'pipe', 'pipe'] });
  const progress = JSON.parse(fs.readFileSync(path.join(dataDir, 'evaluation_progress.json'), 'utf8'));
  check('evaluation recorded a verdict for every item', () =>
    assert.strictEqual(Object.keys(progress.verdicts).length, blind.length));
  check('evaluation captured MANUAL_MISSING (spec §22)', () =>
    assert.ok(progress.manual_missing && progress.manual_missing.length >= 1));
  check('evaluation is marked complete', () => assert.strictEqual(progress.completed, true));

  console.log('\nSTEP 12-13 — result');
  const mergedFull = JSON.parse(fs.readFileSync(path.join(dataDir, 'merged_items.json'), 'utf8')).items;
  const metrics = SYSTEMS.map((s) => systemMetrics(mergedFull, progress.verdicts, s));
  const eventBreakdown = temporalEventBreakdown(mergedFull, progress.verdicts, pipe.requirements);
  const stability = baselineStability(mergedFull);
  const md = renderResult({
    metrics, eventBreakdown, stability,
    missingAttribution: [{ requirement: '잊고 있던 요구사항 예시', matched_merged_id: null, found_by: [], found_by_none: true }],
    verdicts: progress.verdicts, merged: mergedFull,
    costSummary: llm.ledger.summary(), contextAnalysis: 'mock',
    filterCounts: loaded.counts, parseDiagnostics: loaded.diagnostics,
    meta: { project: '/home/user/demo-app', range: 'mock' }, notes: [],
  });
  fs.writeFileSync(path.join(out, 'RESULT.md'), md);

  check('metrics computed for all four systems', () => {
    assert.strictEqual(metrics.length, 4);
    for (const m of metrics) assert.ok(typeof m.items === 'number');
  });
  check('RESULT.md has all 11 sections in spec §29 order', () => {
    const heads = md.split('\n').filter((l) => /^# \d+\. /.test(l));
    const nums = heads.map((h) => parseInt(h.match(/^# (\d+)\./)[1], 10));
    assert.deepStrictEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      'sections found: ' + JSON.stringify(heads));
  });
  check('RESULT.md does not auto-decide GO/NO-GO (spec §29)', () => {
    assert.ok(md.includes('GO / NO-GO 는 자동 판정하지 않습니다'));
  });
  check('RESULT.md leads with MANUAL MISSING (spec §29)', () => {
    assert.ok(md.indexOf('# 1. MANUAL MISSING REQUIREMENTS') < md.indexOf('# 4. Blind Evaluation'));
  });
  check('cost is attributed per stage (spec §27)', () => {
    const s = llm.ledger.summary();
    for (const stage of ['classification', 'candidate_extraction', 'grouping', 'reconciliation',
      'baseline_1', 'baseline_2', 'baseline_3', 'semantic_judge']) {
      assert.ok(s.by_stage[stage], 'no cost recorded for stage ' + stage);
    }
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('');
  if (failures) { console.log(failures + ' FAILURE(S)'); process.exit(1); }
  console.log('e2e: all passed');
})().catch((e) => { console.error('\ne2e crashed:\n', e); process.exit(1); });
