'use strict';
/*
 * Generate the committed demo run under fixtures/example-run/.
 *
 * Everything it produces is FABRICATED: a synthetic transcript analysed by a
 * mock model. It exists so you can see the shape of every artifact — the
 * contract, the blind list, RESULT.md — before spending money on a real run.
 * It is not evidence about IntentGuard.
 *
 *   node fixtures/make_demo.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { loadTimeline } = require('../src/load');
const { runPipeline } = require('../src/pipeline');
const { runBaselines } = require('../src/baseline');
const { runMerge } = require('../src/merge');
const {
  systemMetrics, temporalEventBreakdown, baselineStability, renderResult, SYSTEMS,
} = require('../src/result');
const { MockLLM } = require('./mock-llm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'fixtures', 'example-run');
const log = () => {};

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-demo-'));
  execFileSync(process.execPath, [path.join(__dirname, 'make_fixture.js'), tmp], { stdio: 'pipe' });

  fs.rmSync(OUT, { recursive: true, force: true });
  const dataDir = path.join(OUT, 'data');
  const outDir = path.join(OUT, 'output');

  // Stage 1 (real code, no model)
  execFileSync(process.execPath, [path.join(ROOT, 'src/analyze.js'), '/home/user/demo-app',
    '--claude-home', tmp, '--out', OUT], { stdio: 'pipe' });

  const loaded = loadTimeline(tmp, '/home/user/demo-app', {});
  const llm = new MockLLM();

  const pipe = await runPipeline(llm, loaded.timeline, { dataDir, outDir }, log);
  const { results: baselines } = await runBaselines(llm, loaded.timeline, { dataDir, outDir }, log, 3);
  const { blind } = await runMerge(llm, pipe.requirements, baselines, { dataDir, outDir }, log, 'demo');

  // A scripted blind evaluation so RESULT.md has verdicts to report.
  const answers = blind.map((_, i) => (i % 5 + 1) + '\n\n').join('') +
    '분석 결과를 CSV 로 내보내는 기능\n\n';
  execFileSync(process.execPath, [path.join(ROOT, 'src/cli.js'), 'evaluate', '--out', OUT],
    { input: answers, stdio: 'pipe' });

  const progress = JSON.parse(fs.readFileSync(path.join(dataDir, 'evaluation_progress.json'), 'utf8'));
  const merged = JSON.parse(fs.readFileSync(path.join(dataDir, 'merged_items.json'), 'utf8')).items;
  const md = renderResult({
    metrics: SYSTEMS.map((s) => systemMetrics(merged, progress.verdicts, s)),
    eventBreakdown: temporalEventBreakdown(merged, progress.verdicts, pipe.requirements),
    stability: baselineStability(merged),
    missingAttribution: [{
      requirement: '분석 결과를 CSV 로 내보내는 기능',
      matched_merged_id: null, found_by: [], found_by_none: true,
    }],
    verdicts: progress.verdicts,
    merged,
    costSummary: llm.ledger.summary(),
    contextAnalysis: fs.readFileSync(path.join(outDir, 'baseline_context_analysis.md'), 'utf8')
      .split('\n').slice(1).join('\n').trim(),
    filterCounts: loaded.counts,
    parseDiagnostics: loaded.diagnostics,
    meta: { project: '/home/user/demo-app (합성)', range: loaded.meta.range },
    notes: ['이 실행은 합성 transcript + mock 모델이다. 결과 해석에 사용할 수 없다.'],
  });

  const warning = [
    '<!-- 이 파일은 합성 데이터 + mock 모델로 생성된 예시입니다. 실제 결과가 아닙니다. -->',
    '', '> ⚠️ **이것은 예시 출력입니다.**',
    '> 합성 transcript 를 mock 모델로 처리한 결과이며, IntentGuard 에 대한 어떤 증거도 아닙니다.',
    '> 산출물의 형태를 미리 보기 위한 것입니다.', '', ''].join('\n');
  fs.writeFileSync(path.join(OUT, 'RESULT.md'), warning + md);

  fs.writeFileSync(path.join(OUT, 'README.md'), [
    '# Example Run (합성 데이터 · mock 모델)', '',
    '> ⚠️ **여기 있는 모든 숫자는 조작된 것입니다.**', '',
    '`fixtures/make_fixture.js` 가 만든 합성 transcript 를',
    '`fixtures/mock-llm.js` 의 가짜 모델로 처리한 결과입니다.',
    'API 호출은 한 번도 일어나지 않았습니다.', '',
    '**목적**: 실제 돈을 쓰기 전에 각 단계가 무엇을 만들어내는지 형태를 확인하는 것.',
    '**금지**: 이 결과로 IntentGuard 의 성능을 판단하는 것. 합성 데이터에는',
    '작성자가 넣어둔 패턴만 들어 있으므로 순환논증이 됩니다 (명세 §36).', '',
    '## 파일', '',
    '| 경로 | 만든 단계 |', '|---|---|',
    '| `output/message_filter_samples.md` | STEP 3 — 사람이 검토할 파일 |',
    '| `output/message_filter_report.md` | STEP 3 — 필터 카운트 |',
    '| `output/parse_diagnostics.md` | STEP 3 — 스키마 변형 |',
    '| `output/intentguard_contract.md` | STEP 7 — Product Contract (명세 §14) |',
    '| `output/baseline_context_analysis.md` | STEP 8 — context 분석 (명세 §17) |',
    '| `data/classified_messages.json` | Stage 2 |',
    '| `data/candidates.json` | Stage 3 |',
    '| `data/groups.json` | Stage 4 |',
    '| `data/reconciled.json` | Stage 5-7 |',
    '| `data/baseline_{1,2,3}.json` | STEP 8 |',
    '| `data/merged_items.json` | STEP 9 — hidden source 포함 |',
    '| `data/blind_items.json` | STEP 9 — **평가자에게 보이는 전부** |',
    '| `data/evaluation_progress.json` | STEP 10-11 |',
    '| `RESULT.md` | STEP 13 |', '',
    '재생성: `node fixtures/make_demo.js`', '',
  ].join('\n'));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote ' + path.relative(ROOT, OUT));
})().catch((e) => { console.error(e); process.exit(1); });
