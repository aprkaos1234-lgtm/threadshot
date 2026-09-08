'use strict';
const fs = require('fs');
const path = require('path');
const { batchByTokens } = require('./llm');
const { topK, UnionFind } = require('./similar');
const { estimateTokens } = require('./tokens');

/*
 * IntentGuard pipeline, stages 2-7 (spec §12).
 *
 * The load-bearing design decision is in stages 5 and 6: the model labels each
 * event on a requirement's timeline, and *code* folds those events into a final
 * state. Asking a model "what is the current status" in one shot is what the
 * baseline already does — if IntentGuard is going to be different, the temporal
 * logic has to be explicit and auditable, not another opaque judgement.
 */

// ---------------------------------------------------------------------------
// Stage 2 — Message Classification (spec §9)
// ---------------------------------------------------------------------------

const MESSAGE_CLASSES = [
  'REQUIREMENT', 'CHANGE', 'REJECTION', 'TEMPORARY_CHANGE', 'IDEA',
  'QUESTION', 'BUG_REPORT', 'PREFERENCE', 'NON_REQUIREMENT', 'AMBIGUOUS',
];

const CLASSIFY_SYSTEM = `당신은 소프트웨어 프로젝트의 개발 기록을 분석합니다.

사용자가 AI 코딩 도구에 입력한 메시지들을 시간순으로 받습니다.
각 메시지를 다음 중 하나로 분류하세요.

REQUIREMENT       새로운 제품 요구사항을 진술한다
CHANGE            기존 요구사항의 내용/수치/방식을 영구적으로 바꾼다
REJECTION         기존 요구사항이나 기능을 취소·철회한다
TEMPORARY_CHANGE  한시적으로만 적용되는 변경이다 (테스트 중, 디버깅 중 등)
IDEA              가능성을 떠올리거나 제안만 한다. 아직 확정된 지시가 아니다
QUESTION          질문이다
BUG_REPORT        동작이 잘못됐다고 보고한다
PREFERENCE        스타일·취향의 선호를 말한다
NON_REQUIREMENT   요구사항과 무관하다
AMBIGUOUS         위 중 무엇인지 맥락을 봐도 판단할 수 없다

규칙:
- 질문과 단순 아이디어를 REQUIREMENT 로 만들지 마세요.
- "ㅇㅇ", "네" 같은 승인은 그 자체가 요구사항이 아니라 직전 맥락의 승인입니다.
  prior_context 를 보고 무엇을 승인한 것인지 판단하세요.
- 사용자가 실제로 말하지 않은 내용을 추론해서 채우지 마세요.
- AMBIGUOUS 를 남용하지 마세요. 맥락으로 판단 가능하면 판단하세요.`;

const CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'classification', 'confidence', 'reason'],
        properties: {
          id: { type: 'string' },
          classification: { type: 'string', enum: MESSAGE_CLASSES },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          approves_message_id: {
            type: ['string', 'null'],
            description: '이 메시지가 승인/확인이라면 무엇을 승인했는지의 메시지 id',
          },
        },
      },
    },
  },
};

