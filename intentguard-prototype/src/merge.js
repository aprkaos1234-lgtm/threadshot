'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { topK, UnionFind } = require('./similar');
const { batchByTokens } = require('./llm');

/*
 * Semantic matching + 4-way blind merge (spec §18, §19).
 *
 * §18: never judge every pair. Lexical retrieval narrows to the top 3-5
 * candidates per requirement; only those go to the model, batched.
 * §19: the merged list carries `sources` as hidden metadata that the evaluation
 * must never surface.
 */

const JUDGE_SYSTEM = `당신은 두 요구사항 진술이 **같은 요구사항인지** 판정합니다.

표현이 달라도 같은 제품 동작을 요구하면 SAME_REQUIREMENT 입니다.
관련은 있지만 요구하는 바가 다르면 RELATED_BUT_DIFFERENT 입니다.
무관하면 DIFFERENT 입니다.
판단이 어려우면 UNCERTAIN 입니다.

예:
- "무료 사용자는 월 3회 분석 가능" vs "무료 회원 분석 횟수 월 3회 제한"
  → SAME_REQUIREMENT
- "무료 사용자는 월 3회" vs "유료 사용자는 무제한"
  → RELATED_BUT_DIFFERENT (대상이 다름)
- "월 3회 제한" vs "카카오 로그인 지원"
  → DIFFERENT

상태(ACTIVE/REJECTED 등)가 달라도, **요구사항 자체가 같으면** SAME_REQUIREMENT 입니다.
상태 차이는 판정 대상이 아닙니다.`;

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['judgements'],
  properties: {
    judgements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['query_id', 'candidate_id', 'verdict'],
        properties: {
          query_id: { type: 'string' },
          candidate_id: { type: 'string' },
          verdict: {
            type: 'string',
            enum: ['SAME_REQUIREMENT', 'RELATED_BUT_DIFFERENT', 'DIFFERENT', 'UNCERTAIN'],
          },
        },
      },
    },
  },
};

/** Normalise every system's output into one shape with a hidden source tag. */
function collectItems(intentguard, baselines) {
  const items = [];
  let n = 0;
  const push = (source, requirement, status) => {
    if (!requirement || !String(requirement).trim()) return;
    items.push({
      _id: 'it_' + (++n).toString().padStart(4, '0'),
      requirement: String(requirement).trim(),
      status: status || 'ACTIVE',
      _source: source, // HIDDEN — never rendered to the evaluator
    });
  };
  for (const r of intentguard) push('intentguard', r.requirement, r.status);
  baselines.forEach((runReqs, i) => {
    for (const r of runReqs) push('baseline_' + (i + 1), r.requirement, r.status);
  });
  return items;
}

async function judgePairs(llm, items, log) {
  // Retrieval: top 5 per item, then dedupe to unordered pairs (spec §18).
  const retrieved = topK(items, items, (it) => it.requirement, 5, 0.12);
  const pairs = new Map();
  for (const { query, candidates } of retrieved) {
    for (const c of candidates) {
      if (c.item._id === query._id) continue;
      // Two outputs from the SAME system are not merged with each other:
      // a system listing one requirement twice is its own error, and merging it
      // away would hide that.
      if (c.item._source === query._source) continue;
      const key = [query._id, c.item._id].sort().join('|');
      if (!pairs.has(key)) pairs.set(key, { a: query, b: c.item, score: c.score });
    }
  }
  const pairList = [...pairs.values()];
  const exhaustive = items.length * (items.length - 1) / 2;
  log('  ' + pairList.length + ' pairs to judge (exhaustive would be ' + exhaustive + ')');

  const judgements = [];
  const batches = batchByTokens(pairList, (p) => p.a.requirement + p.b.requirement, 10000, 25);
  for (let i = 0; i < batches.length; i++) {
    const { data } = await llm.structured({
      stage: 'semantic_judge',
      system: JUDGE_SYSTEM,
      user: '다음 쌍들을 각각 판정하세요.\n\n' + batches[i].map((p) => [
        '- query_id: ' + p.a._id,
        '  candidate_id: ' + p.b._id,
        '  A: ' + p.a.requirement,
        '  B: ' + p.b.requirement,
      ].join('\n')).join('\n\n'),
      schema: JUDGE_SCHEMA,
      maxTokens: 8000,
    });
    log('  judge batch ' + (i + 1) + '/' + batches.length);
    for (const j of ((data && data.judgements) || [])) judgements.push(j);
  }
  return { judgements, pairCount: pairList.length, exhaustive };
}

/**
 * Spec §18: bidirectional A→B / B→A checking only for UNCERTAIN or borderline
 * cases, not for everything.
 */
