'use strict';
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./tokens');
const { priceOf } = require('./cost');

/*
 * The baseline (spec §15, §16, §17).
 *
 * The experiment is only worth running if the baseline is strong, so:
 *   - it gets the SAME filtered human timeline IntentGuard gets, not the raw
 *     noisy transcript;
 *   - it runs on the same model at the same effort;
 *   - it gets a carefully written prompt, not a throwaway one;
 *   - when the history does not fit in one context, it gets a real
 *     chunk-summarise strategy rather than being silently truncated, and that
 *     structure is recorded so §17's question — did IntentGuard win only by
 *     processing more context? — can actually be answered.
 */

// Spec §15, verbatim.
const BASELINE_PROMPT = `다음은 하나의 소프트웨어 프로젝트를 장기간 개발하면서 사용자가 AI 코딩 도구에 입력한 시간순 메시지입니다.

현재 시점에서 실제로 유효한 제품 요구사항을 복구하세요.

시간순 요구사항 추가, 변경, 취소, 임시 변경, 재활성화, 대체 관계를 모두 고려하세요.

질문, 단순 아이디어, 이미 취소된 요구사항, 종료된 임시 테스트 설정은 현재 ACTIVE 요구사항에서 제외하세요.

서로 충돌하는 지시가 있다면 시간축 전체를 보고 현재 상태를 판단하세요.

판단할 수 없다면 AMBIGUOUS로 표시하세요.

사용자가 실제로 말하지 않은 요구사항을 추가하지 마세요.`;

const BASELINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['requirements'],
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['requirement', 'status'],
        properties: {
          requirement: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'AMBIGUOUS', 'SUPERSEDED', 'REJECTED', 'TEMPORARY'],
          },
          evidence: { type: ['string', 'null'], description: '근거가 된 사용자 발언 인용' },
          reasoning: { type: ['string', 'null'] },
        },
      },
    },
  },
};

function renderTimeline(messages) {
  return messages.map((m) =>
    '[' + (m.timestamp || '?') + '] ' + String(m.text || '').replace(/\n{3,}/g, '\n\n')
  ).join('\n\n');
}

/**
 * Decide how the whole history can be delivered to the baseline.
 * Returns { strategy, chunks, analysis } — analysis feeds RESULT.md §7.
 */
function planContext(messages, model, reserveForOutput = 32000) {
  const text = renderTimeline(messages);
  const promptTokens = estimateTokens(BASELINE_PROMPT + text);
  const limit = priceOf(model).context;
  const usable = limit - reserveForOutput;

  const analysis = {
    model,
    context_limit: limit,
    reserved_for_output: reserveForOutput,
    estimated_total_tokens: promptTokens,
    messages_total: messages.length,
  };

  if (promptTokens <= usable) {
    return {
      strategy: 'single_pass',
      chunks: [messages],
      analysis: Object.assign(analysis, {
        fits_in_one_context: true,
        history_included_ratio: 1,
        messages_truncated: 0,
        truncated_date_range: null,
        note: '전체 이력이 한 번에 들어갔다. IntentGuard 와 완전히 동일한 입력이다.',
      }),
    };
  }

  // Split chronologically into chunks that each fit, with a small overlap so a
  // requirement stated at a boundary is not orphaned.
  const chunks = [];
  let cur = [];
  let curTokens = 0;
  const budget = Math.floor(usable * 0.8);
  for (const m of messages) {
    const t = estimateTokens(m.text || '') + 20;
    if (cur.length && curTokens + t > budget) {
      chunks.push(cur);
      cur = cur.slice(-3); // overlap
      curTokens = cur.reduce((a, x) => a + estimateTokens(x.text || '') + 20, 0);
    }
    cur.push(m);
    curTokens += t;
  }
  if (cur.length) chunks.push(cur);

  return {
    strategy: 'chunked_rolling_summary',
    chunks,
    analysis: Object.assign(analysis, {
      fits_in_one_context: false,
      chunk_count: chunks.length,
      history_included_ratio: 1,
      messages_truncated: 0,
      truncated_date_range: null,
      note: '전체 이력이 한 컨텍스트에 들어가지 않아 시간순 청크 + 누적 요약 전략을 사용했다. ' +
        '아무것도 버리지 않았다 (명세 §17: IntentGuard 에 유리하게 자르지 않는다).',
    }),
  };
}

const ROLLING_SYSTEM = BASELINE_PROMPT + `

이번에는 전체 이력이 너무 길어 시간순으로 나누어 전달됩니다.
지금까지 정리된 요구사항 목록과 다음 구간의 메시지를 함께 받습니다.
새 구간을 반영해 **누적된 요구사항 목록 전체**를 갱신해서 반환하세요.
이전 구간에서 정해진 요구사항이 새 구간에서 변경/취소/복구되면 상태를 고치세요.`;

