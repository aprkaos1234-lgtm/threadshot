'use strict';
const fs = require('fs');
const path = require('path');

/*
 * Metrics (§13, §24, §25) and RESULT.md (§29).
 *
 * §30 is the rule that shapes this file: no single number decides anything.
 * High precision next to a huge ambiguous rate is not a good result, and a
 * one-or-two-requirement lead is not a win. So every metric is reported beside
 * the numbers that qualify it, and no GO/NO-GO verdict is computed.
 */

const SYSTEMS = ['intentguard', 'baseline_1', 'baseline_2', 'baseline_3'];
const DEFINITE = new Set(['CORRECT_ACTIVE', 'CORRECT_NON_ACTIVE']);

function pct(n, d) {
  if (!d) return null;
  return Number((100 * n / d).toFixed(1));
}
function show(v, suffix = '%') {
  return v === null || v === undefined ? 'n/a' : v + suffix;
}

/**
 * Per-system metrics. `verdicts` maps merged_id -> verdict.
 * A system's status for an item is its OWN proposal (_member_statuses), not the
 * merged majority — otherwise every system would be scored on the same status.
 */
function systemMetrics(merged, verdicts, system) {
  const mine = merged.filter((m) => m._sources.includes(system));
  const statusOf = (m) => (m._member_statuses || {})[system] || m.status;

  let activeProposed = 0, activeCorrect = 0;
  let falseReq = 0, wrongStatus = 0, ambiguousProposed = 0;
  let justifiedAmb = 0, avoidableAmb = 0;
  let judged = 0, statusRight = 0;

  for (const m of mine) {
    const v = verdicts[m.id];
    const st = statusOf(m);
    if (st === 'ACTIVE') activeProposed++;
    if (st === 'AMBIGUOUS') ambiguousProposed++;
    if (!v) continue;
    judged++;
    if (v === 'NOT_A_REAL_REQUIREMENT') falseReq++;
    if (v === 'WRONG_STATUS') wrongStatus++;
    if (st === 'ACTIVE' && v === 'CORRECT_ACTIVE') activeCorrect++;
    if (st === 'AMBIGUOUS') {
      if (v === 'AMBIGUOUS_IN_REALITY') justifiedAmb++;
      else if (DEFINITE.has(v)) avoidableAmb++;
    }
    // Temporal state accuracy: the evaluator confirmed a definite reality and
    // the system's status agrees with it.
    if (v === 'CORRECT_ACTIVE' && st === 'ACTIVE') statusRight++;
    else if (v === 'CORRECT_NON_ACTIVE' && st !== 'ACTIVE' && st !== 'AMBIGUOUS') statusRight++;
  }

  return {
    system,
    items: mine.length,
    judged,
    active_proposed: activeProposed,
    active_correct: activeCorrect,
    active_precision: pct(activeCorrect, activeProposed),
    false_requirement_rate: pct(falseReq, judged),
    wrong_status_rate: pct(wrongStatus, judged),
    ambiguous_rate: pct(ambiguousProposed, mine.length),
    ambiguous_count: ambiguousProposed,
    justified_ambiguous: justifiedAmb,
    avoidable_ambiguous: avoidableAmb,
    justified_ambiguous_rate: pct(justifiedAmb, justifiedAmb + avoidableAmb),
    avoidable_ambiguous_rate: pct(avoidableAmb, justifiedAmb + avoidableAmb),
    temporal_state_accuracy: pct(statusRight, judged),
  };
}

/**
 * Per-event-type accuracy (§24 tail).
 * Baselines emit no event chain, so the event type for an item comes from
 * IntentGuard's history. That is a real limitation and is stated in the report:
 * items IntentGuard never grouped have no event label at all.
 */