function renderMessagesForPrompt(msgs, byId) {
  return msgs.map((m) => {
    const ctx = (m.context_message_ids || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((c) => '    [' + c.id.slice(0, 8) + ' @ ' + c.timestamp + '] ' + oneLine(c.text, 300));
    return [
      '- id: ' + m.id,
      '  time: ' + m.timestamp,
      ctx.length ? '  prior_context:\n' + ctx.join('\n') : null,
      '  text: |',
      indent(m.text, 4),
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function oneLine(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}
function indent(s, n) {
  const pad = ' '.repeat(n);
  return String(s || '').split('\n').map((l) => pad + l).join('\n');
}

async function stage2Classify(llm, timeline, log) {
  const byId = new Map(timeline.map((m) => [m.id, m]));
  // Only messages that could carry intent are worth spending tokens on. The
  // Stage 1 buckets that never become requirements are carried through as-is.
  const candidates = timeline.filter((m) =>
    ['HUMAN_INTENT', 'HUMAN_CORRECTION', 'HUMAN_CONTEXT', 'HUMAN_CONFIRMATION', 'UNKNOWN']
      .includes(m.message_type) && m.text);

  log('Stage 2 — classifying ' + candidates.length + ' human messages');
  const batches = batchByTokens(candidates, (m) => m.text, 20000, 25);
  log('  ' + batches.length + ' batch(es)');

  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const { data } = await llm.structured({
      stage: 'classification',
      system: CLASSIFY_SYSTEM,
      user: '다음 메시지들을 각각 분류하세요. 모든 id에 대해 결과를 반환하세요.\n\n' +
        renderMessagesForPrompt(batch, byId),
      schema: CLASSIFY_SCHEMA,
      maxTokens: 16000,
    });
    log('  batch ' + (i + 1) + '/' + batches.length + ' (' + batch.length + ' msgs)');
    if (data) results.push(...(data.results || []));
  }

  const byResult = new Map(results.map((r) => [r.id, r]));
  return candidates.map((m) => {
    const r = byResult.get(m.id);
    return {
      id: m.id,
      timestamp: m.timestamp,
      session_id: m.session_id,
      text: m.text,
      stage1_type: m.message_type,
      classification: r ? r.classification : 'AMBIGUOUS',
      confidence: r ? r.confidence : 0,
      reason: r ? r.reason : 'classifier returned no result for this id',
      approves_message_id: r ? (r.approves_message_id || null) : null,
      context_message_ids: m.context_message_ids || [],
    };
  });
}

// ---------------------------------------------------------------------------
// Stage 3 — Requirement Candidate Extraction (spec §10)
// ---------------------------------------------------------------------------

const CANDIDATE_CLASSES = new Set(['REQUIREMENT', 'CHANGE', 'REJECTION', 'TEMPORARY_CHANGE']);

const EXTRACT_SYSTEM = `당신은 개발 기록에서 제품 요구사항 후보를 추출합니다.

각 메시지에서 그 메시지가 실제로 진술한 요구사항만 뽑아내세요.

규칙:
- 한 메시지가 여러 요구사항을 담고 있으면 각각 분리하세요.
- normalized_requirement 는 그 자체로 읽히는 한 문장으로 쓰세요.
  ("월 3회" 처럼 무엇에 대한 것인지 알 수 없는 조각은 안 됩니다.)
- **사용자가 실제로 말하지 않은 세부사항을 절대 보충하지 마세요.**
  구현 방법, 기술 스택, UI 문구를 추측해서 넣지 마세요.
- 메시지가 이전 요구사항을 취소/변경하는 것이면 무엇을 대상으로 하는지
  refers_to 에 원문 표현 그대로 적으세요.
- 요구사항이 없으면 빈 배열을 반환하세요.`;

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source_message_id', 'normalized_requirement', 'type', 'confidence'],
        properties: {
          source_message_id: { type: 'string' },
          normalized_requirement: { type: 'string' },
          type: { type: 'string', enum: ['REQUIREMENT', 'CHANGE', 'REJECTION', 'TEMPORARY_CHANGE'] },
          refers_to: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
      },
    },
  },
};

async function stage3Candidates(llm, classified, log) {
  const src = classified.filter((m) => CANDIDATE_CLASSES.has(m.classification));
  log('Stage 3 — extracting candidates from ' + src.length + ' requirement-related messages');
  const batches = batchByTokens(src, (m) => m.text, 20000, 20);

  const out = [];
  const byId = new Map(src.map((m) => [m.id, m]));
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const { data } = await llm.structured({
      stage: 'candidate_extraction',
      system: EXTRACT_SYSTEM,
      user: '다음 메시지들에서 요구사항 후보를 추출하세요.\n\n' +
        batch.map((m) => [
          '- id: ' + m.id,
          '  time: ' + m.timestamp,
          '  classification: ' + m.classification,
          '  text: |',
          indent(m.text, 4),
        ].join('\n')).join('\n\n'),
      schema: EXTRACT_SCHEMA,
      maxTokens: 16000,
    });
    log('  batch ' + (i + 1) + '/' + batches.length);
    for (const c of ((data && data.candidates) || [])) {
      const s = byId.get(c.source_message_id);
      if (!s) continue; // model invented an id — drop rather than fabricate a source
      out.push({
        id: 'cand_' + (out.length + 1).toString().padStart(4, '0'),
        normalized_requirement: c.normalized_requirement,
        type: c.type,
        refers_to: c.refers_to || null,
        source_message_id: c.source_message_id,
        source_text: s.text,
        timestamp: s.timestamp,
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
      });
    }
  }
  out.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return out;
}

