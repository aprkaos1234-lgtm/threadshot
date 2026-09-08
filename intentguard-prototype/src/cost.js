'use strict';
const fs = require('fs');
const path = require('path');

/*
 * Per-call cost ledger (spec §27).
 *
 * Every LLM call is recorded with its stage so that §28's estimate and the
 * RESULT.md cost section can be built from measurements rather than guesses.
 * If IntentGuard wins only by spending 10x the baseline, that has to be
 * visible — this file is what makes it visible.
 */

// USD per 1M tokens. Source: the claude-api skill's model table (2026-06-24).
// Cache reads are ~0.1x input, cache writes ~1.25x input.
const PRICING = {
  'claude-opus-5':    { input: 5.00,  output: 25.00, context: 1000000 },
  'claude-opus-4-8':  { input: 5.00,  output: 25.00, context: 1000000 },
  'claude-sonnet-5':  { input: 2.00,  output: 10.00, context: 1000000 },
  'claude-haiku-4-5': { input: 1.00,  output: 5.00,  context: 200000 },
  'claude-fable-5-1': { input: 10.00, output: 50.00, context: 1000000 },
};

function priceOf(model) {
  if (PRICING[model]) return PRICING[model];
  // Unknown model: price at 0 and say so loudly rather than inventing a number.
  return { input: 0, output: 0, context: 200000, unknown: true };
}

function costOf(model, usage) {
  const p = priceOf(model);
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  return (
    (inTok * p.input) +
    (cacheRead * p.input * 0.1) +
    (cacheWrite * p.input * 1.25) +
    (outTok * p.output)
  ) / 1e6;
}

class CostLedger {
  constructor(file) {
    this.file = file;
    this.calls = [];
    this.unknownModels = new Set();
    if (file && fs.existsSync(file)) {
      try {
        this.calls = JSON.parse(fs.readFileSync(file, 'utf8')).calls || [];
      } catch (_) { this.calls = []; }
    }
  }

  record({ provider = 'anthropic', model, stage, usage, meta }) {
    const p = priceOf(model);
    if (p.unknown) this.unknownModels.add(model);
    const entry = {
      ts: new Date().toISOString(),
      provider,
      model,
      stage,
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_read_input_tokens: usage.cache_read_input_tokens || 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
      estimated_cost_usd: Number(costOf(model, usage).toFixed(6)),
    };
    if (meta) entry.meta = meta;
    this.calls.push(entry);
    return entry;
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({
      generated: new Date().toISOString(),
      summary: this.summary(),
      calls: this.calls,
    }, null, 2));
  }

  summary() {
    const byStage = {};
    for (const c of this.calls) {
      const s = byStage[c.stage] || (byStage[c.stage] = {
        calls: 0, input_tokens: 0, output_tokens: 0,
        cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cost_usd: 0,
      });
      s.calls++;
      s.input_tokens += c.input_tokens;
      s.output_tokens += c.output_tokens;
      s.cache_read_input_tokens += c.cache_read_input_tokens;
      s.cache_creation_input_tokens += c.cache_creation_input_tokens;
      s.cost_usd += c.estimated_cost_usd;
    }
    for (const s of Object.values(byStage)) s.cost_usd = Number(s.cost_usd.toFixed(4));
    const total = Number(this.calls.reduce((a, c) => a + c.estimated_cost_usd, 0).toFixed(4));
    return { total_calls: this.calls.length, total_cost_usd: total, by_stage: byStage };
  }

  stageCost(stage) {
    return this.calls.filter((c) => c.stage === stage)
      .reduce((a, c) => a + c.estimated_cost_usd, 0);
  }
}

module.exports = { CostLedger, PRICING, priceOf, costOf };
