'use strict';
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./tokens');
const { priceOf } = require('./cost');
const { HUMAN_TYPES, INTENT_BEARING } = require('./filter');

/*
 * STEP 5-6 — cost estimate before the full run (spec §28).
 *
 * The estimate is built from the actual message texts of the full history plus
 * whatever the smoke run actually measured, not from a guessed dollar figure.
 * Where a ratio has to be assumed (how many candidates a message yields, how
 * many groups those candidates form), the assumption is printed, because an
 * estimate whose assumptions are hidden is not something you can decide on.
 */

// Ratios used when no smoke-run measurement is available. Deliberately on the
// pessimistic side: an underestimate that leads to a surprise bill is worse
// than an overestimate that leads to a second look.
const DEFAULTS = {
  candidates_per_intent_message: 1.3,
  groups_per_candidate: 0.55,
  judge_pairs_per_item: 2.5,
  output_ratio: 0.35, // output tokens as a fraction of input, per call
};

function humanMessages(timeline) {
  return timeline.filter((m) => HUMAN_TYPES.has(m.message_type) && m.text);
}

function estimateRun(timeline, model, ratios) {
  const human = humanMessages(timeline);
  const intent = timeline.filter((m) => INTENT_BEARING.has(m.message_type));
  const humanText = human.map((m) => m.text).join('\n');
  const humanTokens = estimateTokens(humanText);
  const intentTokens = estimateTokens(intent.map((m) => m.text).join('\n'));

  const price = priceOf(model);
  const cost = (inTok) => {
    const outTok = Math.ceil(inTok * ratios.output_ratio);
    return ((inTok * price.input) + (outTok * price.output)) / 1e6;
  };

  const nCandidates = Math.ceil(intent.length * ratios.candidates_per_intent_message);
  const nGroups = Math.max(1, Math.ceil(nCandidates * ratios.groups_per_candidate));

  // Stage-by-stage input-token estimates.
  const stages = {
    classification: humanTokens * 1.2,          // +prompt overhead & context lines
    candidate_extraction: intentTokens * 1.2,
    grouping: nCandidates * ratios.judge_pairs_per_item * 60,
    reconciliation: nGroups * 900,              // each group replays its own messages
  };
  const intentguardTokens = Object.values(stages).reduce((a, b) => a + b, 0);

  // Baseline: the full filtered timeline, three times.
  const baselinePerRun = humanTokens * 1.05;
  const baselineTokens = baselinePerRun * 3;

  // Semantic judge over the merged 4-way pool.
  const nItems = nGroups + nGroups * 3; // IntentGuard + 3 baselines, roughly
  const judgeTokens = nItems * ratios.judge_pairs_per_item * 60;

  const byStage = {};
  for (const [k, v] of Object.entries(stages)) byStage[k] = { input_tokens: Math.ceil(v), cost: cost(v) };
  byStage.baseline_1 = { input_tokens: Math.ceil(baselinePerRun), cost: cost(baselinePerRun) };
  byStage.baseline_2 = { input_tokens: Math.ceil(baselinePerRun), cost: cost(baselinePerRun) };
  byStage.baseline_3 = { input_tokens: Math.ceil(baselinePerRun), cost: cost(baselinePerRun) };
  byStage.semantic_judge = { input_tokens: Math.ceil(judgeTokens), cost: cost(judgeTokens) };

  return {
    model,
    messages: { human: human.length, intent_bearing: intent.length },
    tokens: { human: humanTokens, intent: intentTokens },
    assumed: { candidates: nCandidates, groups: nGroups, merged_items: nItems },
    by_stage: byStage,
    totals: {
      intentguard: cost(intentguardTokens),
      baselines: cost(baselineTokens),
      judge: cost(judgeTokens),
      all: cost(intentguardTokens) + cost(baselineTokens) + cost(judgeTokens),
    },
  };
}