/** One baseline run. */
async function runOnce(llm, messages, plan, runIndex, log) {
  if (plan.strategy === 'single_pass') {
    const { data } = await llm.structured({
      stage: 'baseline_' + runIndex,
      system: BASELINE_PROMPT,
      user: renderTimeline(messages),
      schema: BASELINE_SCHEMA,
      maxTokens: 32000,
    });
    return (data && data.requirements) || [];
  }

  let acc = [];
  for (let i = 0; i < plan.chunks.length; i++) {
    const { data } = await llm.structured({
      stage: 'baseline_' + runIndex,
      system: ROLLING_SYSTEM,
      user: '## 지금까지 정리된 요구사항 (' + acc.length + '개)\n\n' +
        (acc.length ? JSON.stringify(acc, null, 1) : '(없음 — 첫 구간입니다)') +
        '\n\n## 다음 구간 메시지 (' + (i + 1) + '/' + plan.chunks.length + ')\n\n' +
        renderTimeline(plan.chunks[i]),
      schema: BASELINE_SCHEMA,
      maxTokens: 32000,
    });
    acc = (data && data.requirements) || acc;
    log('    chunk ' + (i + 1) + '/' + plan.chunks.length + ' → ' + acc.length + ' requirements');
  }
  return acc;
}

/** Spec §16: three runs, identical conditions, no cherry-picking. */
async function runBaselines(llm, timeline, outDirs, log, runs = 3) {
  const { dataDir, outDir } = outDirs;
  const messages = timeline.filter((m) => m.text &&
    ['HUMAN_INTENT', 'HUMAN_CORRECTION', 'HUMAN_CONTEXT', 'HUMAN_CONFIRMATION', 'UNKNOWN']
      .includes(m.message_type));

  const plan = planContext(messages, llm.model);
  log('Baseline — ' + messages.length + ' messages, strategy: ' + plan.strategy);
  log('  estimated ' + plan.analysis.estimated_total_tokens.toLocaleString() +
    ' tokens vs ' + plan.analysis.context_limit.toLocaleString() + ' context limit');

  const results = [];
  for (let i = 1; i <= runs; i++) {
    log('  run ' + i + '/' + runs);
    const reqs = await runOnce(llm, messages, plan, i, log);
    results.push(reqs);
    fs.writeFileSync(path.join(dataDir, 'baseline_' + i + '.json'), JSON.stringify({
      generated: new Date().toISOString(),
      run: i,
      strategy: plan.strategy,
      requirements: reqs,
    }, null, 2));
    log('    → ' + reqs.length + ' requirements');
  }

  fs.writeFileSync(path.join(outDir, 'baseline_context_analysis.md'),
    renderContextAnalysis(plan, messages));
  return { results, plan };
}

function renderContextAnalysis(plan, messages) {
  const a = plan.analysis;
  const ts = messages.map((m) => m.timestamp).filter(Boolean).sort();
  const L = ['# Baseline Context / History Coverage (명세 §17)', '',
    '| 항목 | 값 |', '|---|---|',
    '| 전략 | `' + plan.strategy + '` |',
    '| Baseline model | `' + a.model + '` |',
    '| Model context limit | ' + a.context_limit.toLocaleString() + ' tokens |',
    '| 전체 예상 tokens | ' + a.estimated_total_tokens.toLocaleString() + ' |',
    '| 한 컨텍스트에 들어가는가 | ' + (a.fits_in_one_context ? '예' : '아니오') + ' |',
    '| 청크 수 | ' + (a.chunk_count || 1) + ' |',
    '| 포함된 history 비율 | ' + (a.history_included_ratio * 100).toFixed(1) + '% |',
    '| 잘린 message 수 | ' + a.messages_truncated + ' |',
    '| 잘린 날짜 범위 | ' + (a.truncated_date_range || '없음') + ' |',
    '| 이력 범위 | ' + (ts[0] || '?') + ' ~ ' + (ts[ts.length - 1] || '?') + ' |',
    '', a.note, '',
    '## 이 표를 읽는 법', '',
    'IntentGuard 가 이겼다면, **더 많은 context 를 처리해서 이긴 것인지**',
    '**시간축을 구조화해서 이긴 것인지** 구분해야 합니다 (명세 §17).', '',
    a.fits_in_one_context
      ? '이 실행에서는 Baseline 이 전체 이력을 한 번에 받았습니다. 따라서 context 량은 동일 조건이고,\n' +
        '차이가 났다면 그것은 **구조화의 효과**로 해석할 수 있습니다.'
      : 'Baseline 은 전체 이력을 한 번에 받지 못해 청크 + 누적 요약으로 처리했습니다.\n' +
        '**아무 메시지도 버리지 않았지만**, 누적 요약 과정에서 정보가 손실될 수 있습니다.\n' +
        '이 경우 IntentGuard 의 우위 중 일부는 구조화가 아니라 **분할 처리 방식의 차이**일 수 있으므로,\n' +
        'RESULT.md 에서 그 가능성을 반드시 함께 기술해야 합니다.',
    ''];
  return L.join('\n');
}

module.exports = { runBaselines, planContext, BASELINE_PROMPT, BASELINE_SCHEMA, renderTimeline };