function temporalEventBreakdown(merged, verdicts, igRequirements) {
  const eventOf = new Map();
  const byReqText = new Map();
  for (const r of igRequirements) byReqText.set(r.requirement, r);

  for (const m of merged) {
    const ig = m._members.find((x) => x.source === 'intentguard');
    if (!ig) continue;
    const r = byReqText.get(ig.requirement);
    if (!r || !r.history) continue;
    const events = new Set(r.history.map((h) => h.event));
    const kinds = [];
    if (events.has('REJECTED')) kinds.push('REJECTION');
    if (events.has('TEMPORARILY_DISABLED') || events.has('TEMPORARILY_ENABLED')) kinds.push('TEMPORARY_CHANGE');
    if (events.has('MODIFIED')) kinds.push('SUPERSEDED');
    if (events.has('REACTIVATED')) kinds.push('REACTIVATION');
    if (kinds.length) eventOf.set(m.id, kinds);
  }

  const out = {};
  for (const kind of ['REJECTION', 'TEMPORARY_CHANGE', 'SUPERSEDED', 'REACTIVATION']) {
    const ids = [...eventOf.entries()].filter(([, k]) => k.includes(kind)).map(([id]) => id);
    const row = { items: ids.length };
    for (const s of SYSTEMS) {
      let judged = 0, right = 0;
      for (const id of ids) {
        const m = merged.find((x) => x.id === id);
        if (!m || !m._sources.includes(s)) continue;
        const v = verdicts[id];
        if (!v) continue;
        judged++;
        const st = (m._member_statuses || {})[s];
        if (v === 'CORRECT_ACTIVE' && st === 'ACTIVE') right++;
        else if (v === 'CORRECT_NON_ACTIVE' && st !== 'ACTIVE' && st !== 'AMBIGUOUS') right++;
      }
      row[s] = { judged, correct: right, accuracy: pct(right, judged) };
    }
    out[kind] = row;
  }
  return out;
}

/** Baseline run-to-run stability (§25). */
function baselineStability(merged) {
  const runs = ['baseline_1', 'baseline_2', 'baseline_3'];
  const activeSets = runs.map((r) => new Set(
    merged.filter((m) => m._sources.includes(r) && (m._member_statuses || {})[r] === 'ACTIVE')
      .map((m) => m.id)));
  const all = new Set(merged.map((m) => m.id));

  let inAll = 0, inSome = 0;
  for (const id of all) {
    const c = activeSets.filter((s) => s.has(id)).length;
    if (c === 3) inAll++;
    else if (c >= 1) inSome++;
  }

  let statusDisagreements = 0, ambiguousSpread = [];
  for (const m of merged) {
    const sts = runs.map((r) => (m._member_statuses || {})[r]).filter(Boolean);
    if (new Set(sts).size > 1) statusDisagreements++;
  }
  for (const r of runs) {
    ambiguousSpread.push({
      run: r,
      ambiguous: merged.filter((m) => (m._member_statuses || {})[r] === 'AMBIGUOUS').length,
      total: merged.filter((m) => m._sources.includes(r)).length,
    });
  }

  return {
    active_counts: runs.map((r, i) => ({ run: r, active: activeSets[i].size })),
    active_in_all_three: inAll,
    active_in_only_one_or_two: inSome,
    status_disagreements: statusDisagreements,
    ambiguous_by_run: ambiguousSpread,
  };
}

// ---------------------------------------------------------------------------
// RESULT.md — order fixed by spec §29
// ---------------------------------------------------------------------------

