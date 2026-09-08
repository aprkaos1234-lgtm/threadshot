'use strict';
const { CostLedger } = require('../src/cost');
const similar = require('../src/similar');

/*
 * A stand-in model for wiring tests and the committed demo run.
 *
 * It returns schema-valid output derived from the prompt so every downstream
 * stage sees realistically-shaped data. It says NOTHING about answer quality —
 * anything it produces is fabricated, and must never be read as a result.
 */
// ---------------------------------------------------------------------------
// Mock model: returns schema-valid output derived from the prompt, so every
// downstream stage sees realistically-shaped data.
// ---------------------------------------------------------------------------

/*
 * Crude topical key for the mock: numbers-with-units ("3회", "5회") and a few
 * domain nouns. A real model reads meaning; this only has to be good enough
 * that the demo exercises the temporal fold instead of leaving every candidate
 * in its own group. It is still obviously not a model.
 */
const DOMAIN = /제한|로그인|공유|갱신|쿠팡|트렌드|링크|타임아웃|재시도|업데이트|표시/g;
function topicKeys(s) {
  const t = String(s || '');
  return new Set([...(t.match(/\d+\s*[가-힣]{1,2}/g) || []).map((x) => x.replace(/\s+/g, '')),
    ...(t.match(DOMAIN) || [])]);
}
function sharesTopic(a, b) {
  const ka = topicKeys(a);
  for (const k of topicKeys(b)) if (ka.has(k)) return true;
  return false;
}

class MockLLM {
  constructor() {
    this.model = 'claude-opus-5';
    this.ledger = new CostLedger(null);
    this.calls = [];
  }
  async structured(req) {
    this.calls.push(req.stage);
    this.ledger.record({
      model: this.model, stage: req.stage,
      usage: { input_tokens: 1000, output_tokens: 300 },
    });
    const ids = [...req.user.matchAll(/(?:^|\n)\s*-?\s*id:\s*(\S+)/g)].map((m) => m[1]);

    if (req.stage === 'classification') {
      return { data: { results: ids.map((id) => ({
        id,
        classification: /빼|말고|아니|취소|됐어/.test(req.user) ? 'CHANGE' : 'REQUIREMENT',
        confidence: 0.8, reason: 'mock', approves_message_id: null,
      })) } };
    }
    if (req.stage === 'candidate_extraction') {
      // one candidate per message, text taken from the message body
      const blocks = req.user.split(/\n\n(?=- id:)/);
      const candidates = [];
      for (const b of blocks) {
        const id = (b.match(/id:\s*(\S+)/) || [])[1];
        const text = (b.split('text: |')[1] || '').trim().split('\n')[0].trim();
        if (id && text) {
          candidates.push({
            source_message_id: id,
            normalized_requirement: text.slice(0, 120),
            type: /빼|말고|다시|되돌/.test(text) ? 'CHANGE' : 'REQUIREMENT',
            refers_to: null, confidence: 0.8,
          });
        }
      }
      return { data: { candidates } };
    }
    if (req.stage === 'grouping') {
      const pairs = [...req.user.matchAll(/a \((\S+?),[^)]*\): (.*)\n\s+b \((\S+?),[^)]*\): (.*)/g)];
      return { data: { judgements: pairs.map((m) => ({
        a: m[1], b: m[3],
        verdict: (sharesTopic(m[2], m[4]) || similar.score(m[2], m[4]) > 0.35)
          ? 'SAME_TOPIC' : 'DIFFERENT_TOPIC',
      })) } };
    }
    if (req.stage === 'reconciliation') {
      // The first block is the prompt preamble, not a candidate — index the
      // events after filtering so the first real candidate becomes CREATED.
      const blocks = req.user.split(/\n\n(?=- candidate_id:)/)
        .filter((b) => /candidate_id:/.test(b));
      const events = blocks.map((b, i) => {
        const id = (b.match(/candidate_id:\s*(\S+)/) || [])[1];
        const reqText = (b.match(/requirement:\s*(.*)/) || [])[1] || '';
        let ev = i === 0 ? 'CREATED' : 'MODIFIED';
        if (i > 0 && /테스트|동안|임시/.test(b)) ev = 'TEMPORARILY_DISABLED';
        else if (i > 0 && /다시|되돌|복구|출시/.test(b)) ev = 'REACTIVATED';
        else if (i > 0 && /빼|취소|삭제/.test(b)) ev = 'REJECTED';
        return id ? { candidate_id: id, event: ev, current_statement: reqText, confidence: 0.85, note: null } : null;
      }).filter(Boolean);
      return { data: { canonical_requirement: (events[0] && events[0].current_statement) || 'mock requirement', events } };
    }
    if (/^baseline_/.test(req.stage)) {
      // Pull a few statements out of the timeline so baselines look real and
      // differ slightly from each other (run number seeds the slice).
      const n = parseInt(req.stage.split('_')[1], 10) || 1;
      const lines = req.user.split('\n').filter((l) => /^\[/.test(l) && l.length > 20);
      const picked = lines.filter((_, i) => i % 3 !== (n - 1) % 3).slice(0, 8);
      return { data: { requirements: picked.map((l, i) => ({
        requirement: l.replace(/^\[[^\]]*\]\s*/, '').slice(0, 120),
        status: i === 0 && n === 2 ? 'REJECTED' : (i === 1 && n === 3 ? 'AMBIGUOUS' : 'ACTIVE'),
        evidence: null, reasoning: null,
      })) } };
    }
    if (req.stage === 'semantic_judge') {
      const rows = [...req.user.matchAll(/query_id: (\S+)\n\s+candidate_id: (\S+)\n\s+A: (.*)\n\s+B: (.*)/g)];
      return { data: { judgements: rows.map((m) => ({
        query_id: m[1], candidate_id: m[2],
        verdict: similar.score(m[3], m[4]) > 0.45 ? 'SAME_REQUIREMENT'
          : (sharesTopic(m[3], m[4]) || similar.score(m[3], m[4]) > 0.25)
            ? 'UNCERTAIN' : 'DIFFERENT',
      })) } };
    }
    throw new Error('MockLLM: unhandled stage ' + req.stage);
  }
}


module.exports = { MockLLM };