async function recheckUncertain(llm, items, judgements, log) {
  const byId = new Map(items.map((i) => [i._id, i]));
  const uncertain = judgements.filter((j) => j.verdict === 'UNCERTAIN');
  if (!uncertain.length) return { extra: [], count: 0 };
  log('  re-checking ' + uncertain.length + ' UNCERTAIN pairs in reverse order');
  const extra = [];
  const batches = batchByTokens(uncertain, () => 'x', 10000, 25);
  for (const batch of batches) {
    const rows = batch.map((j) => ({ a: byId.get(j.candidate_id), b: byId.get(j.query_id) }))
      .filter((r) => r.a && r.b);
    if (!rows.length) continue;
    const { data } = await llm.structured({
      stage: 'semantic_judge',
      system: JUDGE_SYSTEM,
      user: '다음 쌍들을 각각 판정하세요.\n\n' + rows.map((p) => [
        '- query_id: ' + p.a._id,
        '  candidate_id: ' + p.b._id,
        '  A: ' + p.a.requirement,
        '  B: ' + p.b.requirement,
      ].join('\n')).join('\n\n'),
      schema: JUDGE_SCHEMA,
      maxTokens: 8000,
    });
    for (const j of ((data && data.judgements) || [])) extra.push(j);
  }
  return { extra, count: uncertain.length };
}

function mergeItems(items, judgements) {
  const uf = new UnionFind(items.map((i) => i._id));
  const byId = new Map(items.map((i) => [i._id, i]));
  for (const j of judgements) {
    if (j.verdict !== 'SAME_REQUIREMENT') continue;
    if (byId.has(j.query_id) && byId.has(j.candidate_id)) uf.union(j.query_id, j.candidate_id);
  }
  return uf.groups().map((ids, i) => {
    const members = ids.map((id) => byId.get(id));
    // Prefer the longest statement as the displayed text: it usually carries
    // the qualifiers the shorter ones dropped. Never mention a system.
    const display = members.slice().sort((a, b) => b.requirement.length - a.requirement.length)[0];
    const statuses = [...new Set(members.map((m) => m.status))];
    return {
      id: 'merged_' + (i + 1).toString().padStart(4, '0'),
      requirement: display.requirement,
      // If systems disagree on status, the majority is shown; the disagreement
      // itself is recorded for §25's stability analysis.
      status: majority(members.map((m) => m.status)),
      _sources: [...new Set(members.map((m) => m._source))].sort(),
      _member_statuses: Object.fromEntries(members.map((m) => [m._source, m.status])),
      _status_disagreement: statuses.length > 1,
      _members: members.map((m) => ({ id: m._id, source: m._source, requirement: m.requirement, status: m.status })),
    };
  });
}

function majority(values) {
  const c = {};
  for (const v of values) c[v] = (c[v] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

/** Deterministic shuffle so a re-run presents the same order (spec §19). */
function shuffle(list, seed) {
  const keyed = list.map((it) => ({
    it,
    k: crypto.createHash('sha256').update(seed + '|' + it.id).digest('hex'),
  }));
  keyed.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return keyed.map((x) => x.it);
}

async function runMerge(llm, intentguardReqs, baselineResults, outDirs, log, seed) {
  const { dataDir } = outDirs;
  const items = collectItems(intentguardReqs, baselineResults);
  log('Semantic merge — ' + items.length + ' raw items from 4 systems');

  const { judgements, pairCount, exhaustive } = await judgePairs(llm, items, log);
  const { extra, count: uncertainCount } = await recheckUncertain(llm, items, judgements, log);
  const merged = mergeItems(items, judgements.concat(extra));
  log('  → ' + merged.length + ' merged items');

  const shuffled = shuffle(merged, seed || 'intentguard');
  fs.writeFileSync(path.join(dataDir, 'merged_items.json'), JSON.stringify({
    generated: new Date().toISOString(),
    seed: seed || 'intentguard',
    stats: {
      raw_items: items.length,
      merged_items: merged.length,
      pairs_judged: pairCount,
      exhaustive_pairs_avoided: exhaustive,
      uncertain_rechecked: uncertainCount,
      judge_calls_saved_ratio: exhaustive ? Number((1 - pairCount / exhaustive).toFixed(3)) : 0,
    },
    items: shuffled,
  }, null, 2));

  // The blind list is a SEPARATE file containing only what the evaluator may
  // see. Keeping it separate is what prevents an accidental source leak.
  const blind = shuffled.map((m, i) => ({
    n: i + 1,
    merged_id: m.id,
    requirement: m.requirement,
    proposed_status: m.status,
  }));
  fs.writeFileSync(path.join(dataDir, 'blind_items.json'), JSON.stringify({
    generated: new Date().toISOString(),
    count: blind.length,
    items: blind,
  }, null, 2));
  return { items, merged: shuffled, blind };
}

module.exports = { runMerge, collectItems, mergeItems, shuffle, judgePairs, JUDGE_SYSTEM };