function renderResult(ctx) {
  const {
    metrics, eventBreakdown, stability, missingAttribution, verdicts, merged,
    costSummary, contextAnalysis, filterCounts, parseDiagnostics, meta, notes,
  } = ctx;
  const L = [];
  const M = (s) => metrics.find((m) => m.system === s) || {};

  L.push('# RESULT — IntentGuard Validation');
  L.push('');
  L.push('- 대상 프로젝트: `' + meta.project + '`');
  L.push('- 이력 범위: ' + meta.range);
  L.push('- 생성: ' + new Date().toISOString());
  L.push('- 평가된 항목: ' + Object.keys(verdicts).length + ' / ' + merged.length);
  L.push('');
  L.push('> 명세 §29 는 GO / NO-GO 를 자동 판정하지 말라고 요구합니다. 이 문서는 판정하지 않습니다.');
  L.push('> §30: 숫자 하나로 판단하지 않습니다. Precision 이 높아도 AMBIGUOUS 가 과다하면 좋은 결과가 아니고,');
  L.push('> 더 정확해도 차이가 미미하고 비용·복잡성만 크다면 좋은 결과가 아닙니다.');
  L.push('');

  // ---- 1
  L.push('# 1. MANUAL MISSING REQUIREMENTS');
  L.push('');
  L.push('명세 §22 가 이 실험의 가장 중요한 산출물로 지정한 항목입니다.');
  L.push('');
  if (!missingAttribution || !missingAttribution.length) {
    L.push('사용자가 보고한 누락 요구사항: **0개**');
    L.push('');
    L.push('명세 §23: 이것을 자동으로 성공으로 해석하지 않습니다. 두 가지 가능성을 모두 기록합니다.');
    L.push('');
    L.push('**A.** 두 시스템 모두 현재 Product Contract 를 충분히 잘 복구했다.');
    L.push('');
    L.push('**B.** 사용자가 애초에 현재 Product Contract 를 거의 다 기억하고 있어서,');
    L.push('IntentGuard 가 해결하려는 "잊힌 요구사항" 문제가 이 프로젝트에서는 약했다.');
    L.push('');
    L.push('둘 중 어느 쪽인지는 이 데이터만으로 구분할 수 없습니다.');
    L.push('B 라면, 더 길고 더 잊힌 프로젝트에서 재실험하지 않는 한 이 실험은 가설을 검증하지 못한 것입니다.');
  } else {
    L.push('| 사용자가 기억해낸 요구사항 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |');
    L.push('|---|:--:|:--:|:--:|:--:|');
    for (const m of missingAttribution) {
      const has = (s) => (m.found_by.includes(s) ? '✅' : '—');
      L.push('| ' + m.requirement.replace(/\|/g, '\\|') + ' | ' + has('intentguard') + ' | ' +
        has('baseline_1') + ' | ' + has('baseline_2') + ' | ' + has('baseline_3') + ' |');
    }
    L.push('');
    const igOnly = missingAttribution.filter((m) =>
      m.found_by.includes('intentguard') && !m.found_by.some((s) => s.startsWith('baseline')));
    const none = missingAttribution.filter((m) => m.found_by_none);
    L.push('- IntentGuard **만** 발견: ' + igOnly.length + '개');
    L.push('- 모두 누락: ' + none.length + '개');
    L.push('');
    if (igOnly.length) {
      L.push('**IntentGuard 만 발견한 항목** — 명세 §22 가 "가장 강한 Positive Signal 중 하나"로 지정한 경우입니다:');
      L.push('');
      for (const m of igOnly) L.push('- ' + m.requirement);
      L.push('');
    }
  }
  L.push('');

  // ---- 2
  L.push('# 2. 실제 잊힌 Requirement 사례');
  L.push('');
  const forgotten = (missingAttribution || []).filter((m) => m.found_by.length);
  if (!forgotten.length) {
    L.push('사용자가 잊고 있었다가 시스템 출력을 보고 떠올린 요구사항은 기록되지 않았습니다.');
  } else {
    for (const m of forgotten) {
      L.push('### ' + m.requirement);
      L.push('');
      L.push('- 발견한 시스템: ' + m.found_by.join(', '));
      L.push('');
    }
  }
  L.push('');

  // ---- 3
  L.push('# 3. Temporal Recovery');
  L.push('');
  L.push('취소 / 임시 변경 / 대체 / 재활성화 사건에서 각 시스템의 상태 판정 정확도입니다.');
  L.push('');
  L.push('| 사건 유형 | 해당 항목 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |');
  L.push('|---|---:|:--:|:--:|:--:|:--:|');
  for (const [kind, row] of Object.entries(eventBreakdown)) {
    const c = (s) => (row[s] && row[s].judged ? show(row[s].accuracy) + ' (' + row[s].correct + '/' + row[s].judged + ')' : 'n/a');
    L.push('| ' + kind + ' | ' + row.items + ' | ' + c('intentguard') + ' | ' +
      c('baseline_1') + ' | ' + c('baseline_2') + ' | ' + c('baseline_3') + ' |');
  }
  L.push('');
  L.push('> **이 표의 한계**: Baseline 은 사건 체인을 출력하지 않습니다. 따라서 "이 항목이 REJECTION 사건이었다"는');
  L.push('> 분류는 IntentGuard 의 history 에서 가져왔습니다. IntentGuard 가 애초에 묶지 못한 요구사항은');
  L.push('> 이 표에 아예 등장하지 않으므로, 이 표는 IntentGuard 에 유리한 방향으로 편향돼 있습니다.');
  L.push('> 절대값보다 시스템 간 상대 비교로만 읽으십시오.');
  L.push('');

  // ---- 4
  L.push('# 4. Blind Evaluation');
  L.push('');
  L.push('| 지표 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |');
  L.push('|---|---:|---:|---:|---:|');
  const row = (label, f) => L.push('| ' + label + ' | ' + SYSTEMS.map((s) => f(M(s))).join(' | ') + ' |');
  row('출력 항목 수', (m) => m.items ?? 'n/a');
  row('평가된 항목 수', (m) => m.judged ?? 'n/a');
  row('ACTIVE 로 제안한 수', (m) => m.active_proposed ?? 'n/a');
  row('**ACTIVE Precision**', (m) => show(m.active_precision));
  row('False Requirement Rate', (m) => show(m.false_requirement_rate));
  row('Wrong Status Rate', (m) => show(m.wrong_status_rate));
  row('Temporal State Accuracy', (m) => show(m.temporal_state_accuracy));
  L.push('');
  L.push('판정 분포:');
  L.push('');
  const dist = {};
  for (const v of Object.values(verdicts)) dist[v] = (dist[v] || 0) + 1;
  L.push('| 판정 | 수 |');
  L.push('|---|---:|');
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) L.push('| ' + k + ' | ' + v + ' |');
  L.push('');

  // ---- 5
  L.push('# 5. AMBIGUOUS 분석');
  L.push('');
  L.push('명세 §13: 애매한 것을 전부 AMBIGUOUS 로 보내는 시스템은 쓸모가 없습니다.');
  L.push('ACTIVE Precision 은 반드시 이 표와 함께 읽어야 합니다.');
  L.push('');
  L.push('| 지표 | IntentGuard | Baseline 1 | Baseline 2 | Baseline 3 |');
  L.push('|---|---:|---:|---:|---:|');
  row('AMBIGUOUS 수', (m) => m.ambiguous_count ?? 'n/a');
  row('**Ambiguous Rate**', (m) => show(m.ambiguous_rate));
  row('Justified (사람도 애매)', (m) => m.justified_ambiguous ?? 'n/a');
  row('Avoidable (사람은 판단 가능)', (m) => m.avoidable_ambiguous ?? 'n/a');
  row('Avoidable 비율', (m) => show(m.avoidable_ambiguous_rate));
  L.push('');
  const ig = M('intentguard');
  if (ig.avoidable_ambiguous > ig.justified_ambiguous) {
    L.push('> ⚠️ IntentGuard 의 AMBIGUOUS 중 **판단 회피가 정당한 애매함보다 많습니다**.');
    L.push('> 높은 Precision 이 판단 회피로 산 것일 수 있습니다 (명세 §13).');
    L.push('');
  }

  // ---- 6
  L.push('# 6. Baseline Stability');
  L.push('');
  L.push('동일 입력·동일 프롬프트·동일 모델로 3회 실행한 결과의 흔들림입니다 (명세 §25).');
  L.push('');
  L.push('| 항목 | 값 |');
  L.push('|---|---:|');
  for (const r of stability.active_counts) L.push('| ' + r.run + ' 의 ACTIVE 수 | ' + r.active + ' |');
  L.push('| 세 실행 모두 공통 ACTIVE | ' + stability.active_in_all_three + ' |');
  L.push('| 한두 실행에만 존재한 ACTIVE | ' + stability.active_in_only_one_or_two + ' |');
  L.push('| 상태 불일치 항목 | ' + stability.status_disagreements + ' |');
  L.push('');
  for (const a of stability.ambiguous_by_run) {
    L.push('- ' + a.run + ': AMBIGUOUS ' + a.ambiguous + ' / ' + a.total);
  }
  L.push('');
  if (stability.active_in_only_one_or_two > stability.active_in_all_three * 0.3) {
    L.push('> Baseline 이 동일 입력에서도 크게 흔들립니다. 이 경우 IntentGuard 와의 1회성 비교는');
    L.push('> 실력 차이가 아니라 실행 분산을 본 것일 수 있습니다.');
    L.push('');
  }

  // ---- 7
  L.push('# 7. Context Length / History Coverage');
  L.push('');
  L.push(contextAnalysis || '_baseline_context_analysis.md 참조._');
  L.push('');

  // ---- 8
  L.push('# 8. 비용');
  L.push('');
  L.push('| Stage | 호출 | Input tokens | Output tokens | 비용 (USD) |');
  L.push('|---|---:|---:|---:|---:|');
  const stages = Object.entries(costSummary.by_stage || {}).sort((a, b) => b[1].cost_usd - a[1].cost_usd);
  for (const [stage, s] of stages) {
    L.push('| ' + stage + ' | ' + s.calls + ' | ' + s.input_tokens.toLocaleString() + ' | ' +
      s.output_tokens.toLocaleString() + ' | $' + s.cost_usd.toFixed(4) + ' |');
  }
  L.push('| **합계** | ' + costSummary.total_calls + ' | | | **$' +
    costSummary.total_cost_usd.toFixed(4) + '** |');
  L.push('');
  const igCost = stages.filter(([s]) => !s.startsWith('baseline')).reduce((a, [, s]) => a + s.cost_usd, 0);
  const blCost = stages.filter(([s]) => s.startsWith('baseline')).reduce((a, [, s]) => a + s.cost_usd, 0);
  L.push('- IntentGuard 파이프라인 + 평가 인프라: $' + igCost.toFixed(4));
  L.push('- Baseline 3회 합계: $' + blCost.toFixed(4));
  if (blCost > 0) L.push('- 비용 배수: **' + (igCost / blCost).toFixed(1) + 'x**');
  L.push('');
  L.push('> 명세 §30: 더 정확해도 차이가 미미하고 비용·복잡성만 크다면 좋은 결과가 아닙니다.');
  L.push('');

  // ---- 9
  L.push('# 9. Message Filtering 품질');
  L.push('');
  if (filterCounts) {
    L.push('| 항목 | 수 |');
    L.push('|---|---:|');
    L.push('| Raw user-role messages | ' + filterCounts.rawUserRole + ' |');
    L.push('| Actual human messages | ' + filterCounts.humanMessages + ' |');
    L.push('| Intent-bearing | ' + filterCounts.intentBearing + ' |');
    L.push('| Low information | ' + filterCounts.lowInformation + ' |');
    L.push('| Noise/system/tool | ' + filterCounts.noise + ' |');
    L.push('| Unknown | ' + filterCounts.unknown + ' |');
    L.push('');
    L.push('Stage 1 은 결정론적 규칙이며 LLM 을 쓰지 않았습니다(비용 $0).');
    L.push('필터가 잘못 버린 사람 메시지는 이후 어떤 지표에도 나타나지 않습니다 —');
    L.push('`output/message_filter_samples.md` 의 사람 검토가 이 실험 전체의 신뢰도 상한입니다.');
  } else {
    L.push('_message_filter_report.md 참조._');
  }
  L.push('');

  // ---- 10
  L.push('# 10. 대표 실패 사례');
  L.push('');
  const fail = (pred) => merged.filter(pred).slice(0, 8);
  const wrong = (s, m) => {
    const v = verdicts[m.id];
    if (!v || !m._sources.includes(s)) return false;
    return v === 'NOT_A_REAL_REQUIREMENT' || v === 'WRONG_STATUS';
  };
  const igOnlyWrong = fail((m) => wrong('intentguard', m) &&
    !['baseline_1', 'baseline_2', 'baseline_3'].some((b) => m._sources.includes(b)));
  const blOnlyWrong = fail((m) => !m._sources.includes('intentguard') &&
    ['baseline_1', 'baseline_2', 'baseline_3'].some((b) => wrong(b, m)));
  const bothWrong = fail((m) => wrong('intentguard', m) &&
    ['baseline_1', 'baseline_2', 'baseline_3'].some((b) => wrong(b, m)));

  const section = (title, rows) => {
    L.push('## ' + title + ' (' + rows.length + ')');
    L.push('');
    if (!rows.length) { L.push('_해당 없음._'); L.push(''); return; }
    for (const m of rows) {
      L.push('- **' + m.requirement + '**');
      L.push('  - 제안 상태: ' + m.status + ' / 판정: ' + verdicts[m.id]);
      L.push('  - 출처: ' + m._sources.join(', '));
    }
    L.push('');
  };
  section('IntentGuard 만 틀린 사례', igOnlyWrong);
  section('Baseline 만 틀린 사례', blOnlyWrong);
  section('둘 다 틀린 사례', bothWrong);

  // ---- 11
  L.push('# 11. Parsing / Maintenance Risk');
  L.push('');
  L.push('Claude Code JSONL 은 외부 제품이 통제하는 비공개 포맷입니다.');
  L.push('여기 기록된 것은 IntentGuard 를 제품으로 유지할 때의 실제 부담에 대한 데이터입니다 (명세 §31).');
  L.push('');
  if (parseDiagnostics) {
    L.push('| 항목 | 값 |');
    L.push('|---|---|');
    L.push('| 관측된 Claude Code 버전 | ' + JSON.stringify(parseDiagnostics.versions) + ' |');
    L.push('| record type 종류 | ' + Object.keys(parseDiagnostics.recordTypes).length + ' |');
    L.push('| **parser 가 모르는 type** | ' + Object.keys(parseDiagnostics.unknownRecordTypes).length +
      ' ' + JSON.stringify(Object.keys(parseDiagnostics.unknownRecordTypes)) + ' |');
    L.push('| 자동 주입 attachment 종류 | ' + Object.keys(parseDiagnostics.attachmentTypes).length + ' |');
    L.push('| JSON 파싱 실패 | ' + parseDiagnostics.parseFailures + ' |');
    L.push('| 중복 uuid (세션 resume) | ' + parseDiagnostics.duplicateUuids + ' |');
    L.push('');
  }
  L.push('구조적으로 취약한 지점:');
  L.push('');
  L.push('1. `type: "user"` 가 인간 메시지와 tool result 를 함께 담고, `promptId` 는 tool result 에도');
  L.push('   상속됩니다. 판별은 `toolUseResult` / `sourceToolAssistantUUID` 같은 내부 필드에 의존합니다.');
  L.push('2. `origin.kind === "human"` 은 최신 버전에만 존재합니다. 필수 조건으로 걸면 과거 이력이 사라지고,');
  L.push('   보조 신호로만 쓰면 신버전의 이점을 못 씁니다. 어느 쪽도 안전하지 않습니다.');
  L.push('3. 자동 주입되는 `attachment` 종류가 버전마다 늘어납니다.');
  L.push('4. 인간 메시지 본문 안에도 `<system-reminder>`, slash 확장, wake 봉투가 섞여 들어옵니다.');
  L.push('');
  L.push('Claude Code 가 새 record type 을 추가하고 그 안에 인간 메시지가 들어가면 **조용히 누락됩니다**.');
  L.push('테스트가 실패하는 게 아니라 요구사항이 사라집니다.');
  L.push('');
  if (notes && notes.length) {
    L.push('## 실행 중 기록된 메모');
    L.push('');
    for (const n of notes) L.push('- ' + n);
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('**GO / NO-GO 는 자동 판정하지 않습니다 (명세 §29).**');
  L.push('');
  L.push('판단 기준은 §30 입니다:');
  L.push('긴 시간축에서 변경 / 취소 / 임시 설정 / 복구 / 대체를 Baseline 보다 실질적으로 더 잘 복구하는가,');
  L.push('그리고 사용자가 실제로 잊은 중요한 Requirement 를 다시 찾아주는가.');
  return L.join('\n');
}

module.exports = {
  systemMetrics, temporalEventBreakdown, baselineStability, renderResult, SYSTEMS,
};