// ---------------------------------------------------------------------------
// Stage 4 — Similar Requirement Grouping (spec §12)
// ---------------------------------------------------------------------------

const GROUP_SYSTEM = `당신은 요구사항 후보들이 **같은 제품 요구사항에 대한 것인지** 판단합니다.

시점이 다르고 내용이 달라도, 같은 대상에 대한 것이면 SAME_TOPIC 입니다.
예: "무료 사용자 월 3회 제한" 과 "제한을 5회로 올리자" 는 같은 주제입니다
    (하나가 다른 하나를 변경하므로 같은 시간축에 놓여야 합니다).

DIFFERENT_TOPIC 은 서로 무관한 요구사항일 때만 쓰세요.`;

const GROUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['judgements'],
  properties: {
    judgements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['a', 'b', 'verdict'],
        properties: {
          a: { type: 'string' },
          b: { type: 'string' },
          verdict: { type: 'string', enum: ['SAME_TOPIC', 'DIFFERENT_TOPIC', 'UNCERTAIN'] },
        },
      },
    },
  },
};

async function stage4Group(llm, candidates, log) {
  log('Stage 4 — grouping ' + candidates.length + ' candidates');

  // Retrieval feeds the judge; anything it misses can never be reconciled, so
  // the group is silently lost and IntentGuard degrades into the baseline.
  // Two signals are used, because lexical similarity alone is not enough:
  //
  //   1. Lexical similarity over the normalized text (plus `refers_to`, which
  //      quotes what the user was pointing at).
  //   2. Temporal adjacency for corrections. "아니 3회 말고 5회로 하자" scores
  //      0.01 against "무료 사용자는 월 3회만 제한해" — it never repeats the
  //      subject — yet it is the same requirement. A CHANGE/REJECTION refers
  //      backwards in time by construction, so its recent predecessors are
  //      always considered regardless of wording.
  const queryText = (c) => c.normalized_requirement + (c.refers_to ? ' ' + c.refers_to : '');
  const retrieved = topK(candidates, candidates, queryText, 6, 0.10);
  const pairs = new Map();
  const addPair = (a, b, score, why) => {
    if (a.id === b.id) return;
    const key = [a.id, b.id].sort().join('|');
    if (!pairs.has(key)) pairs.set(key, { a, b, score, why });
  };
  for (const { query, candidates: cands } of retrieved) {
    for (const c of cands) addPair(query, c.item, c.score, 'lexical');
  }

  const BACKREF_WINDOW = 5;
  let backrefPairs = 0;
  candidates.forEach((c, i) => {
    if (c.type === 'REQUIREMENT') return; // a fresh requirement points nowhere
    for (let j = Math.max(0, i - BACKREF_WINDOW); j < i; j++) {
      const before = pairs.size;
      addPair(c, candidates[j], 0, 'temporal_backref');
      if (pairs.size > before) backrefPairs++;
    }
  });

  const pairList = [...pairs.values()];
  log('  ' + backrefPairs + ' additional pairs from temporal back-reference');
  log('  ' + pairList.length + ' candidate pairs after lexical retrieval ' +
    '(exhaustive would be ' + (candidates.length * (candidates.length - 1) / 2) + ')');

  const uf = new UnionFind(candidates.map((c) => c.id));
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const judgements = [];

  const batches = batchByTokens(pairList,
    (p) => p.a.normalized_requirement + p.b.normalized_requirement, 12000, 30);
  for (let i = 0; i < batches.length; i++) {
    const { data } = await llm.structured({
      stage: 'grouping',
      system: GROUP_SYSTEM,
      user: '다음 쌍들이 같은 요구사항 주제인지 각각 판정하세요.\n\n' +
        batches[i].map((p, j) => [
          (j + 1) + ')',
          '  a (' + p.a.id + ', ' + p.a.timestamp + '): ' + p.a.normalized_requirement,
          '  b (' + p.b.id + ', ' + p.b.timestamp + '): ' + p.b.normalized_requirement,
        ].join('\n')).join('\n\n'),
      schema: GROUP_SCHEMA,
      maxTokens: 8000,
    });
    log('  batch ' + (i + 1) + '/' + batches.length);
    for (const j of ((data && data.judgements) || [])) {
      judgements.push(j);
      if (j.verdict === 'SAME_TOPIC' && byId.has(j.a) && byId.has(j.b)) uf.union(j.a, j.b);
    }
  }

  const groups = uf.groups().map((ids, i) => {
    const members = ids.map((id) => byId.get(id))
      .sort((x, y) => Date.parse(x.timestamp) - Date.parse(y.timestamp));
    return {
      id: 'grp_' + (i + 1).toString().padStart(3, '0'),
      candidate_ids: members.map((m) => m.id),
      label: members[0].normalized_requirement,
      members,
    };
  });
  log('  ' + groups.length + ' groups');
  return { groups, judgements, pairCount: pairList.length };
}

