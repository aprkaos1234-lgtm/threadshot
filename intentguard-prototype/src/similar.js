'use strict';
/*
 * Cheap lexical retrieval (spec §18).
 *
 * Rule: never LLM-compare every pair. With 60 IntentGuard requirements and
 * 60 baseline requirements, exhaustive judging is 3,600 calls. Instead we
 * retrieve the top 3-5 candidates locally and hand only those to the judge.
 *
 * Korean does not tokenize on whitespace the way English does ("월 3회" vs
 * "월3회로"), so whitespace tokens alone retrieve badly. Character bigrams are
 * used alongside word tokens, which is a well-worn trick for CJK and needs no
 * model or embedding service.
 */

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function wordTokens(s) {
  const n = normalize(s);
  return n ? n.split(/\s+/) : [];
}

function charBigrams(s) {
  const n = normalize(s).replace(/\s+/g, '');
  const out = [];
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
  return out;
}

function termVector(s) {
  const v = new Map();
  const add = (t, w) => v.set(t, (v.get(t) || 0) + w);
  for (const t of wordTokens(s)) add('w:' + t, 1);
  for (const b of charBigrams(s)) add('b:' + b, 0.5);
  return v;
}

function cosine(a, b) {
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [t, w] of small) {
    const o = large.get(t);
    if (o) dot += w * o;
  }
  if (!dot) return 0;
  let na = 0; for (const w of a.values()) na += w * w;
  let nb = 0; for (const w of b.values()) nb += w * w;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function jaccardWords(a, b) {
  const A = new Set(wordTokens(a));
  const B = new Set(wordTokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Combined lexical score in [0,1]. */
function score(a, b) {
  return 0.7 * cosine(termVector(a), termVector(b)) + 0.3 * jaccardWords(a, b);
}

/**
 * For each item in `queries`, return the top-k most similar of `pool`.
 * @returns Array<{ query, candidates: Array<{ item, score }> }>
 */
function topK(queries, pool, textOf, k = 5, minScore = 0.05) {
  const poolVecs = pool.map((p) => ({ item: p, vec: termVector(textOf(p)), text: textOf(p) }));
  return queries.map((q) => {
    const qt = textOf(q);
    const qv = termVector(qt);
    const scored = poolVecs.map((p) => ({
      item: p.item,
      score: 0.7 * cosine(qv, p.vec) + 0.3 * jaccardWords(qt, p.text),
    }));
    scored.sort((x, y) => y.score - x.score);
    return { query: q, candidates: scored.filter((s) => s.score >= minScore).slice(0, k) };
  });
}

/**
 * Union-find over pairs, used to turn "these two are the same" judgements into
 * groups without a second pass.
 */
class UnionFind {
  constructor(ids) {
    this.parent = new Map();
    for (const id of ids) this.parent.set(id, id);
  }
  find(x) {
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    while (this.parent.get(x) !== r) { const n = this.parent.get(x); this.parent.set(x, r); x = n; }
    return r;
  }
  union(a, b) {
    const ra = this.find(a); const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  groups() {
    const g = new Map();
    for (const id of this.parent.keys()) {
      const r = this.find(id);
      if (!g.has(r)) g.set(r, []);
      g.get(r).push(id);
    }
    return [...g.values()];
  }
}

module.exports = { score, topK, termVector, cosine, jaccardWords, normalize, UnionFind };