function render(smokeEst, fullEst, observed, ratios, ratiosSource) {
  const $ = (n) => '$' + n.toFixed(2);
  const L = ['# Full Run Cost Estimate (명세 §28)', '',
    '생성: ' + new Date().toISOString(), '',
    '| | Smoke | Full |', '|---|---:|---:|',
    '| 사람 메시지 | ' + smokeEst.messages.human + ' | ' + fullEst.messages.human + ' |',
    '| intent-bearing | ' + smokeEst.messages.intent_bearing + ' | ' + fullEst.messages.intent_bearing + ' |',
    '| 사람 메시지 tokens | ' + smokeEst.tokens.human.toLocaleString() + ' | ' + fullEst.tokens.human.toLocaleString() + ' |',
    ''];

  if (observed) {
    L.push('## Observed Smoke Cost (실측)', '');
    L.push('| Stage | 호출 | 비용 |');
    L.push('|---|---:|---:|');
    for (const [stage, s] of Object.entries(observed.by_stage || {})) {
      L.push('| ' + stage + ' | ' + s.calls + ' | $' + s.cost_usd.toFixed(4) + ' |');
    }
    L.push('| **합계** | ' + observed.total_calls + ' | **$' + observed.total_cost_usd.toFixed(4) + '** |');
    L.push('');
  } else {
    L.push('## Observed Smoke Cost', '');
    L.push('**실측값 없음** — smoke 파이프라인을 아직 실행하지 않았습니다.');
    L.push('아래는 전부 토큰 추정에 근거한 예측치입니다.');
    L.push('');
  }

  L.push('## Estimated Full Run', '');
  L.push('| 항목 | 예상 비용 |');
  L.push('|---|---:|');
  L.push('| Estimated Full IntentGuard Cost | ' + $(fullEst.totals.intentguard) + ' |');
  L.push('| Estimated Baseline x3 | ' + $(fullEst.totals.baselines) + ' |');
  L.push('| Estimated Semantic Judge | ' + $(fullEst.totals.judge) + ' |');
  L.push('| **Estimated Total** | **' + $(fullEst.totals.all) + '** |');
  L.push('');
  L.push('Stage 별 내역:', '');
  L.push('| Stage | 예상 input tokens | 예상 비용 |');
  L.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(fullEst.by_stage)) {
    L.push('| ' + k + ' | ' + v.input_tokens.toLocaleString() + ' | ' + $(v.cost) + ' |');
  }
  L.push('');
  L.push('## 이 추정이 기대는 가정 (' + ratiosSource + ')', '');
  L.push('| 가정 | 값 |');
  L.push('|---|---:|');
  L.push('| intent 메시지당 후보 수 | ' + ratios.candidates_per_intent_message + ' |');
  L.push('| 후보당 그룹 비율 | ' + ratios.groups_per_candidate + ' |');
  L.push('| 항목당 judge 쌍 수 | ' + ratios.judge_pairs_per_item + ' |');
  L.push('| output/input 토큰 비 | ' + ratios.output_ratio + ' |');
  L.push('');
  L.push('- 추정 후보 수: ' + fullEst.assumed.candidates);
  L.push('- 추정 그룹 수: ' + fullEst.assumed.groups);
  L.push('- 추정 병합 전 항목 수: ' + fullEst.assumed.merged_items);
  L.push('');
  L.push('가정이 틀리면 비용도 틀립니다. 특히 **그룹 수**가 예상보다 많으면');
  L.push('reconciliation 단계는 그룹당 1회 호출이므로 선형으로 늘어납니다.');
  L.push('');
  L.push('모델: `' + fullEst.model + '` — 다른 모델을 쓰려면 `--model` 로 지정하고 다시 추정하세요.');
  L.push('');
  return L.join('\n');
}

function run(smokeTimeline, fullTimeline, model, ledgerSummary, outDir) {
  let ratios = Object.assign({}, DEFAULTS);
  let ratiosSource = '기본 가정값 (smoke 실측 없음)';

  const smokeEst = estimateRun(smokeTimeline, model, ratios);
  const fullEst = estimateRun(fullTimeline, model, ratios);
  const observed = ledgerSummary && ledgerSummary.total_calls ? ledgerSummary : null;

  const md = render(smokeEst, fullEst, observed, ratios, ratiosSource);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'full_run_cost_estimate.md'), md);
  return { smokeEst, fullEst, observed };
}

module.exports = { run, estimateRun, DEFAULTS };