// ---------------------------------------------------------------------------
// Stage 5 — Temporal Reconciliation: the model labels EVENTS only (spec §11)
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  'CREATED',              // requirement first stated
  'MODIFIED',             // permanently changed (supersedes the previous form)
  'REAFFIRMED',           // restated without change
  'TEMPORARILY_DISABLED', // suspended, expected to come back
  'TEMPORARILY_ENABLED',  // switched on only for now
  'REACTIVATED',          // explicitly returned to a previous state
  'REJECTED',             // cancelled for good
  'UNCLEAR',              // the model cannot tell what this event did
];

const RECONCILE_SYSTEM = `당신은 하나의 제품 요구사항이 시간에 따라 어떻게 변해왔는지 읽습니다.

같은 주제에 대한 발언들을 시간순으로 받습니다.
**각 발언이 그 요구사항에 무슨 일을 했는지만** 라벨링하세요.
최종 상태는 당신이 결정하지 않습니다 — 라벨만 정확히 붙이면 됩니다.

CREATED               요구사항이 처음 진술됨
MODIFIED              내용/수치가 영구적으로 바뀜
REAFFIRMED            변경 없이 다시 확인됨
TEMPORARILY_DISABLED  한시적으로 해제/중단됨 (테스트 중 등, 되돌릴 것이 전제됨)
TEMPORARILY_ENABLED   한시적으로만 켜짐
REACTIVATED           이전 상태로 명시적으로 되돌림
REJECTED              영구적으로 취소됨
UNCLEAR               이 발언이 무엇을 했는지 판단할 수 없음

중요:
- "테스트하는 동안 제한 풀어" 는 REJECTED 가 아니라 TEMPORARILY_DISABLED 입니다.
- "출시할 때는 다시 월 3회로" 는 REACTIVATED 입니다.
- 마지막 발언만 보고 판단하지 마세요. 각 발언을 그 시점의 맥락에서 라벨링하세요.
- current_statement 에는 그 시점 이후 유효한 요구사항 문장을 쓰세요.
  (MODIFIED 라면 바뀐 내용을 반영한 문장, 아니면 기존 문장 그대로)`;

const RECONCILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['canonical_requirement', 'events'],
  properties: {
    canonical_requirement: {
      type: 'string',
      description: '이 그룹이 다루는 요구사항을 한 문장으로. 최신 내용을 반영한다.',
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidate_id', 'event', 'current_statement', 'confidence'],
        properties: {
          candidate_id: { type: 'string' },
          event: { type: 'string', enum: EVENT_TYPES },
          current_statement: { type: 'string' },
          confidence: { type: 'number' },
          note: { type: ['string', 'null'] },
        },
      },
    },
  },
};

async function stage5Events(llm, groups, log) {
  log('Stage 5 — labelling events for ' + groups.length + ' groups');
  const out = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const { data } = await llm.structured({
      stage: 'reconciliation',
      system: RECONCILE_SYSTEM,
      user: '다음은 같은 요구사항 주제에 대한 발언들입니다 (시간순).\n\n' +
        g.members.map((m) => [
          '- candidate_id: ' + m.id,
          '  time: ' + m.timestamp,
          '  type: ' + m.type,
          '  requirement: ' + m.normalized_requirement,
          m.refers_to ? '  refers_to: ' + m.refers_to : null,
          '  original_message: |',
          indent(oneLine(m.source_text, 1500), 4),
        ].filter(Boolean).join('\n')).join('\n\n'),
      schema: RECONCILE_SCHEMA,
      maxTokens: 8000,
    });
    if ((i + 1) % 10 === 0 || i === groups.length - 1) {
      log('  ' + (i + 1) + '/' + groups.length + ' groups');
    }
    out.push({ group: g, result: data });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 6 — Final Status Decision: deterministic fold over the event chain
// ---------------------------------------------------------------------------

/*
 * This is code, not a model call, on purpose. The fold is the part of
 * IntentGuard that the baseline cannot replicate by construction: the state
 * machine is inspectable, so when the final answer is wrong we can see whether
 * the model mislabelled an event or the rules folded it badly.
 */
function foldEvents(events) {
  let status = null;
  let statement = null;
  let suspendedFrom = null; // state a TEMPORARY_* event interrupted
  const history = [];
  const flags = [];

  for (const e of events) {
    switch (e.event) {
      case 'CREATED':
        status = 'ACTIVE'; statement = e.current_statement || statement; break;
      case 'MODIFIED':
        if (status === 'REJECTED') flags.push('rejected requirement was modified back into existence');
        status = 'ACTIVE'; statement = e.current_statement || statement; break;
      case 'REAFFIRMED':
        status = 'ACTIVE'; statement = e.current_statement || statement; break;
      case 'TEMPORARILY_DISABLED':
        suspendedFrom = status || 'ACTIVE';
        status = 'TEMPORARY';
        statement = e.current_statement || statement;
        break;
      case 'TEMPORARILY_ENABLED':
        suspendedFrom = status;
        status = 'TEMPORARY';
        statement = e.current_statement || statement;
        break;
      case 'REACTIVATED':
        status = suspendedFrom || 'ACTIVE';
        suspendedFrom = null;
        statement = e.current_statement || statement;
        break;
      case 'REJECTED':
        status = 'REJECTED'; suspendedFrom = null; break;
      case 'UNCLEAR':
        flags.push('event at ' + (e.timestamp || e.candidate_id) + ' could not be interpreted');
        break;
      default:
        flags.push('unknown event type: ' + e.event);
    }
    history.push({
      candidate_id: e.candidate_id,
      timestamp: e.timestamp,
      event: e.event,
      status_after: status,
      statement: statement,
    });
  }

  // A temporary change that was never explicitly ended is the single most
  // interesting case in this whole experiment: the user probably believes the
  // original rule is in force, and nothing in the transcript says it came back.
  let unresolvedTemporary = false;
  if (status === 'TEMPORARY') {
    unresolvedTemporary = true;
    flags.push('a temporary change was never explicitly ended — is it still in effect?');
  }

  return { status: status || 'AMBIGUOUS', statement, history, flags, unresolvedTemporary };
}

// ---------------------------------------------------------------------------
// Stage 7 — Ambiguity Detection (spec §12, §13)
// ---------------------------------------------------------------------------

/*
 * Spec §13: a system that dumps everything hard into AMBIGUOUS is useless.
 * So ambiguity is only assigned for a *named* structural reason, and the reason
 * is recorded so the blind evaluation can later separate justified ambiguity
 * from avoided decisions.
 */
const AMBIGUITY_MIN_CONFIDENCE = 0.4;

function stage7Ambiguity(folded, events) {
  const reasons = [];
  events = events || [];

  if (!events.length) reasons.push('no interpretable events');
  if (events.some((e) => e.event === 'UNCLEAR')) reasons.push('at least one event is UNCLEAR');
  if (folded.unresolvedTemporary) reasons.push('temporary change with no recorded end');

  const lowConf = events.filter((e) => typeof e.confidence === 'number' &&
    e.confidence < AMBIGUITY_MIN_CONFIDENCE);
  if (lowConf.length && lowConf.length === events.length) {
    reasons.push('every event was labelled with low confidence');
  }

  // Contradictory events sharing a timestamp: nothing orders them, so the
  // final state is genuinely undecidable. Events with NO timestamp are skipped
  // entirely — treating two unknown times as equal turned every clear
  // create-then-reject chain into a false AMBIGUOUS.
  const byTime = new Map();
  for (const e of events) {
    if (!e.timestamp) continue;
    if (!byTime.has(e.timestamp)) byTime.set(e.timestamp, new Set());
    byTime.get(e.timestamp).add(e.event);
  }
  for (const [t, set] of byTime) {
    if (set.has('REJECTED') && (set.has('CREATED') || set.has('MODIFIED'))) {
      reasons.push('conflicting events share timestamp ' + t);
    }
  }

  return reasons;
}

function decideFinal(folded, events) {
  const ambiguityReasons = stage7Ambiguity(folded, events);
  // An unresolved temporary is reported as TEMPORARY (its own status), not
  // laundered into AMBIGUOUS — it is a real, nameable state.
  let status = folded.status;
  if (ambiguityReasons.length &&
      !(ambiguityReasons.length === 1 && folded.unresolvedTemporary)) {
    status = 'AMBIGUOUS';
  }
  return { status, ambiguityReasons };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function runPipeline(llm, timeline, outDirs, log) {
  const { dataDir, outDir } = outDirs;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const classified = await stage2Classify(llm, timeline, log);
  fs.writeFileSync(path.join(dataDir, 'classified_messages.json'),
    JSON.stringify({ generated: new Date().toISOString(), messages: classified }, null, 2));

  const candidates = await stage3Candidates(llm, classified, log);
  fs.writeFileSync(path.join(dataDir, 'candidates.json'),
    JSON.stringify({ generated: new Date().toISOString(), candidates }, null, 2));

  if (!candidates.length) {
    log('후보가 0개입니다. 이후 단계를 건너뜁니다.');
    return { classified, candidates, groups: [], requirements: [] };
  }

  const { groups, judgements, pairCount } = await stage4Group(llm, candidates, log);
  fs.writeFileSync(path.join(dataDir, 'groups.json'), JSON.stringify({
    generated: new Date().toISOString(),
    lexical_pairs_judged: pairCount,
    exhaustive_pairs_avoided: candidates.length * (candidates.length - 1) / 2,
    judgements,
    groups: groups.map((g) => ({ id: g.id, label: g.label, candidate_ids: g.candidate_ids })),
  }, null, 2));

  const labelled = await stage5Events(llm, groups, log);

  log('Stage 6 — folding event chains into final status (deterministic)');
  log('Stage 7 — ambiguity detection');
  const requirements = labelled.map(({ group, result }) => {
    const byCand = new Map(group.members.map((m) => [m.id, m]));
    const events = ((result && result.events) || []).map((e) => {
      const c = byCand.get(e.candidate_id);
      return Object.assign({}, e, { timestamp: c ? c.timestamp : null });
    }).sort((a, b) => Date.parse(a.timestamp || 0) - Date.parse(b.timestamp || 0));

    const folded = foldEvents(events);
    // Pass the timestamp-enriched events, not the model's raw output.
    const { status, ambiguityReasons } = decideFinal(folded, events);
    const first = group.members[0];
    return {
      id: group.id,
      requirement: (result && result.canonical_requirement) || folded.statement || group.label,
      status,
      ambiguity_reasons: ambiguityReasons,
      fold_flags: folded.flags,
      history: folded.history,
      source: {
        first_message_id: first.source_message_id,
        first_text: first.source_text,
        first_timestamp: first.timestamp,
        candidate_ids: group.candidate_ids,
      },
    };
  });

  // A statement that a later MODIFIED replaced is a real requirement that is
  // simply no longer current. Emitting it lets the blind evaluation use its
  // CORRECT_NON_ACTIVE verdict (spec §20) instead of forcing a wrong call, and
  // gives the contract the SUPERSEDED section spec §14 asks for.
  const superseded = [];
  for (const r of requirements) {
    for (let i = 0; i < r.history.length; i++) {
      const h = r.history[i];
      const next = r.history[i + 1];
      if (!next || next.event !== 'MODIFIED') continue;
      if (!h.statement || h.statement === next.statement) continue;
      superseded.push({
        id: r.id + '_sup' + (superseded.length + 1),
        requirement: h.statement,
        status: 'SUPERSEDED',
        superseded_by: r.id,
        superseded_at: next.timestamp,
        ambiguity_reasons: [],
        fold_flags: [],
        history: r.history.slice(0, i + 1),
        source: r.source,
      });
    }
  }
  const all = requirements.concat(superseded);
  log('  ' + requirements.length + ' requirements, ' + superseded.length + ' superseded versions');

  fs.writeFileSync(path.join(dataDir, 'reconciled.json'),
    JSON.stringify({ generated: new Date().toISOString(), requirements: all }, null, 2));
  fs.writeFileSync(path.join(outDir, 'intentguard_contract.md'), renderContract(all));
  return { classified, candidates, groups, requirements: all };
}

// ---------------------------------------------------------------------------
// Output (spec §14)
// ---------------------------------------------------------------------------

function renderContract(requirements) {
  const L = ['# Current Product Contract', '',
    '생성: ' + new Date().toISOString(), '',
    'IntentGuard 파이프라인 출력. 상태는 시간축 사건을 접어서 결정되었으며,',
    '각 항목의 HISTORY 로 그 판단 과정을 검증할 수 있습니다.', ''];
  const order = ['ACTIVE', 'TEMPORARY', 'AMBIGUOUS', 'SUPERSEDED', 'REJECTED'];
  const byStatus = {};
  for (const r of requirements) (byStatus[r.status] = byStatus[r.status] || []).push(r);

  for (const status of order) {
    const rows = byStatus[status] || [];
    L.push('---', '', '## ' + status + ' (' + rows.length + ')', '');
    if (!rows.length) { L.push('_해당 없음._', ''); continue; }
    for (const r of rows) {
      L.push('### ' + r.requirement, '');
      L.push('**Source**', '');
      L.push('> ' + oneLine(r.source.first_text, 400));
      L.push('');
      L.push('- 최초 발언: `' + r.source.first_timestamp + '`');
      L.push('- 메시지 id: `' + r.source.first_message_id + '`');
      L.push('');
      L.push('**Current Status**: ' + r.status);
      if (r.ambiguity_reasons.length) {
        L.push('');
        L.push('판단 보류 사유:');
        for (const x of r.ambiguity_reasons) L.push('- ' + x);
      }
      if (r.fold_flags.length) {
        L.push('');
        L.push('경고:');
        for (const x of r.fold_flags) L.push('- ' + x);
      }
      L.push('');
      L.push('**History**');
      L.push('');
      for (const h of r.history) {
        L.push('- `' + (h.timestamp || '?') + '` **' + h.event + '** → ' + h.status_after);
      }
      L.push('');
    }
  }
  const other = Object.keys(byStatus).filter((s) => !order.includes(s));
  for (const s of other) {
    L.push('---', '', '## ' + s + ' (' + byStatus[s].length + ')', '');
    for (const r of byStatus[s]) L.push('- ' + r.requirement);
    L.push('');
  }
  return L.join('\n');
}

module.exports = {
  runPipeline, foldEvents, decideFinal, stage7Ambiguity, renderContract,
  MESSAGE_CLASSES, EVENT_TYPES,
};
